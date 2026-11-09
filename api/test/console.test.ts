import { describe, expect, it } from "vitest";
import { createBlobsStorage } from "../src/blobs-storage.js";
import { handleApproveDraft, handleConsoleState, handleCreateDraft, handleReset } from "../src/console.js";
import { handleApproveOutbreak, handleReport, handleVerify, type Deps } from "../src/handlers.js";
import { hashSender } from "../src/sender.js";
import { createMemoryStorage } from "../src/storage.js";
import type { Storage } from "../src/types.js";
import { fakeBlobStore } from "./fake-blobs.js";

const KEY = "demo-key-for-tests";
const SENDER = "+1 555 0199";
const OB = `OB-northline-${hashSender(SENDER).slice(0, 10)}`;

type Make = () => { storage: Storage; again: () => Storage };
const makers: Array<[string, Make]> = [
  ["memory", () => { const s = createMemoryStorage(); return { storage: s, again: () => s }; }],
  ["blobs", () => { const b = fakeBlobStore(); return { storage: createBlobsStorage(b), again: () => createBlobsStorage(b) }; }],
];

const depsFor = (storage: Storage, env: Deps["env"] = { DEMO_DATA_ONLY: "true", DEMO_KEY: KEY }): Deps => ({
  storage, env, now: () => "2026-11-09T00:00:00.000Z",
});
const write = (extra: Record<string, unknown> = {}) => ({ demo_key: KEY, confirmed: true, idempotency_key: "k", ...extra });

async function reportThree(storage: Storage) {
  for (const c of ["C1", "C2", "C3"]) {
    const res = await handleReport(depsFor(storage), { company_id: "northline", sender: SENDER, customer_ref: c, confirmed: true, idempotency_key: `r-${c}` });
    expect(res.body.success).toBe(true);
  }
}

