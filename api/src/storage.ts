import { fixtureNotices } from "./fixtures.js";
import type {
  Alert, AuditEvent, CaseRecord, IdempotencyRecord, KnowledgeDraft, Notice, Outbreak, Report, Storage,
} from "./types.js";

// In-memory storage. Each call to createMemoryStorage gives a fresh, empty state.
export function createMemoryStorage(notices: Notice[] = fixtureNotices): Storage {
  const idempotency = new Map<string, IdempotencyRecord>();
  let reports: Report[] = [];
  let cases: CaseRecord[] = [];
  const outbreaks = new Map<string, Outbreak>();
  let alerts: Alert[] = [];
  let audit: AuditEvent[] = [];
  const drafts = new Map<string, KnowledgeDraft>();
  const counters = new Map<string, number>();

  return {
    async findNoticeByProofCode(company_id, proof_code) {
      return notices.find((n) => n.company_id === company_id && n.proof_code === proof_code);
    },
    async findNoticeByAccount(company_id, demo_account) {
      return notices.find((n) => n.company_id === company_id && n.demo_account === demo_account);
    },

    async getIdempotent(key) {
      return idempotency.get(key);
    },
    async saveIdempotent(record) {
      idempotency.set(record.key, record);
    },

    async findReport(company_id, sender_hash, customer_ref) {
      return reports.find(
        (r) => r.company_id === company_id && r.sender_hash === sender_hash && r.customer_ref === customer_ref,
      );
    },
    async addReport(report) {
      reports.push(report);
    },
    async listReports(company_id, sender_hash) {
      return reports.filter((r) => r.company_id === company_id && (sender_hash === undefined || r.sender_hash === sender_hash));
    },

    async addCase(record) {
      cases.push(record);
    },
    async listCases(company_id) {
      return cases.filter((c) => company_id === undefined || c.company_id === company_id);
    },

    async getOutbreak(outbreak_id) {
      return outbreaks.get(outbreak_id);
    },
    async findOutbreak(company_id, sender_hash) {
      return [...outbreaks.values()].find((o) => o.company_id === company_id && o.sender_hash === sender_hash);
    },
    async saveOutbreak(outbreak) {
      outbreaks.set(outbreak.outbreak_id, outbreak);
    },
    async listOutbreaks(company_id) {
      return [...outbreaks.values()].filter((o) => company_id === undefined || o.company_id === company_id);
    },

    async addAlert(alert) {
      alerts.push(alert);
    },
    async listAlerts() {
      return [...alerts];
    },

    async addAudit(event) {
      audit.push(event);
    },
    async listAudit() {
      return [...audit];
    },

    async saveDraft(draft) {
      drafts.set(draft.draft_id, draft);
    },
    async getDraft(draft_id) {
      return drafts.get(draft_id);
    },
    async listDrafts() {
      return [...drafts.values()];
    },

    async reset() {
      idempotency.clear();
      reports = [];
      cases = [];
      outbreaks.clear();
      alerts = [];
      audit = [];
      drafts.clear();
      counters.clear();
    },

    nextId(prefix) {
      const n = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, n);
      return `${prefix}-${String(n).padStart(4, "0")}`;
    },
  };
}
