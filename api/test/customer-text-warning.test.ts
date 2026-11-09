import { describe, expect, it } from "vitest";
import { buildCustomerText, CUSTOMER_TEXT_MAX, OPENING } from "../src/customer-text.js";
import { handleApproveOutbreak, handleReport, type Deps } from "../src/handlers.js";
import { hashSender } from "../src/sender.js";
import { cleanNorthline, DEMO_KEY, scamBank, scamMobile, scamNorthline, setup, verify } from "./helpers.js";

// customer_text carries the outbreak warning only when the API's warning field is non-null,
// and that field is non-null only for an APPROVED outbreak.
const SENDER = "+1 555 0199";
const WARNING = "Several customers have reported this sender. Treat it with care.";
const NOTICE_MSG = "Hello there.";

async function reportThree(deps: Deps, company_id = "northline") {
  for (const c of ["C1", "C2", "C3"]) {
    const res = await handleReport(deps, { company_id, sender: SENDER, customer_ref: c, confirmed: true, idempotency_key: `r-${company_id}-${c}` });
    expect(res.body.success).toBe(true);
  }
}
const approve = (deps: Deps, company_id = "northline") =>
  handleApproveOutbreak(deps, { demo_key: DEMO_KEY, outbreak_id: `OB-${company_id}-${hashSender(SENDER).slice(0, 10)}`, confirmed: true, idempotency_key: `a-${company_id}` });

// customer_text of a verify call with no outbreak anywhere: the baseline that must not change.
async function baseline(message: string, extra: Record<string, unknown> = {}) {
  const { deps } = setup();
  const res = await verify(deps, { message, ...extra });
  expect(res.body.warning).toBeNull();
  return res.body.customer_text as string;
}

describe("customer_text and the approved-outbreak warning", () => {
  it("(a) approved outbreak: customer_text has the warning, right after the opening line", async () => {
    const { deps } = setup();
    await reportThree(deps);
    expect((await approve(deps)).body.success).toBe(true);
    const res = await verify(deps, { message: NOTICE_MSG, sender: SENDER });
    expect(res.body.warning).toBe(WARNING);
    const text = res.body.customer_text as string;
    expect(text.startsWith(`${OPENING.NO_MATCHING_NOTICE} Heads-up: ${WARNING} Result: No matching notice.`)).toBe(true);
    expect(text).toMatch(/1\) .+ 2\) .+ 3\) .+ Next: /);
    expect(text).not.toMatch(/[[\]\r\n]/);
  });

  it("(a) the warning also leads a scam verdict", async () => {
    const { deps } = setup();
    await reportThree(deps);
    await approve(deps);
    const res = await verify(deps, { message: scamNorthline, sender: SENDER });
    expect(res.body.verdict).toBe("MATCHES_SCAM_SIGNS");
    expect((res.body.customer_text as string).startsWith(`${OPENING.MATCHES_SCAM_SIGNS} Heads-up: ${WARNING} Result: Matches scam signs.`)).toBe(true);
  });

  it("(b) suspected outbreak: warning is null and no warning text appears anywhere in the response", async () => {
    const { deps } = setup();
    await reportThree(deps); // third distinct customer makes a suspected outbreak, not approved
    const res = await verify(deps, { message: NOTICE_MSG, sender: SENDER });
    expect(res.body.warning).toBeNull();
    const all = JSON.stringify(res.body);
    expect(all).not.toMatch(/Heads-up|Several customers|Treat it with care/i);
    expect(res.body.customer_text).toBe(await baseline(NOTICE_MSG, { sender: SENDER }));
  });

  it("(c) approved outbreak but no sender sent: customer_text is unchanged", async () => {
    const { deps } = setup();
    await reportThree(deps);
    await approve(deps);
    const res = await verify(deps, { message: NOTICE_MSG });
    expect(res.body.warning).toBeNull();
    expect(res.body.customer_text).toBe(await baseline(NOTICE_MSG));
  });

  it("(c) approved outbreak, a different sender: customer_text is unchanged", async () => {
    const { deps } = setup();
    await reportThree(deps);
    await approve(deps);
    const res = await verify(deps, { message: NOTICE_MSG, sender: "+1 555 0123" });
    expect(res.body.warning).toBeNull();
    expect(res.body.customer_text).toBe(await baseline(NOTICE_MSG));
  });

  it("(d) official sender: customer_text is unchanged", async () => {
    const { deps } = setup();
    await reportThree(deps);
    await approve(deps);
    const res = await verify(deps, { message: NOTICE_MSG, sender: "NLPOWER" });
    expect(res.body.warning).toBeNull();
    expect(res.body.customer_text).toBe(await baseline(NOTICE_MSG));
  });

  it("(e) length is within the cap for every company, verdict and the warning case", async () => {
    const cases = [
      { company_id: "northline", messages: [scamNorthline, cleanNorthline, NOTICE_MSG] },
      { company_id: "examplia_bank", messages: [scamBank, NOTICE_MSG] },
      { company_id: "examplia_mobile", messages: [scamMobile, NOTICE_MSG] },
    ];
    for (const { company_id, messages } of cases) {
      const { deps } = setup();
      await reportThree(deps, company_id);
      await approve(deps, company_id);
      for (const message of messages) {
        for (const extra of [{ sender: SENDER }, {}, { proof_code: company_id === "northline" ? "NP-4821" : undefined, sender: SENDER }]) {
          const res = await verify(deps, { company_id, message, ...extra });
          const text = res.body.customer_text as string;
          expect(text.length).toBeLessThanOrEqual(CUSTOMER_TEXT_MAX);
          if (res.body.warning) expect(text).toContain(`Heads-up: ${WARNING}`);
          else expect(text).not.toContain("Heads-up");
        }
      }
    }
  });
});

