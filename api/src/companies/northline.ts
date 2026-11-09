import type { CompanyConfig } from "../types.js";
import { commonSignals } from "./shared.js";

// Matches knowledge/KB-01 and KB-02. Fictional company.
export const northline: CompanyConfig = {
  company_id: "northline",
  display_name: "Northline Power",
  official_channels: [
    "Website: northline.example",
    "Email: notices@northline.example",
    "Text message sender name: NLPOWER",
    "Demo support phone: +1 555 0100",
    "Demo fraud desk phone: +1 555 0101",
    "Paper bill mailed to your service address",
  ],
  official_senders: ["NLPOWER", "notices@northline.example", "+1 555 0100", "+1 555 0101"],
  notice_rules: {
    proof_code_pattern: "^NP-\\d{4}$",
    official_domains: ["northline.example"],
  },
  scam_signals: [
    {
      id: "urgent_cutoff",
      reason: "It says your power will be cut today or tonight.",
      pattern:
        "(cut|disconnect|shut\\s*off|suspend)\\w*[^.]{0,60}\\b(today|tonight|immediately|within\\s+\\d+\\s*(hour|minute|min)s?)\\b|\\b(today|tonight)\\b[^.]{0,60}(cut|disconnect|shut\\s*off|suspend)",
    },
    ...commonSignals,
  ],
  fraud_reporting: "Demo fraud desk phone: +1 555 0101",
  demo_accounts: ["DEMO-NP-1001", "DEMO-NP-1002"],
  demo_contacts: ["+1 555 0100", "+1 555 0101"],
};
