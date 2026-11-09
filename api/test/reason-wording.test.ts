import { describe, expect, it } from "vitest";
import { northline } from "../src/companies/northline.js";
import { companies } from "../src/companies/index.js";
import { decideVerdict } from "../src/verdict.js";
import type { DetectedSignal, ProofState } from "../src/types.js";

// The "no scam signs" reason must not sound like reassurance. It never says "safe" (golden rule 3).
const CAUTION = "We found no known scam patterns in the text. That does not mean the message is genuine.";
const PLAIN = "We found no known scam patterns in the text.";
const signal: DetectedSignal = { id: "x", reason: "It asks for a one-time password, PIN, card number or bank login." };

type Facts = { signals: DetectedSignal[]; proof: ProofState; accountNotice: boolean; senderOfficial: boolean };
const noSigns = (over: Partial<Facts>): Facts => ({ signals: [], proof: "absent", accountNotice: false, senderOfficial: false, ...over });

describe("reason wording: no scam signs found", () => {
  it.each([
    ["nothing at all", noSigns({})],
    ["invalid Proof Code", noSigns({ proof: "invalid" })],
    ["account notice but no official sender", noSigns({ accountNotice: true })],
    ["invalid code and an account notice", noSigns({ proof: "invalid", accountNotice: true })],
  ])("NO_MATCHING_NOTICE (%s): the first reason says it is not proof", (_n, facts) => {
    const r = decideVerdict(northline, facts);
    expect(r.verdict).toBe("NO_MATCHING_NOTICE");
    expect(r.reasons).toHaveLength(3);
    expect(r.reasons[0]).toBe(CAUTION);
  });

  it.each([
    ["valid Proof Code", noSigns({ proof: "valid" })],
    ["notice on file and an official sender", noSigns({ accountNotice: true, senderOfficial: true })],
  ])("GENUINE_NOTICE_FOUND (%s): a plain fact, nothing that tells the customer to distrust it", (_n, facts) => {
    const r = decideVerdict(northline, facts);
    expect(r.verdict).toBe("GENUINE_NOTICE_FOUND");
    expect(r.reasons).toHaveLength(3);
    expect(r.reasons[0]).toBe(PLAIN);
    expect(r.reasons.join(" ")).not.toMatch(/does not mean|don't|do not/i);
  });

  it("MATCHES_SCAM_SIGNS never uses the no-signs reason", () => {
    for (const proof of ["absent", "valid", "invalid"] as const) {
      for (const accountNotice of [false, true]) {
        const r = decideVerdict(northline, { signals: [signal], proof, accountNotice, senderOfficial: false });
        expect(r.verdict).toBe("MATCHES_SCAM_SIGNS");
        expect(r.reasons.join(" ")).not.toContain("no known scam patterns");
      }
    }
  });

  it("every company, every verdict path: three distinct reasons, the old sentence is gone, and 'safe' is never used", () => {
    const proofs: ProofState[] = ["absent", "valid", "invalid"];
    for (const config of Object.values(companies)) {
      for (const signals of [[], [signal]]) {
        for (const proof of proofs) {
          for (const accountNotice of [false, true]) {
            for (const senderOfficial of [false, true]) {
              const r = decideVerdict(config, { signals, proof, accountNotice, senderOfficial });
              expect(r.reasons).toHaveLength(3);
              expect(new Set(r.reasons).size).toBe(3);
              const text = JSON.stringify(r);
              expect(text).not.toMatch(/No scam warning signs/i);
              expect(text).not.toMatch(/\bsafe\b/i);
            }
          }
        }
      }
    }
  });
});
