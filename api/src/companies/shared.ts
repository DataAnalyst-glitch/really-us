import type { ScamSignalConfig } from "../types.js";

// Signals every company shares. Link and phone checks are done in code (see verdict.ts).
export const commonSignals: ScamSignalConfig[] = [
  {
    id: "install_app",
    reason: "It asks you to install an app or allow remote access.",
    pattern: "(install|download)[^.]{0,30}\\b(app|application|software)\\b|remote\\s+access|anydesk|teamviewer",
  },
  {
    id: "secret_codes",
    reason: "It asks for a one-time password, PIN, card number or bank login.",
    pattern: "one[- ]time\\s*(password|code)|\\botp\\b|\\bpin\\b|card\\s*number|bank\\s*login|\\bcvv\\b",
  },
  {
    id: "odd_payment",
    reason: "It asks you to pay by gift card, crypto or a transfer to a person.",
    pattern: "gift\\s*card|crypto|bitcoin|wire\\s+transfer|western\\s+union",
  },
];
