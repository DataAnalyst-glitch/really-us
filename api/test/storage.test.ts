import { describe, expect, it } from "vitest";
import { createBlobsStorage, type BlobStoreLike } from "../src/blobs-storage.js";
import { handleApproveOutbreak, handleCase, handleReport, handleVerify, type Deps } from "../src/handlers.js";
import { hashSender } from "../src/sender.js";
import { createMemoryStorage } from "../src/storage.js";
import type { Storage } from "../src/types.js";

// A fake Blobs store. A second adapter over the same fake store models a new serverless invocation.
export function fakeBlobStore(): BlobStoreLike {
  const data = new Map<string, string>();
  return {
    async get(key) {
      const v = data.get(key);
      return v === undefined ? null : JSON.parse(v);
    },
    async setJSON(key, value) {
      data.set(key, JSON.stringify(value));
    },
    async delete(key) {
      data.delete(key);
    },
    async list(options) {
      const prefix = options?.prefix ?? "";
      return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })) };
    },
  };
}

const NOW = "2026-11-09T00:00:00.000Z";
const SENDER = "+1 555 0199";
const KEY = "demo-key-for-tests";

const adapters: Array<[string, () => Storage]> = [
  ["memory", () => createMemoryStorage()],
  ["blobs", () => createBlobsStorage(fakeBlobStore())],
];

describe.each(adapters)("storage contract: %s", (_name, make) => {
  it("finds fixture notices", async () => {
    const s = make();
    expect((await s.findNoticeByProofCode("northline", "NP-4821"))?.demo_account).toBe("DEMO-NP-1001");
    expect(await s.findNoticeByProofCode("northline", "NP-0000")).toBeUndefined();
    expect(await s.findNoticeByAccount("examplia_bank", "DEMO-EB-2001")).toBeDefined();
    expect(await s.findNoticeByAccount("northline", "DEMO-EB-2001")).toBeUndefined();
  });

  it("stores and returns idempotency records", async () => {
    const s = make();
    const record = { key: "k/1 odd?", fingerprint: "f", result: { status: 200, body: { success: true, demo_data: true as const } } };
    expect(await s.getIdempotent("k/1 odd?")).toBeUndefined();
    await s.saveIdempotent(record);
    expect(await s.getIdempotent("k/1 odd?")).toEqual(record);
  });

  it("stores reports per company, sender and customer", async () => {
    const s = make();
    const base = { company_id: "northline", sender_hash: "abc123", sender_masked: "+* *** 0199", created_at: NOW };
    await s.addReport({ ...base, report_id: s.nextId("RPT"), customer_ref: "C1" });
    await s.addReport({ ...base, report_id: s.nextId("RPT"), customer_ref: "C2" });
    await s.addReport({ ...base, company_id: "examplia_bank", report_id: s.nextId("RPT"), customer_ref: "C1" });
    expect((await s.findReport("northline", "abc123", "C1"))?.customer_ref).toBe("C1");
    expect(await s.findReport("northline", "abc123", "C9")).toBeUndefined();
    expect(await s.listReports("northline")).toHaveLength(2);
    expect(await s.listReports("northline", "other")).toHaveLength(0);
  });

  it("stores cases, outbreaks, alerts, drafts and audit events, oldest first", async () => {
    const s = make();
    await s.addCase({ case_id: s.nextId("CASE"), company_id: "northline", priority: "P1", reason: "ALREADY_PAID", summary: "x", created_at: NOW });
    await s.addCase({ case_id: s.nextId("CASE"), company_id: "examplia_bank", priority: "P2", reason: "OTHER", summary: "y", created_at: NOW });
    expect(await s.listCases()).toHaveLength(2);
    expect(await s.listCases("northline")).toHaveLength(1);

    const ob = { outbreak_id: "OB-northline-abc", company_id: "northline", sender_hash: "abc", sender_masked: "m", status: "suspected" as const, created_at: NOW };
    await s.saveOutbreak(ob);
    await s.saveOutbreak({ ...ob, status: "approved" });
    expect((await s.getOutbreak("OB-northline-abc"))?.status).toBe("approved");
    expect((await s.findOutbreak("northline", "abc"))?.outbreak_id).toBe("OB-northline-abc");
    expect(await s.listOutbreaks()).toHaveLength(1);

    await s.addAlert({ alert_id: s.nextId("ALERT"), outbreak_id: ob.outbreak_id, company_id: "northline", simulated: true, alert_text: "t", created_at: NOW });
    expect(await s.listAlerts()).toHaveLength(1);

    const draft = { draft_id: s.nextId("DRAFT"), outbreak_id: ob.outbreak_id, company_id: "northline", status: "draft" as const, title: "t", article_markdown: "# t", created_at: NOW };
    await s.saveDraft(draft);
    expect(await s.getDraft(draft.draft_id)).toEqual(draft);
    expect(await s.listDrafts()).toHaveLength(1);

    const ids = [s.nextId("EV"), s.nextId("EV"), s.nextId("EV")];
    for (const event_id of ids) await s.addAudit({ event_id, type: "t", company_id: null, detail: {}, created_at: NOW });
    expect((await s.listAudit()).map((e) => e.event_id)).toEqual(ids);
  });

  it("reset clears everything and keeps the fixture notices", async () => {
    const s = make();
    await s.addCase({ case_id: s.nextId("CASE"), company_id: "northline", priority: "P3", reason: "R", summary: "s", created_at: NOW });
    await s.saveOutbreak({ outbreak_id: "OB-1", company_id: "northline", sender_hash: "h", sender_masked: "m", status: "suspected", created_at: NOW });
    await s.saveIdempotent({ key: "k", fingerprint: "f", result: { status: 200, body: { success: true, demo_data: true } } });
    await s.addAudit({ event_id: s.nextId("EV"), type: "t", company_id: null, detail: {}, created_at: NOW });
    await s.reset();
    expect(await s.listCases()).toHaveLength(0);
    expect(await s.listOutbreaks()).toHaveLength(0);
    expect(await s.listAudit()).toHaveLength(0);
    expect(await s.getIdempotent("k")).toBeUndefined();
    expect(await s.findNoticeByProofCode("northline", "NP-4821")).toBeDefined();
  });
});

