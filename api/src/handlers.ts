import { getCompany } from "./companies/index.js";
import { countDistinctCustomers, shouldSuspectOutbreak } from "./outbreak.js";
import { checkProofCode, normalizeProofCode } from "./proofcode.js";
import { hashSender, isOfficialSender, maskSender } from "./sender.js";
import { buildCustomerText } from "./customer-text.js";
import { decideVerdict, detectScamSigns } from "./verdict.js";
import type { ApiResult, CasePriority, CompanyConfig, Outbreak, Report, Storage } from "./types.js";

// Plain handler functions. A thin HTTP adapter will call these later.
export interface Deps {
  storage: Storage;
  env: { DEMO_DATA_ONLY?: string; DEMO_KEY?: string };
  now?: () => string;
}

const MAX_MESSAGE_LENGTH = 600; // eGain paste Max Length (TECHNOLOGY.md)
const DAMAGE_REASONS = ["ALREADY_PAID", "SHARED_DETAILS", "CLICKED_LINK", "INSTALLED_APP"];
const PRIORITIES = ["P1", "P2", "P3"];
const OUTBREAK_WARNING = "Several customers have reported this sender. Treat it with care.";
const SUPPORT_STEP = "Please contact support through an official channel.";

// ---- small helpers -------------------------------------------------------------

function respond(status: number, success: boolean, fields: Record<string, unknown> = {}): ApiResult {
  return { status, body: { success, demo_data: true, ...fields } };
}
const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => respond(status, false, { error, ...extra });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const asText = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const nowOf = (deps: Deps) => (deps.now ? deps.now() : new Date().toISOString());

type Resolved =
  | { kind: "ok"; config: CompanyConfig }
  | { kind: "testfail" | "testfailwrite" | "unknown" };

// TESTFAIL and TESTFAILWRITE exist only when DEMO_DATA_ONLY=true.
function resolveCompany(deps: Deps, company_id: unknown): Resolved {
  const config = getCompany(company_id);
  if (config) return { kind: "ok", config };
  if (deps.env.DEMO_DATA_ONLY === "true") {
    if (company_id === "TESTFAIL") return { kind: "testfail" };
    if (company_id === "TESTFAILWRITE") return { kind: "testfailwrite" };
  }
  return { kind: "unknown" };
}

async function audit(deps: Deps, type: string, company_id: string | null, detail: Record<string, unknown>) {
  await deps.storage.addAudit({ event_id: deps.storage.nextId("EV"), type, company_id, detail, created_at: nowOf(deps) });
}

async function senderInfo(deps: Deps, config: CompanyConfig, sender_hash: string) {
  const reports = await deps.storage.listReports(config.company_id, sender_hash);
  const report_count = countDistinctCustomers(reports);
  if (isOfficialSender(config, sender_hash)) return { report_count, warning: null, status: "official" };
  const outbreak = await deps.storage.findOutbreak(config.company_id, sender_hash);
  if (outbreak) return { report_count, warning: OUTBREAK_WARNING, status: `outbreak_${outbreak.status}` };
  return { report_count, warning: null, status: "none" };
}

// Every write goes through here: confirmed=true and an idempotency_key are enforced in the API.
// Same key + same payload returns the stored result. Same key + different payload is rejected.
// Failed writes are not stored (an unknown outcome must not be resubmitted blindly).
async function runWrite(
  deps: Deps,
  args: {
    action: string;
    company_id: string | null;
    confirmed: unknown;
    idempotency_key: unknown;
    fingerprint: unknown[];
    execute: () => Promise<ApiResult>;
  },
): Promise<ApiResult> {
  const { action, company_id } = args;
  if (args.confirmed !== true) {
    await audit(deps, "write_rejected", company_id, { action, reason: "CONFIRMATION_REQUIRED" });
    return fail(400, "CONFIRMATION_REQUIRED");
  }
  if (!nonEmpty(args.idempotency_key)) {
    await audit(deps, "write_rejected", company_id, { action, reason: "IDEMPOTENCY_KEY_REQUIRED" });
    return fail(400, "IDEMPOTENCY_KEY_REQUIRED");
  }
  const key = args.idempotency_key;
  const fingerprint = JSON.stringify([action, ...args.fingerprint]);

  const previous = await deps.storage.getIdempotent(key);
  if (previous) {
    if (previous.fingerprint === fingerprint) return previous.result;
    await audit(deps, "write_rejected", company_id, { action, reason: "IDEMPOTENCY_KEY_REUSED" });
    return fail(409, "IDEMPOTENCY_KEY_REUSED");
  }

  const result = await args.execute();
  if (result.body.success) await deps.storage.saveIdempotent({ key, fingerprint, result });
  return result;
}

// ---- POST /v1/verify -----------------------------------------------------------

