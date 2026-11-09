import type { CompanyConfig, DetectedSignal, VerdictFacts, VerdictResult } from "./types.js";

// ---- Detecting signals (pure) -------------------------------------------------

const LINK = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]\S*)?/gi;
const PHONE = /\+?\d[\d\s\-().]{6,}\d/g;
const CONTACT_CUE = /\b(call|phone|ring|text|message|whatsapp|sms|contact|reply)\b/i;

const digitsOnly = (s: string) => s.replace(/\D/g, "");

export function detectScamSigns(config: CompanyConfig, message: string): DetectedSignal[] {
  const found: DetectedSignal[] = [];

  for (const s of config.scam_signals) {
    if (new RegExp(s.pattern, "i").test(message)) found.push({ id: s.id, reason: s.reason });
  }

  // A link to anything other than the company's own domains.
  const domains = config.notice_rules.official_domains.map((d) => d.toLowerCase());
  const hosts = [...message.matchAll(LINK)].map((m) => (m[1] ?? "").toLowerCase());
  if (hosts.some((h) => !domains.some((d) => h === d || h.endsWith("." + d)))) {
    found.push({ id: "unofficial_link", reason: "It contains a link to a website that is not an official one." });
  }

  // Asks you to contact a phone number that is not an official one.
  const officialDigits = new Set(config.official_senders.map(digitsOnly).filter((d) => d.length >= 7));
  const numbers = (message.match(PHONE) ?? []).map(digitsOnly).filter((d) => d.length >= 7);
  if (CONTACT_CUE.test(message) && numbers.some((n) => !officialDigits.has(n))) {
    found.push({ id: "unofficial_phone", reason: "It asks you to call or message a phone number that is not an official one." });
  }

  return found;
}

// ---- Deciding the verdict (pure) ---------------------------------------------

const NO_SCAM_FACT = "No scam warning signs were found in the message text.";
const NO_NOTICE_FACT = "No matching notice was found for this check.";
const NO_CODE_FACT = "No valid Proof Code was given.";
const BAD_CODE_FACT = "The Proof Code does not match a real notice.";
const BAD_CODE_RULE = "A wrong Proof Code means this message cannot be confirmed as genuine.";
const GOOD_CODE_FACT = "The Proof Code matches a real notice.";
const ACCOUNT_NOTICE_FACT = "A notice is on file for this account.";
const ONE_NOTICE_ONLY_FACT = "This check confirms that one notice only.";
const WARNING_BEATS_NOTICE_RULE = "A code or notice does not make a message with these warning signs genuine.";

function channelsText(config: CompanyConfig): string {
  return config.official_channels.join("; ");
}

// Order of rules (after the TESTFAIL error, which is handled before this function):
// 2. invalid Proof Code -> never GENUINE
// 3. scam signs -> MATCHES_SCAM_SIGNS, even if a notice or valid code exists
// 4. notice or valid code, no scam signs -> GENUINE_NOTICE_FOUND
// 5. otherwise NO_MATCHING_NOTICE
// Every reason comes from a signal that was really detected or a check that really ran.
export function decideVerdict(config: CompanyConfig, facts: VerdictFacts): VerdictResult {
  const { signals, proof, accountNotice } = facts;
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

  // Rule 4: a notice or a valid code, and no scam signs.
  if (noticeExists) {
    const reasons = [
      NO_SCAM_FACT,
      ...(proof === "valid" ? [GOOD_CODE_FACT] : []),
      ...(accountNotice ? [ACCOUNT_NOTICE_FACT] : []),
      ONE_NOTICE_ONLY_FACT,
    ];
    return {
      verdict: "GENUINE_NOTICE_FOUND",
      reasons: reasons.slice(0, 3),
      next_step: `This matches a real ${name} notice. You can still confirm it through the official channels: ${channels}.`,
    };
  }

  // Rule 5.
  return {
    verdict: "NO_MATCHING_NOTICE",
    reasons: [NO_SCAM_FACT, NO_NOTICE_FACT, NO_CODE_FACT],
    next_step: `We could not match this to a notice. Do not act on it yet. Check with ${name} through its official channels: ${channels}.`,
  };
}