describe("persistence through the Blobs adapter (a new adapter over the same store is a new invocation)", () => {
  const depsFor = (storage: Storage): Deps => ({ storage, env: { DEMO_DATA_ONLY: "true", DEMO_KEY: KEY }, now: () => NOW });
  const reportBody = (ref: string, key: string) => ({ company_id: "northline", sender: SENDER, customer_ref: ref, confirmed: true, idempotency_key: key });

  it("a report written by one invocation is idempotent in the next", async () => {
    const store = fakeBlobStore();
    const first = await handleReport(depsFor(createBlobsStorage(store)), reportBody("C1", "k1"));
    const second = await handleReport(depsFor(createBlobsStorage(store)), reportBody("C1", "k1"));
    expect(second).toEqual(first);
    const list = await createBlobsStorage(store).listReports("northline");
    expect(list).toHaveLength(1);
  });

  it("the same key with a different payload is rejected in a later invocation", async () => {
    const store = fakeBlobStore();
    await handleReport(depsFor(createBlobsStorage(store)), reportBody("C1", "k1"));
    const res = await handleReport(depsFor(createBlobsStorage(store)), reportBody("C2", "k1"));
    expect(res.status).toBe(409);
  });

  it("a case persists, and a retry returns the same case", async () => {
    const store = fakeBlobStore();
    const body = { company_id: "northline", priority: "P2", reason: "ALREADY_PAID", summary: "Paid a fake bill.", confirmed: true, idempotency_key: "c1" };
    const a = await handleCase(depsFor(createBlobsStorage(store)), body);
    const b = await handleCase(depsFor(createBlobsStorage(store)), body);
    expect(b).toEqual(a);
    const cases = await createBlobsStorage(store).listCases();
    expect(cases).toHaveLength(1);
    expect(cases[0]?.priority).toBe("P1");
  });

  it("a Proof Code check works on a fresh invocation", async () => {
    const store = fakeBlobStore();
    const res = await handleVerify(depsFor(createBlobsStorage(store)), { company_id: "northline", message: "Your bill is ready.", proof_code: "NP-4821" });
    expect(res.body.verdict).toBe("GENUINE_NOTICE_FOUND");
  });

  it("three distinct customers over three invocations make one outbreak; approval persists once", async () => {
    const store = fakeBlobStore();
    for (const c of ["C1", "C2", "C3"]) await handleReport(depsFor(createBlobsStorage(store)), reportBody(c, `k-${c}`));
    const view = createBlobsStorage(store);
    const outbreaks = await view.listOutbreaks();
    expect(outbreaks).toHaveLength(1);
    expect(outbreaks[0]?.status).toBe("suspected");
    expect(await view.listAlerts()).toHaveLength(0);

    const id = outbreaks[0]!.outbreak_id;
    const approve = { demo_key: KEY, outbreak_id: id, confirmed: true, idempotency_key: "a1" };
    const a = await handleApproveOutbreak(depsFor(createBlobsStorage(store)), approve);
    const b = await handleApproveOutbreak(depsFor(createBlobsStorage(store)), approve);
    expect(a.body.success).toBe(true);
    expect(b).toEqual(a);
    expect((await createBlobsStorage(store).getOutbreak(id))?.status).toBe("approved");
    const alerts = await createBlobsStorage(store).listAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.simulated).toBe(true);
    expect(alerts[0]?.alert_text).toContain("+* *** 0199");
    expect(alerts[0]?.alert_text).not.toContain(hashSender(SENDER));
  });

  it("the same sender reported by one customer many times is still one customer", async () => {
    const store = fakeBlobStore();
    for (let i = 0; i < 4; i++) await handleReport(depsFor(createBlobsStorage(store)), reportBody("C1", `k-${i}`));
    expect(await createBlobsStorage(store).listOutbreaks()).toHaveLength(0);
  });
});