export async function handleVerify(deps: Deps, body: unknown): Promise<ApiResult> {
  const b = isRecord(body) ? body : {};
  const resolved = resolveCompany(deps, b.company_id);

  // Rule 1: TESTFAIL returns an error and no verdict.
  if (resolved.kind === "testfail") {
    await audit(deps, "verify_error", "TESTFAIL", { error: "SERVER_ERROR" });
    return fail(500, "SERVER_ERROR", { next_step: `No verdict was produced. ${SUPPORT_STEP}` });
  }
  if (resolved.kind !== "ok") return fail(400, "UNKNOWN_COMPANY");
  const config = resolved.config;

  if (!nonEmpty(b.message)) return fail(400, "INVALID_REQUEST", { detail: "message is required" });
  if (b.message.length > MAX_MESSAGE_LENGTH) return fail(400, "MESSAGE_TOO_LONG");
  for (const field of ["demo_account", "proof_code", "sender"]) {
    if (b[field] !== undefined && b[field] !== null && typeof b[field] !== "string") {
      return fail(400, "INVALID_REQUEST", { detail: `${field} must be text` });
    }
  }
  const demo_account = asText(b.demo_account)?.trim();
  const suppliedCode = asText(b.proof_code);
  const sender = asText(b.sender);

  // Facts first (lookups), then a pure decision.
  const signals = detectScamSigns(config, b.message);
  const codeNotice =
    suppliedCode && suppliedCode.trim() !== ""
      ? await deps.storage.findNoticeByProofCode(config.company_id, normalizeProofCode(suppliedCode))
      : undefined;
  const proof = checkProofCode(config, suppliedCode, codeNotice);
  const accountNotice = demo_account ? (await deps.storage.findNoticeByAccount(config.company_id, demo_account)) !== undefined : false;
  const senderOfficial = nonEmpty(sender) && isOfficialSender(config, hashSender(sender));
  const decision = decideVerdict(config, { signals, proof, accountNotice, senderOfficial });

  let sender_hash: string | null = null;
  let report_count = 0;
  let warning: string | null = null;
  if (nonEmpty(sender)) {
    sender_hash = hashSender(sender);
    const info = await senderInfo(deps, config, sender_hash);
    report_count = info.report_count;
    warning = info.warning;
  }

  // The message text itself is never stored.
  await audit(deps, "verify", config.company_id, { verdict: decision.verdict, signals: signals.map((s) => s.id), proof });
  return respond(200, true, {
    verdict: decision.verdict,
    reasons: decision.reasons,
    next_step: decision.next_step,
    customer_text: buildCustomerText(decision.verdict, decision.reasons, decision.next_step),
    sender_hash,
    report_count,
    warning,
  });
}

// ---- GET /v1/senders/{hash} ----------------------------------------------------

export async function handleSenderLookup(deps: Deps, input: { company_id?: unknown; sender_hash?: unknown }): Promise<ApiResult> {
  const resolved = resolveCompany(deps, input.company_id);
  if (resolved.kind !== "ok") return fail(400, "UNKNOWN_COMPANY");
  if (!nonEmpty(input.sender_hash)) return fail(400, "INVALID_REQUEST", { detail: "sender_hash is required" });
  const info = await senderInfo(deps, resolved.config, input.sender_hash);
  return respond(200, true, info);
}

// ---- POST /v1/reports ----------------------------------------------------------

export async function handleReport(deps: Deps, body: unknown): Promise<ApiResult> {
  const b = isRecord(body) ? body : {};
  const resolved = resolveCompany(deps, b.company_id);
  if (resolved.kind === "unknown" || resolved.kind === "testfail") return fail(400, "UNKNOWN_COMPANY");
  const company_id = String(b.company_id);

  return runWrite(deps, {
    action: "report",
    company_id,
    confirmed: b.confirmed,
    idempotency_key: b.idempotency_key,
    fingerprint: [company_id, typeof b.sender === "string" ? hashSender(b.sender) : null, b.customer_ref ?? null],
    execute: async () => {
      if (resolved.kind !== "ok") {
        return fail(200, "WRITE_FAILED", { next_step: SUPPORT_STEP });
      }
      const config = resolved.config;
      if (!nonEmpty(b.sender) || !nonEmpty(b.customer_ref) || b.customer_ref.length > 64) {
        return fail(400, "INVALID_REQUEST", { detail: "sender and customer_ref are required" });
      }
      const sender_hash = hashSender(b.sender);

      // One record per customer per sender. A repeat from the same customer adds nothing.
      let report = await deps.storage.findReport(config.company_id, sender_hash, b.customer_ref);
      const already_reported = report !== undefined;
      if (!report) {
        const created: Report = {
          report_id: deps.storage.nextId("RPT"),
          company_id: config.company_id,
          sender_hash,
          sender_masked: maskSender(b.sender),
          customer_ref: b.customer_ref,
          created_at: nowOf(deps),
        };
        await deps.storage.addReport(created);
        report = created;
      }

      const distinct = countDistinctCustomers(await deps.storage.listReports(config.company_id, sender_hash));
      let outbreak = await deps.storage.findOutbreak(config.company_id, sender_hash);
      if (!outbreak && shouldSuspectOutbreak(distinct, isOfficialSender(config, sender_hash))) {
        outbreak = {
          outbreak_id: `OB-${config.company_id}-${sender_hash.slice(0, 10)}`,
          company_id: config.company_id,
          sender_hash,
          sender_masked: report.sender_masked,
          status: "suspected",
          created_at: nowOf(deps),
        } satisfies Outbreak;
        await deps.storage.saveOutbreak(outbreak);
        await audit(deps, "outbreak_suspected", config.company_id, { outbreak_id: outbreak.outbreak_id, distinct });
      }

      await audit(deps, "report", config.company_id, { report_id: report.report_id, already_reported });
      return respond(200, true, {
        report_id: report.report_id,
        report_count: distinct,
        outbreak_status: outbreak ? outbreak.status : "none",
        already_reported,
      });
    },
  });
}

