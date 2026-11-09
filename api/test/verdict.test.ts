import { describe, expect, it } from "vitest";
import { northline } from "../src/companies/northline.js";
import { decideVerdict, detectScamSigns } from "../src/verdict.js";
import type { DetectedSignal, ProofState } from "../src/types.js";

// Pure rule tests: no storage, no handlers.
const signal: DetectedSignal = { id: "x", reason: "It asks for a one-time password, PIN, card number or bank login." };

describe("decideVerdict rule order", () => {
  const table: Array<[string, { signals: DetectedSignal[]; proof: ProofState; accountNotice: boolean }, string]> = [
    ["nothing at all", { signals: [], proof: "absent", accountNotice: false }, "NO_MATCHING_NOTICE"],
    ["scam signs only", { signals: [signal], proof: "absent", accountNotice: false }, "MATCHES_SCAM_SIGNS"],
    ["account notice only", { signals: [], proof: "absent", accountNotice: true }, "GENUINE_NOTICE_FOUND"],
    ["valid code only", { signals: [], proof: "valid", accountNotice: false }, "GENUINE_NOTICE_FOUND"],
    ["scam signs + account notice", { signals: [signal], proof: "absent", accountNotice: true }, "MATCHES_SCAM_SIGNS"],
    ["scam signs + valid code", { signals: [signal], proof: "valid", accountNotice: false }, "MATCHES_SCAM_SIGNS"],
    ["scam signs + valid code + notice", { signals: [signal], proof: "valid", accountNotice: true }, "MATCHES_SCAM_SIGNS"],
    ["invalid code, no signs", { signals: [], proof: "invalid", accountNotice: false }, "NO_MATCHING_NOTICE"],
    ["invalid code + account notice", { signals: [], proof: "invalid", accountNotice: true }, "NO_MATCHING_NOTICE"],
    ["invalid code + signs", { signals: [signal], proof: "invalid", accountNotice: false }, "MATCHES_SCAM_SIGNS"],
    ["invalid code + signs + notice", { signals: [signal], proof: "invalid", accountNotice: true }, "MATCHES_SCAM_SIGNS"],
  ];

  it.each(table)("%s", (_name, facts, expected) => {
    const result = decideVerdict(northline, facts);
    expect(result.verdict).toBe(expected);
    expect(result.reasons).toHaveLength(3);
    expect(new Set(result.reasons).size).toBe(3);
    expect(JSON.stringify(result)).not.toMatch(/\bsafe\b/i);
  });

  it("is deterministic: same facts, same answer", () => {
    const facts = { signals: [signal], proof: "valid" as const, accountNotice: true };
    expect(decideVerdict(northline, facts)).toEqual(decideVerdict(northline, facts));
  });
});

describe("detectScamSigns", () => {
  it("finds nothing in a plain message with an official link and official phone", () => {
    const found = detectScamSigns(northline, "Your bill is ready at northline.example. Questions? Call +1 555 0100.");
    expect(found).toEqual([]);
  });

  it("flags unofficial links and phone numbers", () => {
    const ids = detectScamSigns(northline, "Call 0412 555 019 or visit bit.ly/pay").map((s) => s.id);
    expect(ids).toEqual(["unofficial_link", "unofficial_phone"]);
  });

  it("flags a look-alike domain", () => {
    const ids = detectScamSigns(northline, "Pay at northline.example.pay-now.com").map((s) => s.id);
    expect(ids).toContain("unofficial_link");
  });
});
