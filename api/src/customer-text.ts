import type { Verdict } from "./types.js";

// Plain text for chat. eGain shows arrays as raw text and removes blank lines,
// so the customer sees one short string. Built only from the decided verdict, the 3 reasons and next_step.
export const CUSTOMER_TEXT_MAX = 900;

export const OPENING: Record<Verdict, string> = {
  MATCHES_SCAM_SIGNS: "Don't call or pay yet.",
  NO_MATCHING_NOTICE: "Don't act on it yet.",
  GENUINE_NOTICE_FOUND: "This matches a notice we have on file.",
};

const LABEL: Record<Verdict, string> = {
  MATCHES_SCAM_SIGNS: "Matches scam signs",
  NO_MATCHING_NOTICE: "No matching notice",
  GENUINE_NOTICE_FOUND: "Genuine notice found",
};

// No brackets, no line breaks, single spaces, sentence ends with a full stop.
const clean = (s: string) => s.replace(/[[\]\r\n]+/g, " ").replace(/\s+/g, " ").trim();
const sentence = (s: string) => (/[.!?]$/.test(clean(s)) ? clean(s) : `${clean(s)}.`);

const WARNING_MAX = 300;

// `warning` is the API's own warning field. It is non-null only for an APPROVED outbreak, so a suspected
// outbreak never reaches this function with a warning. With no warning the text is exactly as before.
// With a warning, "Heads-up: ..." sits right after the opening line and is never dropped: if the 900
// character cap is hit, next_step is cut to its first sentence and then the reasons are shortened.
export function buildCustomerText(verdict: Verdict, reasons: string[], next_step: string, warning?: string | null): string {
  const warn = typeof warning === "string" && clean(warning) !== "" ? sentence(warning).slice(0, WARNING_MAX) : "";
  const head = `${OPENING[verdict]}${warn ? ` Heads-up: ${warn}` : ""} Result: ${LABEL[verdict]}.`;
  const list = reasons.map((r, i) => `${i + 1}) ${sentence(r)}`).join(" ");
  const full = `${head} ${list} Next: ${sentence(next_step)}`;
  if (full.length <= CUSTOMER_TEXT_MAX) return full;
  // Too long: keep the first sentence of next_step so the limit holds.
  const firstSentence = sentence(next_step.split(/(?<=\.)\s/)[0] ?? next_step);
  const shorter = `${head} ${list} Next: ${firstSentence}`;
  if (!warn) return shorter.slice(0, CUSTOMER_TEXT_MAX);
  if (shorter.length <= CUSTOMER_TEXT_MAX) return shorter;
  return `${head} ${shortenReasons(reasons, CUSTOMER_TEXT_MAX - head.length - ` Next: ${firstSentence}`.length - 1)} Next: ${firstSentence}`.slice(0, CUSTOMER_TEXT_MAX);
}

// Cut each reason to the same length (at a word boundary) so the numbered list fits the budget.
function shortenReasons(reasons: string[], budget: number): string {
  const join = (limit: number) =>
    reasons
      .map((r, i) => {
        const text = sentence(r);
        if (text.length <= limit) return `${i + 1}) ${text}`;
        const cut = text.slice(0, limit).replace(/\s+\S*$/, "").replace(/[.,;:!?-]+$/, "");
        return `${i + 1}) ${cut || text.slice(0, limit)}.`;
      })
      .join(" ");
  for (let limit = 200; limit >= 8; limit -= 4) {
    const out = join(limit);
    if (out.length <= budget) return out;
  }
  return join(8);
}
