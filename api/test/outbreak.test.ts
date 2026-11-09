import { describe, expect, it } from "vitest";
import { handleApproveOutbreak, handleSenderLookup } from "../src/handlers.js";
import { hashSender } from "../src/sender.js";
import { DEMO_KEY, report, setup, verify } from "./helpers.js";

const SCAM_SENDER = "+1 555 0199";

describe("T10 three distinct customers, same sender", () => {
  it("suspects an outbreak on the third distinct customer only", async () => {
    const { deps, storage } = setup();
    const a = await report(deps, { customer_ref: "CUST-1" });
    const b = await report(deps, { customer_ref: "CUST-2", sender: "+15550199" }); // same sender, other format
    expect(a.body.outbreak_status).toBe("none");
    expect(b.body.outbreak_status).toBe("none");
    expect(await storage.listOutbreaks()).toHaveLength(0);

    const c = await report(deps, { customer_ref: "CUST-3", sender: "+1 (555) 0199" });
    expect(c.body.outbreak_status).toBe("suspected");
    expect(c.body.report_count).toBe(3);
    const outbreaks = await storage.listOutbreaks("northline");
    expect(outbreaks).toHaveLength(1);
    expect(outbreaks[0]?.status).toBe("suspected");
  });

  it("the sender is stored as a hash plus a masked display, never raw", async () => {
    const { deps, storage } = setup();
    await report(deps, { customer_ref: "CUST-1" });
    const [stored] = await storage.listReports("northline");
    expect(stored?.sender_hash).toBe(hashSender(SCAM_SENDER));
    expect(stored?.sender_masked).toBe("+* *** 0199");
    expect(JSON.stringify(stored)).not.toContain("555 0199");
  });

  it("sender lookup and verify show the count, but no warning while the outbreak is only suspected", async () => {
    const { deps } = setup();
    for (const c of ["CUST-1", "CUST-2", "CUST-3"]) await report(deps, { customer_ref: c });
    const hash = hashSender(SCAM_SENDER);
    const lookup = await handleSenderLookup(deps, { company_id: "northline", sender_hash: hash });
    expect(lookup.body.report_count).toBe(3);
    expect(lookup.body.status).toBe("outbreak_suspected");
    expect(lookup.body.warning).toBeNull();
    const v = await verify(deps, { message: "Hello there.", sender: SCAM_SENDER });
    expect(v.body.sender_hash).toBe(hash);
    expect(v.body.report_count).toBe(3);
    expect(v.body.warning).toBeNull();
    expect(JSON.stringify(v.body)).not.toMatch(/Several customers have reported/);
  });

  it("after a person approves the outbreak, verify and sender lookup return the warning", async () => {
    const { deps } = setup();
    for (const c of ["CUST-1", "CUST-2", "CUST-3"]) await report(deps, { customer_ref: c });
    const hash = hashSender(SCAM_SENDER);
    const outbreakId = `OB-northline-${hash.slice(0, 10)}`;
    const approve = await handleApproveOutbreak(deps, { demo_key: DEMO_KEY, outbreak_id: outbreakId, confirmed: true, idempotency_key: "approve-w" });
    expect(approve.body.success).toBe(true);

    const lookup = await handleSenderLookup(deps, { company_id: "northline", sender_hash: hash });
    expect(lookup.body.status).toBe("outbreak_approved");
    expect(lookup.body.warning).toBe("Several customers have reported this sender. Treat it with care.");
    const v = await verify(deps, { message: "Hello there.", sender: SCAM_SENDER });
    expect(v.body.warning).toBe("Several customers have reported this sender. Treat it with care.");
    // the verdict itself is not affected by the warning
    expect(v.body.verdict).toBe("NO_MATCHING_NOTICE");
  });

  it("a sender with no outbreak, and an official sender, never get a warning", async () => {
    const { deps } = setup();
    await report(deps, { customer_ref: "CUST-1" });
    expect((await verify(deps, { message: "Hello there.", sender: SCAM_SENDER })).body.warning).toBeNull();
    expect((await verify(deps, { message: "Hello there.", sender: "NLPOWER" })).body.warning).toBeNull();
  });
});

describe("T11 same customer reports three times", () => {
  it("counts one customer and raises no outbreak", async () => {
    const { deps, storage } = setup();
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await report(deps, { customer_ref: "CUST-1" }));
    expect(results.map((r) => r.body.report_count)).toEqual([1, 1, 1]);
    expect(results.every((r) => r.body.outbreak_status === "none")).toBe(true);
    expect(await storage.listOutbreaks()).toHaveLength(0);
    expect(await storage.listReports("northline")).toHaveLength(1);
  });
});

