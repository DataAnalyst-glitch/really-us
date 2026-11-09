import { describe, expect, it } from "vitest";
import { northline } from "../src/companies/northline.js";
import { decideVerdict, detectScamSigns } from "../src/verdict.js";
import type { DetectedSignal, ProofState } from "../src/types.js";

// Pure rule tests: no storage, no handlers.
const signal: DetectedSignal = { id: "x", reason: "It asks for a one-time password, PIN, card number or bank login." };

describe("decideVerdict rule order", () => {
  const table: Array<[string, { signals: DetectedSignal[]; proof: ProofState; accountNotice: boolean; senderOfficial: boolean }, string]> = [
    ["nothing at all", { signals: [], proof: "absent", accountNotice: false, senderOfficial: false }, "NO_MATCHING_NOTICE"],
    ["scam signs only", { signals: [signal], proof: "absent", accountNotice: false, senderOfficial: false }, "MATCHES_SCAM_SIGNS"],
    ["account notice, no official sender", { signals: [], proof: "absent", accountNotice: true, senderOfficial: false }, "NO_MATCHING_NOTICE"],
    ["account notice + official sender", { signals: [], proof: "absent", accountNotice: true, senderOfficial: true }, "GENUINE_NOTICE_FOUND"],
    ["official sender alone", { signals: [], proof: "absent", accountNotice: false, senderOfficial: true }, "NO_MATCHING_NOTICE"],
    ["scam signs + notice + official sender", { signals: [signal], proof: "absent", accountNotice: true, senderOfficial: true }, "MATCHES_SCAM_SIGNS"],
    ["valid code only", { signals: [], proof: "valid", accountNotice: false, senderOfficial: false }, "GENUINE_NOTICE_FOUND"],
    ["scam signs + account notice", { signals: [signal], proof: "absent", accountNotice: true, senderOfficial: false }, "MATCHES_SCAM_SIGNS"],
    ["scam signs + valid code", { signals: [signal], proof: "valid", accountNotice: false, senderOfficial: false }, "MATCHES_SCAM_SIGNS"],
    ["scam signs + valid code + notice", { signals: [signal], proof: "valid", accountNotice: true, senderOfficial: false }, "MATCHES_SCAM_SIGNS"],
    ["invalid code, no signs", { signals: [], proof: "invalid", accountNotice: false, senderOfficial: false }, "NO_MATCHING_NOTICE"],
    ["invalid code + account notice", { signals: [], proof: "invalid", accountNotice: true, senderOfficial: false }, "NO_MATCHING_NOTICE"],
    ["invalid code + signs", { signals: [signal], proof: "invalid", accountNotice: false, senderOfficial: false }, "MATCHES_SCAM_SIGNS"],
    ["invalid code + signs + notice", { signals: [signal], proof: "invalid", accountNotice: true, senderOfficial: false }, "MATCHES_SCAM_SIGNS"],
  ];

  it.each(table)("%s", (_name, facts, expected) => {
    const result = decideVerdict(northline, facts);
    expect(result.verdict).toBe(expected);
    expect(result.reasons).toHaveLength(3);
    expect(new Set(result.reasons).size).toBe(3);
    expect(JSON.stringify(result)).not.toMatch(/\bsafe\b/i);
  });

  it("is deterministic: same facts, same answer", () => {
    const facts = { signals: [signal], proof: "valid" as const, accountNotice: true, senderOfficial: true };
    expect(decideVerdict(northline, facts)).toEqual(decideVerdict(northline, facts));
  });
});

describe("GENUINE needs a valid Proof Code, or a notice plus an official sender", () => {
  it("notice on file + unknown sender + polite message is never GENUINE", () => {
    const r = decideVerdict(northline, { signals: [], proof: "absent", accountNotice: true, senderOfficial: false });
    expect(r.verdict).toBe("NO_MATCHING_NOTICE");
    expect(r.reasons.join(" ")).toMatch(/sender could not be confirmed/i);
    expect(r.next_step).toContain("official channels");
  });

  it("notice on file + no sender is never GENUINE", () => {
    const r = decideVerdict(northline, { signals: [], proof: "absent", accountNotice: true, senderOfficial: false });
    expect(r.verdict).not.toBe("GENUINE_NOTICE_FOUND");
    expect(r.next_step).toContain("official channels");
  });

  it("notice on file + official sender + no scam signs is GENUINE", () => {
    const r = decideVerdict(northline, { signals: [], proof: "absent", accountNotice: true, senderOfficial: true });
    expect(r.verdict).toBe("GENUINE_NOTICE_FOUND");
  });

  it("valid Proof Code + no scam signs is GENUINE, sender not needed", () => {
    const r = decideVerdict(northline, { signals: [], proof: "valid", accountNotice: false, senderOfficial: false });
    expect(r.verdict).toBe("GENUINE_NOTICE_FOUND");
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
