// Microsoft Graph / SharePoint list store — the intended production store.
//
// ⚠ UNVERIFIED. Written without tenant credentials, so it has never run
// against a real list. The shapes follow the documented Graph list-items API,
// but treat the first run as a debugging session, not a deploy. The eligibility
// and issuance logic it feeds IS tested, via the local adapter.
//
// Why SharePoint: already licensed (no procurement, no new data-processing
// agreement), already inside the tenant's data-residency/retention/DLP
// boundary, editable by ops in a browser, and a deleted row is really deleted —
// which is the half of the design the chain cannot do.
//
// Setup:
//   1. Entra ID app registration; Graph application permission
//      Sites.Selected (preferred) or Sites.ReadWrite.All, admin-consented.
//   2. A SharePoint list with columns matching COLUMNS below.
//   3. Environment:
//        STORE=sharepoint
//        SP_TENANT_ID=…  SP_CLIENT_ID=…  SP_CLIENT_SECRET=…
//        SP_SITE_ID=…    (hostname,siteCollectionId,siteId — from Graph)
//        SP_LIST_ID=…    (list id or name)
//
// Note: SharePoint lists get awkward past ~5,000 items. A pilot cohort is
// dozens, so this is a non-issue for years — but it is not a warehouse.

const GRAPH = "https://graph.microsoft.com/v1.0";

/** Store field -> SharePoint column internal name. */
const COLUMNS = {
  participantId: "ParticipantId",
  holder: "Holder",
  email: "Email",
  cohort: "Cohort",
  role: "Role",
  milestones: "Milestones",     // semicolon-separated slugs
  credentialId: "CredentialId",
};

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — see store/sharepoint.mjs header`);
  return v;
};

export class SharePointStore {
  constructor({ tenantId, clientId, clientSecret, siteId, listId }) {
    this.name = `sharepoint(${siteId}/${listId})`;
    Object.assign(this, { tenantId, clientId, clientSecret, siteId, listId });
    this._token = null;
    this._tokenExpiry = 0;
  }

  static fromEnv() {
    return new SharePointStore({
      tenantId: required("SP_TENANT_ID"),
      clientId: required("SP_CLIENT_ID"),
      clientSecret: required("SP_CLIENT_SECRET"),
      siteId: required("SP_SITE_ID"),
      listId: required("SP_LIST_ID"),
    });
  }

  /** Client-credentials flow. Cached until shortly before expiry. */
  async #token() {
    if (this._token && Date.now() < this._tokenExpiry) return this._token;
    const res = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      },
    );
    if (!res.ok) throw new Error(`Entra token failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    this._token = j.access_token;
    // Refresh a minute early rather than racing the expiry.
    this._tokenExpiry = Date.now() + (j.expires_in - 60) * 1000;
    return this._token;
  }

  async #graph(pathname, init = {}) {
    const res = await fetch(`${GRAPH}${pathname}`, {
      ...init,
      headers: {
        authorization: `Bearer ${await this.#token()}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`Graph ${init.method ?? "GET"} ${pathname}: ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }

  #toParticipant(item) {
    const f = item.fields ?? {};
    return {
      _itemId: item.id, // needed to PATCH the row back
      participantId: f[COLUMNS.participantId],
      holder: f[COLUMNS.holder],
      email: f[COLUMNS.email],
      cohort: f[COLUMNS.cohort],
      role: f[COLUMNS.role],
      milestones: (f[COLUMNS.milestones] ?? "").split(";").map((s) => s.trim()).filter(Boolean),
      credentialId: f[COLUMNS.credentialId] || undefined,
    };
  }

  async list(cohort) {
    const base = `/sites/${this.siteId}/lists/${this.listId}/items?expand=fields&$top=200`;
    let url = cohort
      ? `${base}&$filter=fields/${COLUMNS.cohort} eq '${String(cohort).replace(/'/g, "''")}'`
      : base;
    const out = [];
    // Graph pages with @odata.nextLink; follow it rather than assuming one page.
    while (url) {
      const page = await this.#graph(url.startsWith("http") ? url.slice(GRAPH.length) : url, {
        headers: { prefer: "HonorNonIndexedQueriesWarningMayFailRandomly" },
      });
      out.push(...(page.value ?? []).map((i) => this.#toParticipant(i)));
      url = page["@odata.nextLink"] ?? null;
    }
    return out;
  }

  async get(participantId) {
    const all = await this.list(null);
    return all.find((p) => p.participantId === participantId) ?? null;
  }

  async markIssued(participantId, credentialId) {
    const p = await this.get(participantId);
    if (!p) throw new Error(`no such participant: ${participantId}`);
    await this.#graph(
      `/sites/${this.siteId}/lists/${this.listId}/items/${p._itemId}/fields`,
      { method: "PATCH", body: JSON.stringify({ [COLUMNS.credentialId]: credentialId }) },
    );
  }
}