describe.each(makers)("Trust Console API: %s", (_name, make) => {
  describe("GET /v1/console/state", () => {
    it.each([["no key", undefined], ["wrong key", "nope"], ["empty key", ""]])("%s: 401 and no data", async (_n, key) => {
      const { storage } = make();
      await reportThree(storage);
      const res = await handleConsoleState(depsFor(storage), { demo_key: key });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.counts).toBeUndefined();
      expect(res.body.outbreaks).toBeUndefined();
    });

    it("rejects every key when DEMO_KEY is not configured", async () => {
      const { storage } = make();
      const res = await handleConsoleState(depsFor(storage, { DEMO_DATA_ONLY: "true" }), { demo_key: "" });
      expect(res.status).toBe(401);
    });

    it("starts with four zero counts, no outbreaks and an empty feed", async () => {
      const { storage } = make();
      const res = await handleConsoleState(depsFor(storage), { demo_key: KEY });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.demo_data).toBe(true);
      expect(res.body.counts).toEqual({ reports: 0, cases: 0, outbreaks: 0, alerts: 0 });
      expect(res.body.outbreaks).toEqual([]);
      expect(res.body.feed).toEqual([]);
    });

    it("shows the outbreak card, counts and a newest-first feed, with no raw sender or customer id", async () => {
      const { storage, again } = make();
      await reportThree(storage);
      await handleVerify(depsFor(storage), { company_id: "northline", message: "Hello there." });
      const res = await handleConsoleState(depsFor(again()), { demo_key: KEY }); // read by a "new invocation"
      expect(res.body.counts).toEqual({ reports: 3, cases: 0, outbreaks: 1, alerts: 0 });
      const cards = res.body.outbreaks as Array<Record<string, unknown>>;
      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({ outbreak_id: OB, status: "suspected", report_count: 3, sender_masked: "+* *** 0199", alert_text: null, draft: null });
      const feed = res.body.feed as Array<{ type: string }>;
      expect(feed[0]?.type).toBe("verify");
      expect(feed.map((e) => e.type)).toContain("outbreak_suspected");
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(SENDER);
      expect(text).not.toContain(hashSender(SENDER));
      expect(text).not.toMatch(/CUST|"C1"/);
    });
  });

  describe("approval, alert and Scam Vaccine text", () => {
    it("approval makes one simulated alert with the masked sender and the real process", async () => {
      const { storage, again } = make();
      await reportThree(storage);
      const before = await handleConsoleState(depsFor(storage), { demo_key: KEY });
      expect(before.body.counts).toMatchObject({ alerts: 0 });
      await handleApproveOutbreak(depsFor(storage), { demo_key: KEY, outbreak_id: OB, confirmed: true, idempotency_key: "a" });
      const res = await handleConsoleState(depsFor(again()), { demo_key: KEY });
      expect(res.body.counts).toMatchObject({ alerts: 1, outbreaks: 1 });
      const card = (res.body.outbreaks as Array<Record<string, unknown>>)[0]!;
      expect(card.status).toBe("approved");
      expect(card.alert_simulated).toBe(true);
      const text = String(card.alert_text);
      expect(text).toContain("+* *** 0199");
      expect(text).toContain("not one of our official senders");
      expect(text).toContain("northline.example");
      expect(text).toContain("Demo fraud desk phone: +1 555 0101");
      expect(text).not.toMatch(/\bsafe\b|get your money back|recover/i);
      expect(text).not.toContain(hashSender(SENDER));
    });
  });

  describe("POST /v1/outbreaks/:id/draft (Knowledge Loop)", () => {
    it("bad key: 401 and nothing is created", async () => {
      const { storage } = make();
      await reportThree(storage);
      const res = await handleCreateDraft(depsFor(storage), write({ demo_key: "nope", outbreak_id: OB }));
      expect(res.status).toBe(401);
      expect(await storage.listDrafts()).toHaveLength(0);
    });

    it("missing confirmed or idempotency key: 400 and nothing is created", async () => {
      const { storage } = make();
      await reportThree(storage);
      await handleApproveOutbreak(depsFor(storage), { demo_key: KEY, outbreak_id: OB, confirmed: true, idempotency_key: "a" });
      expect((await handleCreateDraft(depsFor(storage), write({ outbreak_id: OB, confirmed: undefined }))).body.error).toBe("CONFIRMATION_REQUIRED");
      expect((await handleCreateDraft(depsFor(storage), write({ outbreak_id: OB, idempotency_key: undefined }))).body.error).toBe("IDEMPOTENCY_KEY_REQUIRED");
      expect(await storage.listDrafts()).toHaveLength(0);
    });

    it("unknown outbreak: 404. Suspected (not approved) outbreak: 409 and no draft", async () => {
      const { storage } = make();
      await reportThree(storage);
      expect((await handleCreateDraft(depsFor(storage), write({ outbreak_id: "OB-none" }))).status).toBe(404);
      const res = await handleCreateDraft(depsFor(storage), write({ outbreak_id: OB, idempotency_key: "d0" }));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("OUTBREAK_NOT_APPROVED");
      expect(await storage.listDrafts()).toHaveLength(0);
    });

    it("an approved outbreak gets a draft that is not published, persisted, one per outbreak", async () => {
      const { storage, again } = make();
      await reportThree(storage);
      await handleApproveOutbreak(depsFor(storage), { demo_key: KEY, outbreak_id: OB, confirmed: true, idempotency_key: "a" });
      const res = await handleCreateDraft(depsFor(storage), write({ outbreak_id: OB, idempotency_key: "d1" }));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, status: "draft", published: false, already_exists: false });
      const md = String(res.body.article_markdown);
      expect(md).toContain("+* *** 0199");
      expect(md).toContain("DRAFT");
      expect(md).toContain("northline.example");
      expect(md).toContain("Demo fraud desk phone: +1 555 0101");
      expect(md).not.toMatch(/\bsafe\b|get your money back|recover/i);
      expect(md).not.toContain(hashSender(SENDER));

      const stored = await again().getDraft(String(res.body.draft_id));
      expect(stored?.status).toBe("draft");

      // same key: same result. New key: still the same single draft.
      expect(await handleCreateDraft(depsFor(again()), write({ outbreak_id: OB, idempotency_key: "d1" }))).toEqual(res);
      const other = await handleCreateDraft(depsFor(again()), write({ outbreak_id: OB, idempotency_key: "d2" }));
      expect(other.body.draft_id).toBe(res.body.draft_id);
      expect(other.body.already_exists).toBe(true);
      expect(await again().listDrafts()).toHaveLength(1);
    });
  });

  describe("POST /v1/drafts/:id/approve", () => {
    async function withDraft() {
      const m = make();
      await reportThree(m.storage);
      await handleApproveOutbreak(depsFor(m.storage), { demo_key: KEY, outbreak_id: OB, confirmed: true, idempotency_key: "a" });
      const draft = await handleCreateDraft(depsFor(m.storage), write({ outbreak_id: OB, idempotency_key: "d1" }));
      return { ...m, draft_id: String(draft.body.draft_id) };
    }

    it("bad key: 401 and the draft stays a draft", async () => {
      const { storage, draft_id } = await withDraft();
      const res = await handleApproveDraft(depsFor(storage), write({ demo_key: "nope", draft_id }));
      expect(res.status).toBe(401);
      expect((await storage.getDraft(draft_id))?.status).toBe("draft");
    });

    it("needs confirmed=true: 400 and the draft stays a draft", async () => {
      const { storage, draft_id } = await withDraft();
      const res = await handleApproveDraft(depsFor(storage), write({ draft_id, confirmed: false }));
      expect(res.status).toBe(400);
      expect((await storage.getDraft(draft_id))?.status).toBe("draft");
    });

    it("unknown draft: 404", async () => {
      const { storage } = await withDraft();
      expect((await handleApproveDraft(depsFor(storage), write({ draft_id: "DRAFT-none", idempotency_key: "x" }))).status).toBe(404);
    });

    it("approves once, is idempotent, persists, and still says published: false", async () => {
      const { storage, again, draft_id } = await withDraft();
      const a = await handleApproveDraft(depsFor(storage), write({ draft_id, idempotency_key: "da" }));
      expect(a.body).toMatchObject({ success: true, status: "approved", published: false });
      expect(String(a.body.next_step)).toMatch(/by hand/);
      expect(await handleApproveDraft(depsFor(again()), write({ draft_id, idempotency_key: "da" }))).toEqual(a);
      const stored = await again().getDraft(draft_id);
      expect(stored?.status).toBe("approved");
      expect(stored?.approved_at).toBeDefined();
      const events = (await again().listAudit()).filter((e) => e.type === "knowledge_draft_approved");
      expect(events).toHaveLength(1);
    });

    it("the console shows the draft and its status", async () => {
      const { storage, draft_id } = await withDraft();
      const state = await handleConsoleState(depsFor(storage), { demo_key: KEY });
      const card = (state.body.outbreaks as Array<{ draft: { draft_id: string; status: string } | null }>)[0]!;
      expect(card.draft).toMatchObject({ draft_id, status: "draft" });
    });
  });

  describe("POST /v1/demo/reset", () => {
    it("bad key: 401 and nothing is cleared", async () => {
      const { storage } = make();
      await reportThree(storage);
      const res = await handleReset(depsFor(storage), write({ demo_key: "nope" }));
      expect(res.status).toBe(401);
      expect(await storage.listOutbreaks()).toHaveLength(1);
    });

    it("needs confirmed=true and an idempotency key", async () => {
      const { storage } = make();
      await reportThree(storage);
      expect((await handleReset(depsFor(storage), write({ confirmed: undefined }))).body.error).toBe("CONFIRMATION_REQUIRED");
      expect((await handleReset(depsFor(storage), write({ idempotency_key: "" }))).body.error).toBe("IDEMPOTENCY_KEY_REQUIRED");
      expect(await storage.listOutbreaks()).toHaveLength(1);
    });

    it("is refused unless DEMO_DATA_ONLY is true", async () => {
      const { storage } = make();
      await reportThree(storage);
      const res = await handleReset(depsFor(storage, { DEMO_KEY: KEY }), write());
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(await storage.listOutbreaks()).toHaveLength(1);
    });

    it("returns to the fixture state: zero counts, fixtures still work, one reset event in the feed", async () => {
      const { storage, again } = make();
      await reportThree(storage);
      await handleApproveOutbreak(depsFor(storage), { demo_key: KEY, outbreak_id: OB, confirmed: true, idempotency_key: "a" });
      await handleCreateDraft(depsFor(storage), write({ outbreak_id: OB, idempotency_key: "d1" }));

      const res = await handleReset(depsFor(storage), write({ idempotency_key: "reset-1" }));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, reset: true });

      const state = await handleConsoleState(depsFor(again()), { demo_key: KEY });
      expect(state.body.counts).toEqual({ reports: 0, cases: 0, outbreaks: 0, alerts: 0 });
      expect(state.body.outbreaks).toEqual([]);
      expect((state.body.feed as Array<{ type: string }>).map((e) => e.type)).toEqual(["demo_reset"]);
      expect(await again().listDrafts()).toHaveLength(0);

      // fixtures and the earlier idempotency keys are gone, so the same demo can run again
      const verify = await handleVerify(depsFor(again()), { company_id: "northline", message: "Your bill is ready.", proof_code: "NP-4821" });
      expect(verify.body.verdict).toBe("GENUINE_NOTICE_FOUND");
      await reportThree(again());
      expect((await again().listOutbreaks())).toHaveLength(1);
    });
  });
});