// ---- POST /v1/cases ------------------------------------------------------------

export async function handleCase(deps: Deps, body: unknown): Promise<ApiResult> {
  const b = isRecord(body) ? body : {};
  const resolved = resolveCompany(deps, b.company_id);
  if (resolved.kind === "unknown" || resolved.kind === "testfail") return fail(400, "UNKNOWN_COMPANY");
  const company_id = String(b.company_id);

  return runWrite(deps, {
    action: "case",
    company_id,
    confirmed: b.confirmed,
    idempotency_key: b.idempotency_key,
    fingerprint: [company_id, b.priority ?? null, b.reason ?? null, b.summary ?? null],
    execute: async () => {
      if (resolved.kind !== "ok") {
        return fail(200, "WRITE_FAILED", { next_step: SUPPORT_STEP });
      }
      const config = resolved.config;
      if (
        typeof b.priority !== "string" || !PRIORITIES.includes(b.priority) ||
        !nonEmpty(b.reason) || b.reason.length > 100 ||
        !nonEmpty(b.summary) || b.summary.length > 500
      ) {
        return fail(400, "INVALID_REQUEST", { detail: "priority (P1-P3), reason and summary are required" });
      }
      const reason = b.reason.trim().toUpperCase().replace(/\s+/g, "_");
      // Damage path: the server sets P1. A caller cannot lower it.
      const isDamage = DAMAGE_REASONS.includes(reason);
      const priority: CasePriority = isDamage ? "P1" : (b.priority as CasePriority);

      const record = {
        case_id: deps.storage.nextId("CASE"),
        company_id: config.company_id,
        priority,
        reason,
        summary: b.summary,
        created_at: nowOf(deps),
      };
      await deps.storage.addCase(record);
      await audit(deps, "case", config.company_id, { case_id: record.case_id, priority, reason });

      const next_step = isDamage
        ? `Stop any further payments or sharing. Contact your own bank or card provider now through their official channel. Report it to local fraud reporting: ${config.fraud_reporting}. Our team will review this case.`
        : `A case was opened. Check any message only through ${config.display_name} official channels: ${config.official_channels.join("; ")}.`;
      return respond(200, true, { case_id: record.case_id, priority, next_step });
    },
  });
}

// ---- POST /v1/outbreaks/{id}/approve (human approval) -------------------------------

export async function handleApproveOutbreak(
  deps: Deps,
  input: { demo_key?: unknown; outbreak_id?: unknown; confirmed?: unknown; idempotency_key?: unknown },
): Promise<ApiResult> {
  const expected = deps.env.DEMO_KEY;
  if (!expected || input.demo_key !== expected) return fail(401, "DEMO_KEY_REQUIRED");

  return runWrite(deps, {
    action: "approve",
    company_id: null,
    confirmed: input.confirmed,
    idempotency_key: input.idempotency_key,
    fingerprint: [input.outbreak_id ?? null],
    execute: async () => {
      const outbreak = await deps.storage.getOutbreak(String(input.outbreak_id));
      if (!outbreak) return fail(404, "OUTBREAK_NOT_FOUND");
      if (outbreak.status !== "approved") {
        await deps.storage.saveOutbreak({ ...outbreak, status: "approved" });
        await deps.storage.addAlert({
          alert_id: deps.storage.nextId("ALERT"),
          outbreak_id: outbreak.outbreak_id,
          company_id: outbreak.company_id,
          simulated: true,
          created_at: nowOf(deps),
        });
        await audit(deps, "outbreak_approved", outbreak.company_id, { outbreak_id: outbreak.outbreak_id });
      }
      return respond(200, true, { outbreak_id: outbreak.outbreak_id, alerted_simulated: true });
    },
  });
}
