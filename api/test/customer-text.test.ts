import { describe, expect, it } from "vitest";
import { buildCustomerText, CUSTOMER_TEXT_MAX, OPENING } from "../src/customer-text.js";
import { cleanNorthline, expectValidVerdictShape, scamBank, scamMobile, scamNorthline, setup, verify } from "./helpers.js";

// customer_text is plain text for eGain chat: no arrays, no markdown, no newlines.
const cases = [
  { verdict: "MATCHES_SCAM_SIGNS", opening: "Don't call or pay yet.", body: { message: scamNorthline } },
  { verdict: "NO_MATCHING_NOTICE", opening: "Don't act on it yet.", body: { message: cleanNorthline } },
  {
    verdict: "GENUINE_NOTICE_FOUND",
    opening: "Good news: this matches a real notice.",
    body: { message: cleanNorthline, demo_account: "DEMO-NP-1001", sender: "NLPOWER" },
  },
] as const;

describe("customer_text on /v1/verify", () => {
  it.each(cases)("$verdict: opening line, numbered reasons, plain text, length limit", async ({ verdict, opening, body }) => {
    const { deps } = setup();
    const res = await verify(deps, { ...body });
    expectValidVerdictShape(res);
    expect(res.body.verdict).toBe(verdict);
    const text = res.body.customer_text as string;
    expect(typeof text).toBe("string");
    expect(text.startsWith(`${opening} Result: `)).toBe(true);
    expect(text).toMatch(/1\) .+ 2\) .+ 3\) .+ Next: /);
    expect(text).not.toMatch(/[[\]]/);
    expect(text).not.toMatch(/[\r\n]/);
    expect(text).not.toMatch(/[*#`_>]/);
    expect(text.length).toBeLessThanOrEqual(CUSTOMER_TEXT_MAX);
    // built from the real reasons and next_step, and the existing fields are still there
    for (const r of res.body.reasons as string[]) expect(text).toContain(r);
    expect(text).toContain(res.body.next_step as string);
    expect(Array.isArray(res.body.reasons)).toBe(true);
  });

  it("a genuine result does not tell the customer to distrust it", async () => {
    const { deps } = setup();
    const res = await verify(deps, { ...cases[2].body });
    const text = (res.body.customer_text as string).toLowerCase();
    // "No scam warning signs were found" is a reassuring reason, so only distrust wording is checked.
    expect(text).not.toMatch(/don't|do not|suspicious|careful|beware|fake/);
  });

  it("never says safe", async () => {
    const { deps } = setup();
    for (const c of cases) {
      const res = await verify(deps, { ...c.body });
      expect(res.body.customer_text as string).not.toMatch(/\bsafe\b/i);
    }
  });

  it("stays under the limit for every company and verdict", async () => {
    const { deps } = setup();
    const checks = [
      { company_id: "northline", message: scamNorthline },
      { company_id: "examplia_bank", message: scamBank },
      { company_id: "examplia_mobile", message: scamMobile },
      { company_id: "examplia_bank", message: "A routine update from us." },
      { company_id: "examplia_mobile", message: "A routine update from us.", demo_account: "DEMO-EM-3001", sender: "EXAMPLIAMOBILE" },
    ];
    for (const c of checks) {
      const res = await verify(deps, c);
      expect((res.body.customer_text as string).length).toBeLessThanOrEqual(CUSTOMER_TEXT_MAX);
    }
  });

  it("is not added to error responses", async () => {
    const { deps } = setup();
    const res = await verify(deps, { company_id: "TESTFAIL", message: "hi" });
    expect(res.body.success).toBe(false);
    expect(res.body.customer_text).toBeUndefined();
  });
});

describe("buildCustomerText", () => {
  it("removes brackets and newlines and holds the limit", () => {
    const long = "word ".repeat(300);
    const text = buildCustomerText("MATCHES_SCAM_SIGNS", ["[a]\nb", "c", "d"], `${long}. Second sentence.`);
    expect(text).not.toMatch(/[[\]\r\n]/);
    expect(text.length).toBeLessThanOrEqual(CUSTOMER_TEXT_MAX);
    expect(text.startsWith(OPENING.MATCHES_SCAM_SIGNS)).toBe(true);
  });
});
