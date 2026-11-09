import type { Report } from "./types.js";

export const OUTBREAK_THRESHOLD = 3;

// Only distinct customers count. One customer reporting many times is still one.
export function countDistinctCustomers(reports: Report[]): number {
  return new Set(reports.map((r) => r.customer_ref)).size;
}

// Pure rule. Official (allowlisted) senders can never enter an outbreak.
export function shouldSuspectOutbreak(distinctCustomers: number, senderIsOfficial: boolean): boolean {
  return !senderIsOfficial && distinctCustomers >= OUTBREAK_THRESHOLD;
}
