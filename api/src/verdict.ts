import type { CompanyConfig, DetectedSignal, VerdictFacts, VerdictResult } from "./types.js";

// ---- Detecting signals (pure) -------------------------------------------------

const LINK = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]\S*)?/gi;
const IP_LINK = /\bhttps?:\/\/\d{1,3}(?:\.\d{1,3}){3}\b|\b\d{1,3}(?:\.\d{1,3}){3}\//i; // http://192.0.2.7 or 192.0.2.7/pay
const HIDDEN_DOT_LINK = /\b[a-z0-9-]+\s*[[(]\s*(?:\.|dot)\s*[\])]\s*[a-z]{2,}/i; // northline[.]pay
const FILE_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "jpg", "jpeg", "png", "gif", "heic"]);
const PHONE = /\+?\d[\d\s\-().]{6,}\d/g;
const DATE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
const NUMBER_LABEL_BEFORE = /\b(account|acct|reference|ref|invoice|order|customer)\s*(number|no\.?|#)?\s*:?\s*$/i;
const CONTACT_CUE = /\b(call|dial|phone|ring|text|message|whatsapp|sms|contact|reply)\b/i;
// A signal match is ignored when a negation sits just before it in the same clause:
// "We will never ask for your PIN" is safety advice, not a request.
const NEGATION = /\b(never|will not|won't|do not|don't|does not|doesn't)\b/i;
const NEGATION_WINDOW = 40;

const digitsOnly = (s: string) => s.replace(/\D/g, "");
const last7 = (digits: string) => digits.slice(-7);

function negated(message: string, index: number): boolean {
  const before = message.slice(Math.max(0, index - NEGATION_WINDOW), index);
  const clause = before.split(/[.!?;:\n]/).pop() ?? "";
  return NEGATION.test(clause);
}

// A dotted word counts as a link unless it is plainly not one: a file name ("statement.pdf") or a
// missing space after a full stop ("ready.Thanks"). A scheme, "www." or a path always makes it a link.
function looksLikeLink(full: string, host: string): boolean {
  const scheme = /^https?:\/\//i.exec(full)?.[0] ?? "";
  if (scheme || /^www\./i.test(host) || full.length > scheme.length + host.length) return true;
  const labels = host.split(".");
  const tld = labels[labels.length - 1] ?? "";
  if (FILE_EXTENSIONS.has(tld.toLowerCase())) return false;
  if (labels.length === 2 && /[a-z]$/.test(labels[0] ?? "") && /^[A-Z][a-z]{3,}$/.test(tld)) return false;
  return true;
}

export function detectScamSigns(config: CompanyConfig, message: string): DetectedSignal[] {
  const found: DetectedSignal[] = [];

  for (const s of config.scam_signals) {
    const matches = [...message.matchAll(new RegExp(s.pattern, "gi"))];
    if (matches.some((m) => !negated(message, m.index ?? 0))) found.push({ id: s.id, reason: s.reason });
  }

  // A link to anything other than the company's own domains, an IP-address link, or a hidden-dot link.
  const domains = config.notice_rules.official_domains.map((d) => d.toLowerCase());
  const hosts = [...message.matchAll(LINK)]
    .filter((m) => looksLikeLink(m[0], m[1] ?? ""))
    .map((m) => (m[1] ?? "").toLowerCase());
  if (
    hosts.some((h) => !domains.some((d) => h === d || h.endsWith("." + d))) ||
    IP_LINK.test(message) ||
    HIDDEN_DOT_LINK.test(message)
  ) {
    found.push({ id: "unofficial_link", reason: "It contains a link to a website that is not an official one." });
  }

  // Asks you to contact a phone number that is not an official one. Dates and labelled account or
  // reference numbers are not phone numbers. Official numbers match on their last 7 digits, so
  // "555 0100" and "+1 555 0100" are the same number.
  const officialDigits = new Set(config.official_senders.map(digitsOnly).filter((d) => d.length >= 7).map(last7));
  const text = message.replace(DATE, " ");
  const numbers = [...text.matchAll(PHONE)]
    .filter((m) => !NUMBER_LABEL_BEFORE.test(text.slice(Math.max(0, (m.index ?? 0) - 30), m.index)))
    .map((m) => digitsOnly(m[0]))
    .filter((d) => d.length >= 7);
  if (CONTACT_CUE.test(message) && numbers.some((n) => !officialDigits.has(last7(n)))) {
    found.push({ id: "unofficial_phone", reason: "It asks you to call or message a phone number that is not an official one." });
  }

  return found;
}

// ---- Deciding the verdict (pure) ---------------------------------------------

// Not-found is not proof. On the no-notice paths the reason says so. A genuine result is confirmed by the
// notice or Proof Code, so there the plain fact is enough. The word "safe" is never used (golden rule 3).
const NO_SCAM_FACT = "We found no known scam patterns in the text. That does not mean the message is genuine.";
const NO_SCAM_FACT_GENUINE = "We found no known scam patterns in the text.";
const NO_NOTICE_FACT = "No matching notice was found for this check.";
const NO_CODE_FACT = "No valid Proof Code was given.";
const BAD_CODE_FACT = "The Proof Code does not match a real notice.";
const BAD_CODE_RULE = "A wrong Proof Code means this message cannot be confirmed as genuine.";
const GOOD_CODE_FACT = "The Proof Code matches a real notice.";
const ACCOUNT_NOTICE_FACT = "A notice is on file for this account.";
const OFFICIAL_SENDER_FACT = "The sender is on the official sender list.";
const SENDER_UNCONFIRMED_FACT = "The sender could not be confirmed as an official one.";
const ONE_NOTICE_ONLY_FACT = "This check confirms that one notice only.";
const WARNING_BEATS_NOTICE_RULE = "A code or notice does not make a message with these warning signs genuine.";

function channelsText(config: CompanyConfig): string {
  return config.official_channels.join("; ");
}

// Order of rules (after the TESTFAIL error, which is handled before this function):
// 2. invalid Proof Code -> never GENUINE
// 3. scam signs -> MATCHES_SCAM_SIGNS, even if a notice or valid code exists
// 4. no scam signs, and a valid code OR (account notice AND official sender) -> GENUINE_NOTICE_FOUND
// 4b. account notice but sender missing or not official -> NO_MATCHING_NOTICE
// 5. otherwise NO_MATCHING_NOTICE
// Every reason comes from a signal that was really detected or a check that really ran.
export function decideVerdict(config: CompanyConfig, facts: VerdictFacts): VerdictResult {
  const { signals, proof, accountNotice, senderOfficial } = facts;
  const signalReasons = signals.map((s) => s.reason);
  const noticeExists = proof === "valid" || accountNotice;
  const channels = channelsText(config);
  const name = config.display_name;
  const mismatch = `This message does not match the official ${name} process.`;

  const scamNextStep = noticeExists
    ? `${mismatch} Do not reply, click or pay. Contact ${name} only through its official channels: ${channels}.`
    : `Do not call, click, install or pay. Check with ${name} using only its official channels: ${channels}.`;

  // Rule 2: a wrong code can never lead to GENUINE.
  if (proof === "invalid") {
    if (signals.length > 0) {
      const lead = accountNotice ? [mismatch] : [];
      return {
        verdict: "MATCHES_SCAM_SIGNS",
        reasons: [...lead, ...signalReasons, BAD_CODE_FACT, BAD_CODE_RULE].slice(0, 3),
        next_step: scamNextStep,
      };
    }
    return {
      verdict: "NO_MATCHING_NOTICE",
      reasons: [NO_SCAM_FACT, BAD_CODE_FACT, BAD_CODE_RULE],
      next_step: `We could not match this to a notice. Do not act on it yet. Check with ${name} through its official channels: ${channels}.`,
    };
  }

  // Rule 3: scam signs win over everything else.
  if (signals.length > 0) {
    const reasons = noticeExists
      ? [mismatch, ...signalReasons, WARNING_BEATS_NOTICE_RULE]
      : [...signalReasons, NO_NOTICE_FACT, NO_CODE_FACT];
    return { verdict: "MATCHES_SCAM_SIGNS", reasons: reasons.slice(0, 3), next_step: scamNextStep };
  }

  // Rule 4: no scam signs, and either a valid code, or an account notice plus an official sender.
  const accountConfirmed = accountNotice && senderOfficial;
  if (proof === "valid" || accountConfirmed) {
    const reasons = [
      NO_SCAM_FACT_GENUINE,
      ...(proof === "valid" ? [GOOD_CODE_FACT] : []),
      ...(accountConfirmed ? [ACCOUNT_NOTICE_FACT, OFFICIAL_SENDER_FACT] : []),
      ONE_NOTICE_ONLY_FACT,
    ];
    return {
      verdict: "GENUINE_NOTICE_FOUND",
      reasons: reasons.slice(0, 3),
      next_step: `This matches a real ${name} notice. You can still confirm it through the official channels: ${channels}.`,
    };
  }

  // Rule 4b: a notice is on file but the sender could not be confirmed. Never GENUINE.
  if (accountNotice) {
    return {
      verdict: "NO_MATCHING_NOTICE",
      reasons: [NO_SCAM_FACT, ACCOUNT_NOTICE_FACT, SENDER_UNCONFIRMED_FACT],
      next_step: `We could not confirm who sent this. Do not act on it yet. Check with ${name} only through its official channels: ${channels}.`,
    };
  }

  // Rule 5.
  return {
    verdict: "NO_MATCHING_NOTICE",
    reasons: [NO_SCAM_FACT, NO_NOTICE_FACT, NO_CODE_FACT],
    next_step: `We could not match this to a notice. Do not act on it yet. Check with ${name} through its official channels: ${channels}.`,
  };
}
