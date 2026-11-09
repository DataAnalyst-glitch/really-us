import { expect } from "vitest";
import { handleReport, handleVerify, type Deps } from "../src/handlers.js";
import { createMemoryStorage } from "../src/storage.js";
import { VERDICTS, type ApiResult } from "../src/types.js";

export const DEMO_KEY = "demo-key-for-tests";

export function setup(env: Deps["env"] = { DEMO_DATA_ONLY: "true", DEMO_KEY }) {
  const storage = createMemoryStorage();
  const deps: Deps = { storage, env, now: () => "2026-11-09T00:00:00.000Z" };
  return { storage, deps };
}

// Fictional sample messages (no real numbers: 555 range only, .example domains).
export const scamNorthline =
  "Northline: your power will be cut tonight. Call 0412 555 019 now or pay at bit.ly/np-pay. Reply with your OTP.";
export const cleanNorthline = "Your Northline Power bill is ready. See northline.example for details.";
export const scamBank =
  "Examplia Bank: your account is locked, act now. Verify at examplia-bank.example.secure-login.com and send your card number.";
export const scamMobile = "Examplia Mobile: your SIM will be blocked today. Install our app via tinyurl.com/em and send the gift card code.";

export function verify(deps: Deps, body: Record<string, unknown>): Promise<ApiResult> {
  return handleVerify(deps, { company_id: "northline", ...body });
}

let counter = 0;
export function report(deps: Deps, body: Record<string, unknown>): Promise<ApiResult> {
  counter += 1;
  return handleReport(deps, {
    company_id: "northline",
    sender: "+1 555 0199",
    customer_ref: "CUST-1",
    confirmed: true,
    idempotency_key: `key-${counter}`,
    ...body,
  });
}

// Rules that hold for every successful verify response.
export function expectValidVerdictShape(res: ApiResult) {
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.demo_data).toBe(true);
  expect(VERDICTS).toContain(res.body.verdict);
  expect(res.body.reasons).toHaveLength(3);
  expect(typeof res.body.next_step).toBe("string");
  expect(JSON.stringify(res.body)).not.toMatch(/\bsafe\b/i);
}
