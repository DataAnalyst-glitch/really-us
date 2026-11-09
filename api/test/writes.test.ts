import { describe, expect, it } from "vitest";
import { handleCase } from "../src/handlers.js";
import { report, setup } from "./helpers.js";

const caseBody = (extra: Record<string, unknown> = {}) => ({
  company_id: "northline",
  priority: "P2",
  reason: "SUSPECTED_SCAM",
  summary: "Customer received a message and is unsure.",
  confirmed: true,
  idempotency_key: "case-key-1",
  ...extra,
});

describe("T5 decline report", () => {
  it("no report call means the count is unchanged", async () => {
    const { storage } = setup();
    expect(await storage.listReports("northline")).toHaveLength(0);
  });

  it("confirmed=false is a decline: rejected, nothing stored", async () => {
    const { deps, storage } = setup();
    const res = await report(deps, { confirmed: false });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await storage.listReports("northline")).toHaveLength(0);
  });
});

describe("T6 confirm, then retry with the same key", () => {
  it("stores one report and returns the same record", async () => {
    const { deps, storage } = setup();
    const first = await report(deps, { idempotency_key: "retry-1" });
    const second = await report(deps, { idempotency_key: "retry-1" });
    expect(first.body.success).toBe(true);
    expect(second.body).toEqual(first.body);
    expect(await storage.listReports("northline")).toHaveLength(1);
  });

  it("same key with a different payload is rejected and stores nothing new", async () => {
    const { deps, storage } = setup();
    await report(deps, { idempotency_key: "reuse-1", customer_ref: "CUST-1" });
    const clash = await report(deps, { idempotency_key: "reuse-1", customer_ref: "CUST-2" });
    expect(clash.status).toBe(409);
    expect(clash.body.success).toBe(false);
    expect(clash.body.error).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(clash.body).not.toHaveProperty("report_id");
    expect(await storage.listReports("northline")).toHaveLength(1);
  });

  it("same case key with a different summary is rejected", async () => {
    const { deps, storage } = setup();
    const first = await handleCase(deps, caseBody());
    const same = await handleCase(deps, caseBody());
    const clash = await handleCase(deps, caseBody({ summary: "A different summary." }));
    expect(first.body.success).toBe(true);
    expect(same.body).toEqual(first.body);
    expect(clash.status).toBe(409);
    expect(clash.body).not.toHaveProperty("case_id");
    expect(await storage.listCases()).toHaveLength(1);
  });

  it("a key used for a report cannot be reused for a case", async () => {
    const { deps, storage } = setup();
    await report(deps, { idempotency_key: "shared-key" });
    const clash = await handleCase(deps, caseBody({ idempotency_key: "shared-key" }));
    expect(clash.status).toBe(409);
    expect(await storage.listCases()).toHaveLength(0);
  });
});

describe("T7 write without confirmed=true", () => {
  it.each([
    ["missing", undefined],
    ["false", false],
    ["string 'true'", "true"],
    ["number 1", 1],
  ])("confirmed %s is rejected and nothing is stored", async (_n, confirmed) => {
    const { deps, storage } = setup();
    const r = await report(deps, { confirmed });
    const c = await handleCase(deps, caseBody({ confirmed }));
    for (const res of [r, c]) {
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("CONFIRMATION_REQUIRED");
      expect(res.body).not.toHaveProperty("report_id");
      expect(res.body).not.toHaveProperty("case_id");
    }
    expect(await storage.listReports("northline")).toHaveLength(0);
    expect(await storage.listCases()).toHaveLength(0);
  });

  it("confirmed=true without an idempotency_key is rejected", async () => {
    const { deps, storage } = setup();
    const r = await report(deps, { idempotency_key: undefined });
    const c = await handleCase(deps, caseBody({ idempotency_key: "" }));
    expect(r.status).toBe(400);
    expect(c.status).toBe(400);
    expect(r.body.error).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(await storage.listReports("northline")).toHaveLength(0);
    expect(await storage.listCases()).toHaveLength(0);
  });

  it("rejected writes are recorded in the audit trail", async () => {
    const { deps, storage } = setup();
    await report(deps, { confirmed: false });
    const events = await storage.listAudit();
    expect(events.some((e) => e.type === "write_rejected")).toBe(true);
  });
});

describe("T9 write returns success:false", () => {
  it("TESTFAILWRITE gives an error path with no reference and stores nothing", async () => {
    const { deps, storage } = setup();
    const r = await report(deps, { company_id: "TESTFAILWRITE" });
    const c = await handleCase(deps, caseBody({ company_id: "TESTFAILWRITE" }));
    for (const res of [r, c]) {
      expect(res.body.success).toBe(false);
      expect(res.body).not.toHaveProperty("report_id");
      expect(res.body).not.toHaveProperty("case_id");
      expect(String(res.body.next_step)).toMatch(/support/i);
    }
    expect(await storage.listReports("TESTFAILWRITE")).toHaveLength(0);
    expect(await storage.listCases()).toHaveLength(0);
  });

  it("TESTFAILWRITE does not exist unless DEMO_DATA_ONLY=true", async () => {
    const { deps } = setup({ DEMO_KEY: "x" });
    const res = await report(deps, { company_id: "TESTFAILWRITE" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("UNKNOWN_COMPANY");
  });

  it("a failed write is not cached: the same key can be tried again", async () => {
    const { deps } = setup();
    const failed = await report(deps, { company_id: "TESTFAILWRITE", idempotency_key: "k-fail" });
    expect(failed.body.success).toBe(false);
    const { storage } = deps;
    expect(await storage.getIdempotent("k-fail")).toBeUndefined();
  });
});

describe("T14 already paid", () => {
  it.each(["ALREADY_PAID", "already paid", "SHARED_DETAILS", "CLICKED_LINK"])(
    "reason %s creates a P1 case even if the caller asks for P3",
    async (reason) => {
      const { deps, storage } = setup();
      const res = await handleCase(deps, caseBody({ priority: "P3", reason }));
      expect(res.body.success).toBe(true);
      expect(res.body.priority).toBe("P1");
      const stored = await storage.listCases("northline");
      expect(stored).toHaveLength(1);
      expect(stored[0]?.priority).toBe("P1");
    },
  );

  it("gives the damage path and makes no recovery promise", async () => {
    const { deps } = setup();
    const res = await handleCase(deps, caseBody({ reason: "ALREADY_PAID" }));
    const step = String(res.body.next_step);
    expect(step).toContain("bank or card provider");
    expect(step).toContain("+1 555 0101"); // fraud_reporting from Northline config
    expect(JSON.stringify(res.body)).not.toMatch(/recover|refund|money back|get your money/i);
  });

  it("a normal reason keeps the requested priority", async () => {
    const { deps } = setup();
    const res = await handleCase(deps, caseBody({ priority: "P3" }));
    expect(res.body.priority).toBe("P3");
  });

  it("rejects an invalid priority", async () => {
    const { deps, storage } = setup();
    const res = await handleCase(deps, caseBody({ priority: "P0" }));
    expect(res.status).toBe(400);
    expect(await storage.listCases()).toHaveLength(0);
  });
});
