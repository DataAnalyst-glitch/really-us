import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import approveOutbreak from "../../netlify/functions/approve-outbreak.js";
import consoleState from "../../netlify/functions/console-state.js";
import demoReset from "../../netlify/functions/demo-reset.js";
import draftApprove from "../../netlify/functions/draft-approve.js";
import outbreakDraft from "../../netlify/functions/outbreak-draft.js";
import reports from "../../netlify/functions/reports.js";
import verify from "../../netlify/functions/verify.js";
import { createBlobsStorage } from "../src/blobs-storage.js";
import { forgetStorageForTests, resetStorageForTests, useStorageForTests } from "../src/http.js";
import { hashSender } from "../src/sender.js";
import { fakeBlobStore } from "./fake-blobs.js";

// Calls each Trust Console function handler directly, with storage on the (fake) Blobs adapter.
const API_KEY = "test-api-key";
const DEMO_KEY = "test-demo-key";
const SENDER = "+1 555 0199";
const OB = `OB-northline-${hashSender(SENDER).slice(0, 10)}`;
const demo = { "x-demo-key": DEMO_KEY };

let blobStore = fakeBlobStore();
beforeEach(() => {
  vi.stubEnv("API_KEY", API_KEY);
  vi.stubEnv("DEMO_KEY", DEMO_KEY);
  vi.stubEnv("DEMO_DATA_ONLY", "true");
  blobStore = fakeBlobStore();
  useStorageForTests(createBlobsStorage(blobStore));
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetStorageForTests();
});

function req(method: string, path: string, opts: { body?: unknown; raw?: string; headers?: Record<string, string> } = {}) {
  const init: RequestInit = { method, headers: { "content-type": "application/json", ...opts.headers } };
  if (method !== "GET") init.body = opts.raw ?? JSON.stringify(opts.body ?? {});
  return new Request("https://example.test" + path, init);
}
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;
const ctx = (params: Record<string, string> = {}) => ({ params });

function expectSafe(body: Record<string, unknown>, error: string) {
  expect(body.success).toBe(false);
  expect(body.error).toBe(error);
  expect(JSON.stringify(body)).not.toMatch(/stack|node_modules|\.ts:/i);
}

async function threeReports() {
  for (const c of ["C1", "C2", "C3"]) {
    const res = await reports(
      req("POST", "/v1/reports", {
        headers: { "x-api-key": API_KEY },
        body: { company_id: "northline", sender: SENDER, customer_ref: c, confirmed: true, idempotency_key: `r-${c}` },
      }),
      ctx(),
    );
    expect(res.status).toBe(200);
  }
}
const approve = () =>
  approveOutbreak(req("POST", "/x", { headers: demo, body: { confirmed: true, idempotency_key: "a1" } }), ctx({ id: OB }));

describe("GET /v1/console/state", () => {
  it("success: 200, success true, counts, outbreaks, feed", async () => {
    await threeReports();
    const res = await consoleState(req("GET", "/v1/console/state", { headers: demo }), ctx());
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.counts).toEqual({ reports: 3, cases: 0, outbreaks: 1, alerts: 0 });
    expect((body.outbreaks as unknown[]).length).toBe(1);
    expect(Array.isArray(body.feed)).toBe(true);
  });

  it.each([
    ["no key", {}],
    ["wrong key", { "x-demo-key": "nope" }],
    ["the API key", { "x-api-key": API_KEY }],
  ])("%s: 401", async (_n, headers) => {
    const res = await consoleState(req("GET", "/v1/console/state", { headers }), ctx());
    expect(res.status).toBe(401);
    const body = await json(res);
    expectSafe(body, "DEMO_KEY_REQUIRED");
    expect(body.counts).toBeUndefined();
  });

  it("wrong method: 405", async () => {
    const res = await consoleState(req("POST", "/v1/console/state", { headers: demo }), ctx());
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");
    expectSafe(await json(res), "METHOD_NOT_ALLOWED");
  });
});

describe("POST /v1/demo/reset", () => {
  it("success: clears the data through the adapter", async () => {
    await threeReports();
    const res = await demoReset(req("POST", "/v1/demo/reset", { headers: demo, body: { confirmed: true, idempotency_key: "reset-1" } }), ctx());
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ success: true, reset: true });
    const view = createBlobsStorage(blobStore);
    expect(await view.listOutbreaks()).toHaveLength(0);
    expect(await view.listReports("northline")).toHaveLength(0);
  });

  it("bad JSON: 400", async () => {
    const res = await demoReset(req("POST", "/v1/demo/reset", { headers: demo, raw: "{nope" }), ctx());
    expect(res.status).toBe(400);
    expectSafe(await json(res), "INVALID_JSON");
  });

  it("wrong method: 405", async () => {
    const res = await demoReset(req("GET", "/v1/demo/reset", { headers: demo }), ctx());
    expect(res.status).toBe(405);
    expectSafe(await json(res), "METHOD_NOT_ALLOWED");
  });

  it("missing field: 400 and nothing is cleared", async () => {
    await threeReports();
    const res = await demoReset(req("POST", "/v1/demo/reset", { headers: demo, body: { idempotency_key: "x" } }), ctx());
    expect(res.status).toBe(400);
    expectSafe(await json(res), "CONFIRMATION_REQUIRED");
    expect(await createBlobsStorage(blobStore).listOutbreaks()).toHaveLength(1);
  });

  it.each([
    ["no key", {}],
    ["wrong key", { "x-demo-key": "nope" }],
  ])("%s: 401 and nothing is cleared", async (_n, headers) => {
    await threeReports();
    const res = await demoReset(req("POST", "/v1/demo/reset", { headers, body: { confirmed: true, idempotency_key: "x" } }), ctx());
    expect(res.status).toBe(401);
    expectSafe(await json(res), "DEMO_KEY_REQUIRED");
    expect(await createBlobsStorage(blobStore).listOutbreaks()).toHaveLength(1);
  });
});

