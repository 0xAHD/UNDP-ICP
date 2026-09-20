// Google Sheets store — the backup, if SharePoint is not available in time.
//
// ⚠ UNVERIFIED. Written without credentials; never run against a real sheet.
//
// Weaker than SharePoint for this purpose: it sits outside the Microsoft
// tenant, so the organisation's retention and DLP policies do NOT cover it,
// and that is a data-protection question, not a technical one. Use it for a
// pilot only, and say so to whoever owns the data.
//
// Setup:
//   1. A Google Cloud service account with the Sheets API enabled.
//   2. Share the sheet with the service account's email (Editor).
//   3. Environment:
//        STORE=google
//        GS_SHEET_ID=…
//        GS_SA_EMAIL=…        GS_SA_PRIVATE_KEY=…  (PEM, \n-escaped is fine)
//        GS_TAB=Participants  (optional, default Participants)
//
// Row 1 is a header. Columns: participantId, holder, email, cohort, role,
// milestones (semicolon-separated), credentialId.
import crypto from "node:crypto";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const HEADERS = ["participantId", "holder", "email", "cohort", "role", "milestones", "credentialId"];

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — see store/google.mjs header`);
  return v;
};
const b64url = (b) => Buffer.from(b).toString("base64url");

export class GoogleSheetStore {
  constructor({ sheetId, saEmail, privateKey, tab }) {
    this.name = `google(${sheetId}/${tab})`;
    Object.assign(this, { sheetId, saEmail, privateKey, tab });
    this._token = null; this._tokenExpiry = 0;
  }

  static fromEnv() {
    return new GoogleSheetStore({
      sheetId: required("GS_SHEET_ID"),
      saEmail: required("GS_SA_EMAIL"),
      privateKey: required("GS_SA_PRIVATE_KEY").replace(/\\n/g, "\n"),
      tab: process.env.GS_TAB ?? "Participants",
    });
  }

  /** Service-account JWT bearer flow — no external dependency needed. */
  async #token() {
    if (this._token && Date.now() < this._tokenExpiry) return this._token;
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: this.saEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now, exp: now + 3600,
    };
    const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claim))}`;
    const sig = crypto.sign("RSA-SHA256", Buffer.from(unsigned), this.privateKey).toString("base64url");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${sig}`,
      }),
    });
    if (!res.ok) throw new Error(`Google token failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    this._token = j.access_token;
    this._tokenExpiry = Date.now() + (j.expires_in - 60) * 1000;
    return this._token;
  }

  async #api(pathname, init = {}) {
    const res = await fetch(`${SHEETS}/${this.sheetId}${pathname}`, {
      ...init,
      headers: {
        authorization: `Bearer ${await this.#token()}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`Sheets ${init.method ?? "GET"} ${pathname}: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async #rows() {
    const r = await this.#api(`/values/${encodeURIComponent(this.tab)}!A1:G10000`);
    const [head, ...body] = r.values ?? [];
    if (!head) return [];
    const idx = Object.fromEntries(HEADERS.map((h) => [h, head.indexOf(h)]));
    return body.map((row, i) => ({
      _rowNumber: i + 2, // 1-based, and row 1 is the header
      participantId: row[idx.participantId],
      holder: row[idx.holder],
      email: row[idx.email],
      cohort: row[idx.cohort],
      role: row[idx.role],
      milestones: (row[idx.milestones] ?? "").split(";").map((s) => s.trim()).filter(Boolean),
      credentialId: row[idx.credentialId] || undefined,
      _credentialCol: String.fromCharCode(65 + idx.credentialId),
    })).filter((p) => p.participantId);
  }

  async list(cohort) {
    const rows = await this.#rows();
    return cohort ? rows.filter((r) => r.cohort === cohort) : rows;
  }
  async get(participantId) {
    return (await this.#rows()).find((r) => r.participantId === participantId) ?? null;
  }
  async markIssued(participantId, credentialId) {
    const p = await this.get(participantId);
    if (!p) throw new Error(`no such participant: ${participantId}`);
    const cell = `${this.tab}!${p._credentialCol}${p._rowNumber}`;
    await this.#api(`/values/${encodeURIComponent(cell)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [[credentialId]] }),
    });
  }
}
