import { beforeEach, describe, expect, it, vi } from "vitest";
import approve from "../../netlify/functions/approve-outbreak.js";
import cases from "../../netlify/functions/cases.js";
import reports from "../../netlify/functions/reports.js";
import senders from "../../netlify/functions/senders.js";
import verify from "../../netlify/functions/verify.js";
import { resetStorageForTests } from "../src/http.js";
import { hashSender } from "../src/sender.js";
import { cleanNorthline, scamNorthline } from "./helpers.js";

// Calls each Netlify function handler directly with a standard Request.
const API_KEY = "test-api-key";
const DEMO_KEY = "test-demo-key";
const URL_BASE = "https://example.test";
const SENDER = "+1 555 0199";

beforeEach(() => {
  vi.stubEnv("API_KEY", API_KEY);
  vi.stubEnv("DEMO_KEY", DEMO_KEY);
  vi.stubEnv("DEMO_DATA_ONLY", "true");
  resetStorageForTests();
});

function req(method: string, path: string, opts: { body?: unknown; raw?: string; headers?: Record<string, string> } = {}) {
  const init: RequestInit = { method, headers: { "content-type": "application/json", ...opts.headers } };
  if (method !== "GET") init.body = opts.raw ?? JSON.stringify(opts.body ?? {});
  return new Request(URL_BASE + path, init);
}
const readJson = async (res: Response) => (await res.json()) as Record<string, unknown>;

function expectSafeError(body: Record<string, unknown>, error: string) {
  expect(body.success).toBe(false);
  expect(body.error).toBe(error);
  expect(JSON.stringify(body)).not.toMatch(/stack|at .*\(|node_modules|\.ts:/i);
}

describe("POST /v1/verify", () => {
  it("success: 200 with success true and a verdict", async () => {
    const res = await verify(req("POST", "/v1/verify", { body: { company_id: "northline", message: cleanNorthline } }), { params: {} });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.demo_data).toBe(true);
    expect(body.verdict).toBe("NO_MATCHING_NOTICE");
  });

  it("scam text gives MATCHES_SCAM_SIGNS with no key needed", async () => {
    const res = await verify(req("POST", "/v1/verify", { body: { company_id: "northline", message: scamNorthline } }), { params: {} });
    expect((await readJson(res)).verdict).toBe("MATCHES_SCAM_SIGNS");
  });

  it("bad JSON: 400 INVALID_JSON", async () => {
    const res = await verify(req("POST", "/v1/verify", { raw: "{not json" }), { params: {} });
    expect(res.status).toBe(400);
    expectSafeError(await readJson(res), "INVALID_JSON");
  });

  it("wrong method: 405", async () => {
    const res = await verify(req("GET", "/v1/verify"), { params: {} });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
    expectSafeError(await readJson(res), "METHOD_NOT_ALLOWED");
  });

  it("missing field: 400 and no verdict", async () => {
    const res = await verify(req("POST", "/v1/verify", { body: { company_id: "northline" } }), { params: {} });
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.success).toBe(false);
    expect(body.verdict).toBeUndefined();
  });

  it("TESTFAIL: 500 success false and no verdict", async () => {
    const res = await verify(req("POST", "/v1/verify", { body: { company_id: "TESTFAIL", message: "hi" } }), { params: {} });
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.success).toBe(false);
    expect(body.verdict).toBeUndefined();
  });
});

describe("GET /v1/senders/:hash", () => {
  const hash = hashSender(SENDER);

  it("success: 200 with success true", async () => {
    const res = await senders(req("GET", `/v1/senders/${hash}?company_id=northline`), { params: { hash } });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.report_count).toBe(0);
  });

  it("wrong method: 405", async () => {
    const res = await senders(req("POST", `/v1/senders/${hash}`), { params: { hash } });
    expect(res.status).toBe(405);
    expectSafeError(await readJson(res), "METHOD_NOT_ALLOWED");
  });

  it("missing company_id: 400", async () => {
    const res = await senders(req("GET", `/v1/senders/${hash}`), { params: { hash } });
    expect(res.status).toBe(400);
    expect((await readJson(res)).success).toBe(false);
  });
});

describe("POST /v1/reports (API key)", () => {
  const good = { company_id: "northline", sender: SENDER, customer_ref: "CUST-1", confirmed: true, idempotency_key: "k-report-1" };
  const auth = { "x-api-key": API_KEY };

  it("success: 200 with success true", async () => {
    const res = await reports(req("POST", "/v1/reports", { body: good, headers: auth }), { params: {} });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.report_count).toBe(1);
  });

  it("same idempotency key returns the same report", async () => {
    const a = await readJson(await reports(req("POST", "/v1/reports", { body: good, headers: auth }), { params: {} }));
    const b = await readJson(await reports(req("POST", "/v1/reports", { body: good, headers: auth }), { params: {} }));
    expect(b.report_id).toBe(a.report_id);
  });

  it("bad JSON: 400", async () => {
    const res = await reports(req("POST", "/v1/reports", { raw: "oops", headers: auth }), { params: {} });
    expect(res.status).toBe(400);
    expectSafeError(await readJson(res), "INVALID_JSON");
  });

  it("wrong method: 405", async () => {
    const res = await reports(req("GET", "/v1/reports", { headers: auth }), { params: {} });
    expect(res.status).toBe(405);
    expectSafeError(await readJson(res), "METHOD_NOT_ALLOWED");
  });

  it("missing field: 400 (confirmed) and nothing is written", async () => {
    const { confirmed: _c, ...noConfirm } = good;
    const res = await reports(req("POST", "/v1/reports", { body: noConfirm, headers: auth }), { params: {} });
    expect(res.status).toBe(400);
    expectSafeError(await readJson(res), "CONFIRMATION_REQUIRED");
  });

  it.each([
    ["missing key", {}],
    ["wrong key", { "x-api-key": "nope" }],
  ])("%s: 401 and nothing is written", async (_n, headers) => {
    const res = await reports(req("POST", "/v1/reports", { body: good, headers }), { params: {} });
    expect(res.status).toBe(401);
    expectSafeError(await readJson(res), "API_KEY_REQUIRED");
    // the same request with the right key is the first report, so the rejected one wrote nothing
    const ok = await readJson(await reports(req("POST", "/v1/reports", { body: good, headers: auth }), { params: {} }));
    expect(ok.already_reported).toBe(false);
    expect(ok.report_count).toBe(1);
  });

  it("API_KEY not configured: every request is rejected", async () => {
    vi.stubEnv("API_KEY", "");
    const res = await reports(req("POST", "/v1/reports", { body: good, headers: { "x-api-key": "" } }), { params: {} });
    expect(res.status).toBe(401);
  });
});

