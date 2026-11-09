import type { CompanyConfig } from "../types.js";
import { commonSignals } from "./shared.js";

// Fictional telecom. ASSUMPTION: "Examplia" matches no real business (not searched online).
export const exampliaMobile: CompanyConfig = {
  company_id: "examplia_mobile",
  display_name: "Examplia Mobile",
  official_channels: [
    "Website: examplia-mobile.example",
    "Email: care@examplia-mobile.example",
    "Text message sender name: EXAMPLIAMOBILE",
    "Demo support phone: +1 555 0120",
    "Demo fraud desk phone: +1 555 0121",
    "Paper bill mailed to your billing address",
  ],
  official_senders: ["EXAMPLIAMOBILE", "care@examplia-mobile.example", "+1 555 0120", "+1 555 0121"],
  notice_rules: {
    proof_code_pattern: "^EM-\\d{4}$",
    official_domains: ["examplia-mobile.example"],
  },
  scam_signals: [
    {
      id: "urgent_sim",
      reason: "It says your SIM or line will be blocked and you must act now.",
      pattern:
        "\\b(sim|line|number|service)\\b[^.]{0,40}\\b(blocked|deactivated|suspended|disconnected)\\b[^.]{0,60}\\b(today|tonight|now|immediately|within\\s+\\d+\\s*(hour|minute|min)s?)\\b",
    },
    ...commonSignals,
  ],
  fraud_reporting: "Demo fraud desk phone: +1 555 0121",
  demo_accounts: ["DEMO-EM-3001", "DEMO-EM-3002"],
  demo_contacts: ["+1 555 0120", "+1 555 0121"],
};
