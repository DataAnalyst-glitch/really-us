import type { ScamSignalConfig } from "../types.js";

// Signals every company shares. Link and phone checks are done in code (see verdict.ts).
export const commonSignals: ScamSignalConfig[] = [
  {
    id: "install_app",
    reason: "It asks you to install an app or allow remote access.",
    // "Download the app from your official app store" is ordinary advice, so it is not flagged.
    pattern:
      "(install|download)[^.]{0,30}\\b(app|application|software)\\b(?![^.]{0,40}\\bofficial\\s+app\\s+store)|remote\\s+access|anydesk|teamviewer",
  },
  {
    id: "secret_codes",
    reason: "It asks for a one-time password, PIN, card number or bank login.",
    // "card number ending 4321" names a card; it does not ask for the number.
    pattern:
      "one[- ]time\\s*(password|code)|\\botp\\b|\\bpin\\b|card\\s*number(?!\\s+ending)|bank\\s*login|\\bcvv\\b" +
      "|\\b(send|reply|text|give|share)\\b[^.]{0,30}\\bverification\\s+code" +
      "|\\bconfirm\\s+your\\s+(password|username)\\b" +
      "|\\blog\\s*in\\b[^.]{0,20}\\b(restore|unlock|reactivate)\\b",
  },
  {
    id: "odd_payment",
    reason: "It asks you to pay by gift card, crypto or a transfer to a person.",
    pattern: "gift\\s*card|gift\\s*voucher|itunes|crypto|bitcoin|wire\\s+transfer|western\\s+union|\\bzelle\\b|cash\\s*app\\b",
  },
  {
    id: "bank_details",
    reason: "It asks you to send your bank account details.",
    pattern: "\\b(reply|send|text)\\b[^.]{0,30}\\b(bank\\s+account|sort\\s+code)\\b",
  },
];
