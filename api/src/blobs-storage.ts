import { randomBytes } from "node:crypto";
import { fixtureNotices } from "./fixtures.js";
import type {
  Alert, AuditEvent, CaseRecord, IdempotencyRecord, KnowledgeDraft, Notice, Outbreak, Report, Storage,
} from "./types.js";

// Storage on Netlify Blobs. Memory storage does not persist between serverless invocations; this does.
// It uses only the small slice of the Blobs store API below, so tests can pass a fake store.
export interface BlobStoreLike {
  get(key: string, options: { type: "json" }): Promise<unknown>;
  setJSON(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  list(options?: { prefix?: string }): Promise<{ blobs: Array<{ key: string }> }>;
}

// Known limit: Blobs has no transactions. Two requests with the same new idempotency key at the
// same instant could both run. Retries after the first finishes are safe. See docs/DECISIONS.md.
const enc = encodeURIComponent;

export function createBlobsStorage(store: BlobStoreLike, notices: Notice[] = fixtureNotices): Storage {
  let seq = 0;

  async function read<T>(key: string): Promise<T | undefined> {
    const value = await store.get(key, { type: "json" });
    return value === null || value === undefined ? undefined : (value as T);
  }
  async function readAll<T>(prefix: string): Promise<T[]> {
    const { blobs } = await store.list({ prefix });
    const items: Array<T | undefined> = await Promise.all(blobs.map((b) => read<T>(b.key)));
    return items.filter((v): v is T => v !== undefined);
  }
  // Oldest first; ids are time-ordered, so they break ties within one millisecond.
  const oldestFirst = <T extends { created_at: string }>(items: T[], idOf: (t: T) => string) =>
    items.sort((a, b) => (a.created_at === b.created_at ? idOf(a).localeCompare(idOf(b)) : a.created_at.localeCompare(b.created_at)));

  return {
    async findNoticeByProofCode(company_id, proof_code) {
      return notices.find((n) => n.company_id === company_id && n.proof_code === proof_code);
    },
    async findNoticeByAccount(company_id, demo_account) {
      return notices.find((n) => n.company_id === company_id && n.demo_account === demo_account);
    },

    async getIdempotent(key) {
      return read<IdempotencyRecord>(`idem/${enc(key)}`);
    },
    async saveIdempotent(record) {
      await store.setJSON(`idem/${enc(record.key)}`, record);
    },

    async findReport(company_id, sender_hash, customer_ref) {
      return read<Report>(`report/${company_id}/${sender_hash}/${enc(customer_ref)}`);
    },
    async addReport(report) {
      await store.setJSON(`report/${report.company_id}/${report.sender_hash}/${enc(report.customer_ref)}`, report);
    },
    async listReports(company_id, sender_hash) {
      const prefix = sender_hash === undefined ? `report/${company_id}/` : `report/${company_id}/${sender_hash}/`;
      return oldestFirst(await readAll<Report>(prefix), (r) => r.report_id);
    },

    async addCase(record) {
      await store.setJSON(`case/${record.case_id}`, record);
    },
    async listCases(company_id) {
      const all = await readAll<CaseRecord>("case/");
      return oldestFirst(all.filter((c) => company_id === undefined || c.company_id === company_id), (c) => c.case_id);
    },

    async getOutbreak(outbreak_id) {
      return read<Outbreak>(`outbreak/${enc(outbreak_id)}`);
    },
    async findOutbreak(company_id, sender_hash) {
      const all = await readAll<Outbreak>("outbreak/");
      return all.find((o) => o.company_id === company_id && o.sender_hash === sender_hash);
    },
    async saveOutbreak(outbreak) {
      await store.setJSON(`outbreak/${enc(outbreak.outbreak_id)}`, outbreak);
    },
    async listOutbreaks(company_id) {
      const all = await readAll<Outbreak>("outbreak/");
      return oldestFirst(all.filter((o) => company_id === undefined || o.company_id === company_id), (o) => o.outbreak_id);
    },

    async addAlert(alert) {
      await store.setJSON(`alert/${alert.alert_id}`, alert);
    },
    async listAlerts() {
      return oldestFirst(await readAll<Alert>("alert/"), (a) => a.alert_id);
    },

    async addAudit(event) {
      await store.setJSON(`audit/${event.event_id}`, event);
    },
    async listAudit() {
      return oldestFirst(await readAll<AuditEvent>("audit/"), (e) => e.event_id);
    },

    async saveDraft(draft) {
      await store.setJSON(`draft/${draft.draft_id}`, draft);
    },
    async getDraft(draft_id) {
      return read<KnowledgeDraft>(`draft/${enc(draft_id)}`);
    },
    async listDrafts() {
      return oldestFirst(await readAll<KnowledgeDraft>("draft/"), (d) => d.draft_id);
    },

    async reset() {
      const { blobs } = await store.list();
      await Promise.all(blobs.map((b) => store.delete(b.key)));
    },

    // No shared counter across invocations, so ids are time-ordered with a random tail.
    nextId(prefix) {
      seq += 1;
      return `${prefix}-${Date.now().toString(36).padStart(9, "0")}${seq.toString(36).padStart(4, "0")}${randomBytes(4).toString("hex")}`;
    },
  };
}
