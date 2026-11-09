import { createHash, timingSafeEqual } from "node:crypto";
import { companies, getCompany } from "./companies/index.js";
import { audit, fail, nonEmpty, nowOf, respond, runWrite, type Deps } from "./handlers.js";
import { buildArticleDraft } from "./outbreak-content.js";
import { countDistinctCustomers } from "./outbreak.js";
import type { ApiResult } from "./types.js";

// Trust Console API. Every function here needs the demo key (X-Demo-Key). Nothing publishes by itself:
// alerts are simulated and drafts wait for a person. Writes need confirmed=true and an idempotency_key.

const FEED_LIMIT = 50;

export function demoKeyOk(deps: Pick<Deps, "env">, supplied: unknown): boolean {
  const expected = deps.env.DEMO_KEY;
  if (!expected || typeof supplied !== "string" || supplied === "") return false;
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
const denied = () => fail(401, "DEMO_KEY_REQUIRED");

// ---- GET /v1/console/state -----------------------------------------------------------

export async function handleConsoleState(deps: Deps, input: { demo_key?: unknown }): Promise<ApiResult> {
  if (!demoKeyOk(deps, input.demo_key)) return denied();
  const { storage } = deps;

  const outbreaks = await storage.listOutbreaks();
  const alerts = await storage.listAlerts();
  const drafts = await storage.listDrafts();
  const cases = await storage.listCases();
  let reportRecords = 0;
  for (const company_id of Object.keys(companies)) reportRecords += (await storage.listReports(company_id)).length;

  const cards = [];
  for (const o of outbreaks) {
    const customers = countDistinctCustomers(await storage.listReports(o.company_id, o.sender_hash));
    const alert = alerts.find((a) => a.outbreak_id === o.outbreak_id);
    const draft = drafts.find((d) => d.outbreak_id === o.outbreak_id);
    cards.push({
      outbreak_id: o.outbreak_id,
      company_id: o.company_id,
      company_name: getCompany(o.company_id)?.display_name ?? o.company_id,
      sender_masked: o.sender_masked,
      status: o.status,
      report_count: customers,
      alert_text: alert ? alert.alert_text : null,
      alert_simulated: alert ? alert.simulated : null,
      draft: draft
        ? { draft_id: draft.draft_id, status: draft.status, title: draft.title, article_markdown: draft.article_markdown }
        : null,
    });
  }

  // Newest first. The audit log holds ids and outcomes only: no message text, no sender, no customer ref.
  const feed = (await storage.listAudit())
    .slice()
    .reverse()
    .slice(0, FEED_LIMIT)
    .map((e) => ({ event_id: e.event_id, type: e.type, company_id: e.company_id, detail: e.detail, created_at: e.created_at }));

  return respond(200, true, {
    counts: { reports: reportRecords, cases: cases.length, outbreaks: outbreaks.length, alerts: alerts.length },
    outbreaks: cards,
    feed,
  });
}

// ---- POST /v1/demo/reset ------------------------------------------------------------------

export async function handleReset(
  deps: Deps,
  input: { demo_key?: unknown; confirmed?: unknown; idempotency_key?: unknown },
): Promise<ApiResult> {
  if (!demoKeyOk(deps, input.demo_key)) return denied();
  return runWrite(deps, {
    action: "reset",
    company_id: null,
    confirmed: input.confirmed,
    idempotency_key: input.idempotency_key,
    fingerprint: [],
    execute: async () => {
      // Reset exists only for demo data.
      if (deps.env.DEMO_DATA_ONLY !== "true") return fail(403, "RESET_DISABLED");
      await deps.storage.reset();
      await audit(deps, "demo_reset", null, {});
      return respond(200, true, { reset: true });
    },
  });
}

// ---- POST /v1/outbreaks/{id}/draft (Knowledge Loop: a person approves; nothing is published) ------

export async function handleCreateDraft(
  deps: Deps,
  input: { demo_key?: unknown; outbreak_id?: unknown; confirmed?: unknown; idempotency_key?: unknown },
): Promise<ApiResult> {
  if (!demoKeyOk(deps, input.demo_key)) return denied();
  return runWrite(deps, {
    action: "draft",
    company_id: null,
    confirmed: input.confirmed,
    idempotency_key: input.idempotency_key,
    fingerprint: [input.outbreak_id ?? null],
    execute: async () => {
      if (!nonEmpty(input.outbreak_id)) return fail(400, "INVALID_REQUEST", { detail: "outbreak_id is required" });
      const outbreak = await deps.storage.getOutbreak(input.outbreak_id);
      if (!outbreak) return fail(404, "OUTBREAK_NOT_FOUND");
      // A person must approve the outbreak first. A suspected pattern does not get an article yet.
      if (outbreak.status !== "approved") return fail(409, "OUTBREAK_NOT_APPROVED");
      const config = getCompany(outbreak.company_id);
      if (!config) return fail(400, "UNKNOWN_COMPANY");

      // One draft per outbreak. A second request returns the same draft.
      const existing = (await deps.storage.listDrafts()).find((d) => d.outbreak_id === outbreak.outbreak_id);
      if (existing) {
        return respond(200, true, {
          draft_id: existing.draft_id, status: existing.status, title: existing.title,
          article_markdown: existing.article_markdown, published: false, already_exists: true,
        });
      }

      const customers = countDistinctCustomers(await deps.storage.listReports(outbreak.company_id, outbreak.sender_hash));
      const built = buildArticleDraft(config, outbreak, customers);
      const created = {
        draft_id: deps.storage.nextId("DRAFT"),
        outbreak_id: outbreak.outbreak_id,
        company_id: outbreak.company_id,
        status: "draft" as const,
        title: built.title,
        article_markdown: built.markdown,
        created_at: nowOf(deps),
      };
      await deps.storage.saveDraft(created);
      await audit(deps, "knowledge_draft_created", outbreak.company_id, { draft_id: created.draft_id, outbreak_id: outbreak.outbreak_id });
      return respond(200, true, {
        draft_id: created.draft_id, status: created.status, title: created.title,
        article_markdown: created.article_markdown, published: false, already_exists: false,
      });
    },
  });
}

// ---- POST /v1/drafts/{id}/approve -------------------------------------------------------------------

export async function handleApproveDraft(
  deps: Deps,
  input: { demo_key?: unknown; draft_id?: unknown; confirmed?: unknown; idempotency_key?: unknown },
): Promise<ApiResult> {
  if (!demoKeyOk(deps, input.demo_key)) return denied();
  return runWrite(deps, {
    action: "draft_approve",
    company_id: null,
    confirmed: input.confirmed,
    idempotency_key: input.idempotency_key,
    fingerprint: [input.draft_id ?? null],
    execute: async () => {
      if (!nonEmpty(input.draft_id)) return fail(400, "INVALID_REQUEST", { detail: "draft_id is required" });
      const draft = await deps.storage.getDraft(input.draft_id);
      if (!draft) return fail(404, "DRAFT_NOT_FOUND");
      const approved = draft.status === "approved" ? draft : { ...draft, status: "approved" as const, approved_at: nowOf(deps) };
      if (draft.status !== "approved") {
        await deps.storage.saveDraft(approved);
        await audit(deps, "knowledge_draft_approved", draft.company_id, { draft_id: draft.draft_id });
      }
      // Approved is not published. A person uploads the article to eGain knowledge by hand.
      return respond(200, true, {
        draft_id: approved.draft_id,
        status: approved.status,
        article_markdown: approved.article_markdown,
        published: false,
        next_step: "A person uploads this article to eGain knowledge by hand. Nothing is published automatically.",
      });
    },
  });
}
