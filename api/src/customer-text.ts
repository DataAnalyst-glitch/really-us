import type { Verdict } from "./types.js";

// Plain text for chat. eGain shows arrays as raw text and removes blank lines,
// so the customer sees one short string. Built only from the decided verdict, the 3 reasons and next_step.
export const CUSTOMER_TEXT_MAX = 900;

export const OPENING: Record<Verdict, string> = {
  MATCHES_SCAM_SIGNS: "Don't call or pay yet.",
  NO_MATCHING_NOTICE: "Don't act on it yet.",
  GENUINE_NOTICE_FOUND: "Good news: this matches a real notice.",
};

const LABEL: Record<Verdict, string> = {
  MATCHES_SCAM_SIGNS: "Matches scam signs",
  NO_MATCHING_NOTICE: "No matching notice",
  GENUINE_NOTICE_FOUND: "Genuine notice found",
};

// No brackets, no line breaks, single spaces, sentence ends with a full stop.
const clean = (s: string) => s.replace(/[[\]\r\n]+/g, " ").replace(/\s+/g, " ").trim();
const sentence = (s: string) => (/[.!?]$/.test(clean(s)) ? clean(s) : `${clean(s)}.`);

export function buildCustomerText(verdict: Verdict, reasons: string[], next_step: string): string {
  const head = `${OPENING[verdict]} Result: ${LABEL[verdict]}.`;
  const list = reasons.map((r, i) => `${i + 1}) ${sentence(r)}`).join(" ");
  const full = `${head} ${list} Next: ${sentence(next_step)}`;
  if (full.length <= CUSTOMER_TEXT_MAX) return full;
  // Too long: keep the first sentence of next_step so the limit holds.
  const firstSentence = sentence(next_step.split(/(?<=\.)\s/)[0] ?? next_step);
  return `${head} ${list} Next: ${firstSentence}`.slice(0, CUSTOMER_TEXT_MAX);
}
