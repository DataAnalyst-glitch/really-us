import type { CompanyConfig } from "../types.js";
import { commonSignals } from "./shared.js";

// Fictional bank. ASSUMPTION: "Examplia" matches no real business (not searched online).
export const exampliaBank: CompanyConfig = {
  company_id: "examplia_bank",
  display_name: "Examplia Bank",
  official_channels: [
    "Website: examplia-bank.example",
    "Email: alerts@examplia-bank.example",
    "Text message sender name: EXAMPLIABANK",
    "Demo support phone: +1 555 0110",
    "Demo fraud desk phone: +1 555 0111",
    "Letter mailed to your address on file",
  ],
  official_senders: ["EXAMPLIABANK", "alerts@examplia-bank.example", "+1 555 0110", "+1 555 0111"],
  notice_rules: {
    proof_code_pattern: "^EB-\\d{4}$",
    official_domains: ["examplia-bank.example"],
  },
  scam_signals: [
    {
      id: "urgent_lock",
      reason: "It says your account or card is locked and you must act now.",
      pattern:
        "(account|card)\\b[^.]{0,40}\\b(locked|frozen|suspended|blocked)\\b[^.]{0,60}\\b(today|tonight|now|immediately|within\\s+\\d+\\s*(hour|minute|min)s?)\\b",
    },
    ...commonSignals,
  ],
  fraud_reporting: "Demo fraud desk phone: +1 555 0111",
  demo_accounts: ["DEMO-EB-2001", "DEMO-EB-2002"],
  demo_contacts: ["+1 555 0110", "+1 555 0111"],
};