describe("POST /v1/outbreaks/:id/draft and /v1/drafts/:id/approve", () => {
  const draftReq = (headers: Record<string, string>, body: unknown = { confirmed: true, idempotency_key: "d1" }) =>
    outbreakDraft(req("POST", "/x", { headers, body }), ctx({ id: OB }));

  it("end to end: three reports, approve, draft, approve draft; nothing is published", async () => {
    await threeReports();
    expect((await draftReq(demo)).status).toBe(409); // not approved yet
    expect((await approve()).status).toBe(200);

    const draft = await draftReq(demo);
    expect(draft.status).toBe(200);
    const d = await json(draft);
    expect(d).toMatchObject({ success: true, status: "draft", published: false });

    const done = await draftApprove(
      req("POST", "/x", { headers: demo, body: { confirmed: true, idempotency_key: "da1" } }),
      ctx({ id: String(d.draft_id) }),
    );
    expect(done.status).toBe(200);
    expect(await json(done)).toMatchObject({ success: true, status: "approved", published: false });

    const state = await json(await consoleState(req("GET", "/v1/console/state", { headers: demo }), ctx()));
    expect(state.counts).toEqual({ reports: 3, cases: 0, outbreaks: 1, alerts: 1 });
    const card = (state.outbreaks as Array<Record<string, unknown>>)[0]!;
    expect(card.status).toBe("approved");
    expect(card.draft).toMatchObject({ status: "approved" });
  });

  it("draft: bad JSON 400, wrong method 405, missing field 400, bad key 401", async () => {
    await threeReports();
    await approve();
    expectSafe(await json(await outbreakDraft(req("POST", "/x", { headers: demo, raw: "[" }), ctx({ id: OB }))), "INVALID_JSON");
    expect((await outbreakDraft(req("GET", "/x", { headers: demo }), ctx({ id: OB }))).status).toBe(405);
    const missing = await draftReq(demo, { idempotency_key: "d9" });
    expect(missing.status).toBe(400);
    expectSafe(await json(missing), "CONFIRMATION_REQUIRED");
    const bad = await draftReq({ "x-demo-key": "nope" });
    expect(bad.status).toBe(401);
    expect(await createBlobsStorage(blobStore).listDrafts()).toHaveLength(0);
  });

  it("draft approve: bad JSON 400, wrong method 405, missing field 400, bad key 401, unknown 404", async () => {
    const call = (r: Request, id = "DRAFT-x") => draftApprove(r, ctx({ id }));
    expectSafe(await json(await call(req("POST", "/x", { headers: demo, raw: "oops" }))), "INVALID_JSON");
    expect((await call(req("GET", "/x", { headers: demo }))).status).toBe(405);
    expectSafe(await json(await call(req("POST", "/x", { headers: demo, body: { idempotency_key: "k" } }))), "CONFIRMATION_REQUIRED");
    expect((await call(req("POST", "/x", { headers: { "x-demo-key": "nope" }, body: { confirmed: true, idempotency_key: "k" } }))).status).toBe(401);
    expect((await call(req("POST", "/x", { headers: demo, body: { confirmed: true, idempotency_key: "k" } }))).status).toBe(404);
  });
});

describe("storage choice", () => {
  it("STORAGE_BACKEND=blobs without a Blobs environment fails safely, with no silent fallback to memory", async () => {
    forgetStorageForTests();
    vi.stubEnv("STORAGE_BACKEND", "blobs");
    vi.stubEnv("NETLIFY_BLOBS_CONTEXT", "");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await verify(req("POST", "/v1/verify", { body: { company_id: "northline", message: "Hello." } }), ctx());
    expect(res.status).toBe(500);
    expectSafe(await json(res), "SERVER_ERROR");
    spy.mockRestore();
  });

  it("STORAGE_BACKEND=memory uses memory", async () => {
    forgetStorageForTests();
    vi.stubEnv("STORAGE_BACKEND", "memory");
    const res = await verify(req("POST", "/v1/verify", { body: { company_id: "northline", message: "Hello." } }), ctx());
    expect(res.status).toBe(200);
  });
});
