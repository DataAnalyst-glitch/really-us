import { createHash } from "node:crypto";
import type { CompanyConfig } from "./types.js";

// Same sender written in different ways must give the same hash.
export function normalizeSender(sender: string): string {
  return sender.trim().toLowerCase().replace(/[\s\-().]/g, "");
}

export function hashSender(sender: string): string {
  return createHash("sha256").update(normalizeSender(sender)).digest("hex");
}

// Masked display only. The raw sender is never stored.
export function maskSender(sender: string): string {
  const s = sender.trim();
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 7) {
    let seen = 0;
    const keepFrom = digits.length - 4;
    return s.replace(/\d/g, (d) => (seen++ < keepFrom ? "*" : d));
  }
  const at = s.indexOf("@");
  if (at > 0) return s[0] + "***" + s.slice(at);
  return s.slice(0, 2) + "***";
}

// Official senders are allowlisted by hash, so they can never enter an outbreak.
export function isOfficialSender(config: CompanyConfig, sender_hash: string): boolean {
  return config.official_senders.some((s) => hashSender(s) === sender_hash);
}
