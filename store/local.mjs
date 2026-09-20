// Local JSON-file store. Dev and tests only — no access control, no audit,
// and it sits on disk in the clear. Never point this at real participants.
import fs from "node:fs";
import path from "node:path";

export class LocalStore {
  constructor(file) { this.name = `local(${file})`; this.file = file; }

  #read() {
    if (!fs.existsSync(this.file)) return [];
    return JSON.parse(fs.readFileSync(this.file, "utf8"));
  }
  #write(rows) {
    fs.mkdirSync(path.dirname(path.resolve(this.file)), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(rows, null, 2) + "\n");
  }

  async list(cohort) {
    return this.#read().filter((r) => !cohort || r.cohort === cohort);
  }
  async get(participantId) {
    return this.#read().find((r) => r.participantId === participantId) ?? null;
  }
  async markIssued(participantId, credentialId) {
    const rows = this.#read();
    const row = rows.find((r) => r.participantId === participantId);
    if (!row) throw new Error(`no such participant: ${participantId}`);
    row.credentialId = credentialId;
    this.#write(rows);
  }

  /** Test helper — not part of the Store interface. */
  async seed(rows) { this.#write(rows); }
}