describe("buildCustomerText with a warning (unit)", () => {
  const reasons = ["First reason.", "Second reason.", "Third reason."];

  it("no warning, null, undefined or empty: the same text as before", () => {
    const base = buildCustomerText("NO_MATCHING_NOTICE", reasons, "Do this. Then that.");
    expect(base).toBe("Don't act on it yet. Result: No matching notice. 1) First reason. 2) Second reason. 3) Third reason. Next: Do this. Then that.");
    for (const w of [null, undefined, "", "   "]) expect(buildCustomerText("NO_MATCHING_NOTICE", reasons, "Do this. Then that.", w)).toBe(base);
  });

  it("a warning is a marked line after the opening", () => {
    expect(buildCustomerText("NO_MATCHING_NOTICE", reasons, "Do this.", "Be careful")).toBe(
      "Don't act on it yet. Heads-up: Be careful. Result: No matching notice. 1) First reason. 2) Second reason. 3) Third reason. Next: Do this.",
    );
  });

  it("over the cap: next_step is cut first, the warning stays", () => {
    const next = `First sentence. ${"More words here. ".repeat(80)}`;
    const text = buildCustomerText("MATCHES_SCAM_SIGNS", reasons, next, WARNING);
    expect(text.length).toBeLessThanOrEqual(CUSTOMER_TEXT_MAX);
    expect(text).toContain(`Heads-up: ${WARNING}`);
    expect(text.endsWith("Next: First sentence.")).toBe(true);
    expect(text).toContain("3) Third reason.");
  });

  it("still over the cap: the reasons are shortened, the warning and all three numbers stay", () => {
    const long = (w: string) => `${w} ${"very long reason words ".repeat(40)}`;
    const text = buildCustomerText("MATCHES_SCAM_SIGNS", [long("A"), long("B"), long("C")], "Check with us. Then more.", WARNING);
    expect(text.length).toBeLessThanOrEqual(CUSTOMER_TEXT_MAX);
    expect(text.startsWith(`Don't call or pay yet. Heads-up: ${WARNING} Result: Matches scam signs. 1) `)).toBe(true);
    expect(text).toMatch(/1\) .+ 2\) .+ 3\) .+ Next: Check with us\.$/);
    expect(text).not.toMatch(/[[\]\r\n]/);
  });

  it("with no warning and an overlong text, the old behaviour (a plain cut) is kept", () => {
    const long = (w: string) => `${w} ${"very long reason words ".repeat(40)}`;
    const text = buildCustomerText("MATCHES_SCAM_SIGNS", [long("A"), long("B"), long("C")], "Check with us.");
    expect(text).toHaveLength(CUSTOMER_TEXT_MAX);
  });

  it("an extremely long warning is cut so the cap still holds", () => {
    const text = buildCustomerText("NO_MATCHING_NOTICE", reasons, "Do this.", "w ".repeat(2000));
    expect(text.length).toBeLessThanOrEqual(CUSTOMER_TEXT_MAX);
    expect(text).toContain("Heads-up:");
  });
});