describe("POST /v1/cases (API key)", () => {
  const good = {
    company_id: "northline", priority: "P2", reason: "CLICKED_LINK", summary: "Customer clicked a link.",
    confirmed: true, idempotency_key: "k-case-1",
  };
  const auth = { "x-api-key": API_KEY };

  it("success: 200, success true, damage reason forced to P1", async () => {
    const res = await cases(req("POST", "/v1/cases", { body: good, headers: auth }), { params: {} });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.priority).toBe("P1");
  });

  it("bad JSON: 400", async () => {
    const res = await cases(req("POST", "/v1/cases", { raw: "[", headers: auth }), { params: {} });
    expect(res.status).toBe(400);
    expectSafeError(await readJson(res), "INVALID_JSON");
  });

  it("wrong method: 405", async () => {
    const res = await cases(req("GET", "/v1/cases", { headers: auth }), { params: {} });
    expect(res.status).toBe(405);
    expectSafeError(await readJson(res), "METHOD_NOT_ALLOWED");
  });

  it("missing field: 400 (idempotency_key)", async () => {
    const { idempotency_key: _k, ...noKey } = good;
    const res = await cases(req("POST", "/v1/cases", { body: noKey, headers: auth }), { params: {} });
    expect(res.status).toBe(400);
    expectSafeError(await readJson(res), "IDEMPOTENCY_KEY_REQUIRED");
  });

  it("bad key: 401", async () => {
    const res = await cases(req("POST", "/v1/cases", { body: good, headers: { "x-api-key": "nope" } }), { params: {} });
    expect(res.status).toBe(401);
    expectSafeError(await readJson(res), "API_KEY_REQUIRED");
  });
});

describe("POST /v1/outbreaks/:id/approve (demo key)", () => {
  const params = { id: "OB-missing" };
  const good = { confirmed: true, idempotency_key: "k-approve-1" };
  const auth = { "x-demo-key": DEMO_KEY };

  it("success: a suspected outbreak is approved with 200 and success true", async () => {
    const reportAuth = { "x-api-key": API_KEY };
    let outbreak_id = "";
    for (const c of ["C1", "C2", "C3"]) {
      const r = await readJson(
        await reports(
          req("POST", "/v1/reports", {
            body: { company_id: "northline", sender: SENDER, customer_ref: c, confirmed: true, idempotency_key: `k-${c}` },
            headers: reportAuth,
          }),
          { params: {} },
        ),
      );
      expect(r.success).toBe(true);
    }
    outbreak_id = `OB-northline-${hashSender(SENDER).slice(0, 10)}`;
    const res = await approve(req("POST", `/v1/outbreaks/${outbreak_id}/approve`, { body: good, headers: auth }), { params: { id: outbreak_id } });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.alerted_simulated).toBe(true);
  });

  it("unknown outbreak: 404", async () => {
    const res = await approve(req("POST", "/x", { body: good, headers: auth }), { params });
    expect(res.status).toBe(404);
    expectSafeError(await readJson(res), "OUTBREAK_NOT_FOUND");
  });

  it("bad JSON: 400", async () => {
    const res = await approve(req("POST", "/x", { raw: "}", headers: auth }), { params });
    expect(res.status).toBe(400);
    expectSafeError(await readJson(res), "INVALID_JSON");
  });

  it("wrong method: 405", async () => {
    const res = await approve(req("GET", "/x", { headers: auth }), { params });
    expect(res.status).toBe(405);
    expectSafeError(await readJson(res), "METHOD_NOT_ALLOWED");
  });

  it("missing field: 400 (confirmed)", async () => {
    const res = await approve(req("POST", "/x", { body: { idempotency_key: "k" }, headers: auth }), { params });
    expect(res.status).toBe(400);
    expectSafeError(await readJson(res), "CONFIRMATION_REQUIRED");
  });

  it.each([
    ["missing key", {}],
    ["wrong key", { "x-demo-key": "nope" }],
  ])("%s: 401", async (_n, headers) => {
    const res = await approve(req("POST", "/x", { body: good, headers }), { params });
    expect(res.status).toBe(401);
    expectSafeError(await readJson(res), "DEMO_KEY_REQUIRED");
  });
});

describe("unexpected errors are safe", () => {
  it("a handler crash returns 500 SERVER_ERROR with no stack trace", async () => {
    const { serve } = await import("../src/http.js");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await serve(req("POST", "/x"), {}, {
      method: "POST",
      run: async () => {
        throw new Error("secret internal detail at C:\\path\\file.ts:12");
      },
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    expectSafeError(JSON.parse(text), "SERVER_ERROR");
    expect(text).not.toContain("secret internal detail");
    spy.mockRestore();
  });
});
