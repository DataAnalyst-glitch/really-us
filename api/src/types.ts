// Shared types. The three verdicts are the only verdicts that exist.
export const VERDICTS = ["MATCHES_SCAM_SIGNS", "NO_MATCHING_NOTICE", "GENUINE_NOTICE_FOUND"] as const;
export type Verdict = (typeof VERDICTS)[number];

export interface ScamSignalConfig {
  id: string;
  reason: string; // shown to the customer only when this signal is really detected
  pattern: string; // regular expression source, case-insensitive
}

export interface CompanyConfig {
  company_id: string;
  display_name: string;
  official_channels: string[];
  official_senders: string[];
  notice_rules: {
    proof_code_pattern: string; // regular expression source for the whole code
    official_domains: string[]; // links to these domains (or none) are normal
  };
  scam_signals: ScamSignalConfig[];
  fraud_reporting: string; // local fraud reporting line for the damage path
  demo_accounts: string[];
  demo_contacts: string[];
}

export interface Notice {
  notice_id: string;
  company_id: string;
  demo_account: string;
  proof_code: string;
}

export type ProofState = "absent" | "valid" | "invalid";

export interface DetectedSignal {
  id: string;
  reason: string;
}

// Everything the pure verdict function needs. No I/O inside the decision.
export interface VerdictFacts {
  signals: DetectedSignal[];
  proof: ProofState;
  accountNotice: boolean;
  senderOfficial: boolean; // a sender was supplied and is on the company's official allowlist
}

export interface VerdictResult {
  verdict: Verdict;
  reasons: string[]; // always exactly 3
  next_step: string;
}

export interface Report {
  report_id: string;
  company_id: string;
  sender_hash: string;
  sender_masked: string;
  customer_ref: string;
  created_at: string;
}

export type CasePriority = "P1" | "P2" | "P3";

export interface CaseRecord {
  case_id: string;
  company_id: string;
  priority: CasePriority;
  reason: string;
  summary: string;
  created_at: string;
}

export type OutbreakStatus = "suspected" | "approved";

export interface Outbreak {
  outbreak_id: string;
  company_id: string;
  sender_hash: string;
  sender_masked: string;
  status: OutbreakStatus;
  created_at: string;
}

export interface Alert {
  alert_id: string;
  outbreak_id: string;
  company_id: string;
  simulated: true;
  created_at: string;
}

export interface AuditEvent {
  event_id: string;
  type: string;
  company_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export type ApiBody = { success: boolean; demo_data: true } & Record<string, unknown>;
export interface ApiResult {
  status: number;
  body: ApiBody;
}

export interface IdempotencyRecord {
  key: string;
  fingerprint: string;
  result: ApiResult;
}

// Storage interface. Memory now; a database can implement the same methods later.
export interface Storage {
  findNoticeByProofCode(company_id: string, proof_code: string): Promise<Notice | undefined>;
  findNoticeByAccount(company_id: string, demo_account: string): Promise<Notice | undefined>;

  getIdempotent(key: string): Promise<IdempotencyRecord | undefined>;
  saveIdempotent(record: IdempotencyRecord): Promise<void>;

  findReport(company_id: string, sender_hash: string, customer_ref: string): Promise<Report | undefined>;
  addReport(report: Report): Promise<void>;
  listReports(company_id: string, sender_hash?: string): Promise<Report[]>;

  addCase(record: CaseRecord): Promise<void>;
  listCases(company_id?: string): Promise<CaseRecord[]>;

  getOutbreak(outbreak_id: string): Promise<Outbreak | undefined>;
  findOutbreak(company_id: string, sender_hash: string): Promise<Outbreak | undefined>;
  saveOutbreak(outbreak: Outbreak): Promise<void>;
  listOutbreaks(company_id?: string): Promise<Outbreak[]>;

  addAlert(alert: Alert): Promise<void>;
  listAlerts(): Promise<Alert[]>;

  addAudit(event: AuditEvent): Promise<void>;
  listAudit(): Promise<AuditEvent[]>;

  nextId(prefix: string): string;
}