describe("T12 official sender reported", () => {
  it.each(["NLPOWER", "nlpower", "notices@northline.example", "+1 555 0100", "+15550101"])(
    "%s never enters an outbreak",
    async (sender) => {
      const { deps, storage } = setup();
      let last;
      for (const c of ["C1", "C2", "C3", "C4", "C5"]) last = await report(deps, { sender, customer_ref: c });
      expect(last?.body.outbreak_status).toBe("none");
      expect(await storage.listOutbreaks()).toHaveLength(0);
      const lookup = await handleSenderLookup(deps, { company_id: "northline", sender_hash: hashSender(sender) });
      expect(lookup.body.status).toBe("official");
      expect(lookup.body.warning).toBeNull();
    },
  );
});

describe("T13 alert before approval", () => {
  async function suspectedOutbreak() {
    const ctx = setup();
    for (const c of ["CUST-1", "CUST-2", "CUST-3"]) await report(ctx.deps, { customer_ref: c });
    const [outbreak] = await ctx.storage.listOutbreaks();
    return { ...ctx, id: outbreak!.outbreak_id };
  }

  it("alert count is 0 until a human approves", async () => {
    const { storage } = await suspectedOutbreak();
    expect(await storage.listAlerts()).toHaveLength(0);
  });

  it("approval without the demo key is rejected and sends nothing", async () => {
    const { deps, storage, id } = await suspectedOutbreak();
    for (const demo_key of [undefined, "wrong"]) {
      const res = await handleApproveOutbreak(deps, { demo_key, outbreak_id: id, confirmed: true, idempotency_key: "ap-1" });
      expect(res.status).toBe(401);
    }
    expect(await storage.listAlerts()).toHaveLength(0);
    expect((await storage.getOutbreak(id))?.status).toBe("suspected");
  });

  it("approval needs confirmed=true and an idempotency_key", async () => {
    const { deps, storage, id } = await suspectedOutbreak();
    const a = await handleApproveOutbreak(deps, { demo_key: DEMO_KEY, outbreak_id: id, idempotency_key: "ap-1" });
    const b = await handleApproveOutbreak(deps, { demo_key: DEMO_KEY, outbreak_id: id, confirmed: true });
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
    expect(await storage.listAlerts()).toHaveLength(0);
  });

  it("approval creates exactly one simulated alert, even when repeated", async () => {
    const { deps, storage, id } = await suspectedOutbreak();
    const ok = { demo_key: DEMO_KEY, outbreak_id: id, confirmed: true };
    const first = await handleApproveOutbreak(deps, { ...ok, idempotency_key: "ap-1" });
    await handleApproveOutbreak(deps, { ...ok, idempotency_key: "ap-1" });
    await handleApproveOutbreak(deps, { ...ok, idempotency_key: "ap-2" });
    expect(first.body.alerted_simulated).toBe(true);
    const alerts = await storage.listAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.simulated).toBe(true);
    expect((await storage.getOutbreak(id))?.status).toBe("approved");
  });

  it("an unknown outbreak id is a 404 and sends nothing", async () => {
    const { deps, storage } = setup();
    const res = await handleApproveOutbreak(deps, { demo_key: DEMO_KEY, outbreak_id: "OB-none", confirmed: true, idempotency_key: "ap-9" });
    expect(res.status).toBe(404);
    expect(await storage.listAlerts()).toHaveLength(0);
  });
});

describe("outbreak counts are separate for each company", () => {
  it("customers reported at different companies are not added together", async () => {
    const { deps, storage } = setup();
    await report(deps, { company_id: "northline", customer_ref: "CUST-1" });
    await report(deps, { company_id: "northline", customer_ref: "CUST-2" });
    const bank = await report(deps, { company_id: "examplia_bank", customer_ref: "CUST-3" });
    expect(bank.body.report_count).toBe(1);
    expect(bank.body.outbreak_status).toBe("none");
    expect(await storage.listOutbreaks()).toHaveLength(0);
  });

  it("an outbreak at one company does not appear at another", async () => {
    const { deps, storage } = setup();
    for (const c of ["CUST-1", "CUST-2", "CUST-3"]) await report(deps, { company_id: "examplia_bank", customer_ref: c });
    expect(await storage.listOutbreaks("examplia_bank")).toHaveLength(1);
    expect(await storage.listOutbreaks("northline")).toHaveLength(0);
    expect(await storage.listOutbreaks("examplia_mobile")).toHaveLength(0);

    const hash = hashSender(SCAM_SENDER);
    const bank = await handleSenderLookup(deps, { company_id: "examplia_bank", sender_hash: hash });
    const north = await handleSenderLookup(deps, { company_id: "northline", sender_hash: hash });
    expect(bank.body.report_count).toBe(3);
    expect(bank.body.status).toBe("outbreak_suspected");
    expect(north.body.report_count).toBe(0);
    expect(north.body.status).toBe("none");
  });

  it("a sender that is official for one company is still counted at another", async () => {
    const { deps, storage } = setup();
    // "+1 555 0100" is Northline's official support phone, but not an official sender for Examplia Bank.
    for (const c of ["C1", "C2", "C3"]) await report(deps, { company_id: "examplia_bank", sender: "+1 555 0100", customer_ref: c });
    expect(await storage.listOutbreaks("examplia_bank")).toHaveLength(1);
  });
});
