# Decisions
| Date | Decision | Why |
|---|---|---|
| 2026-11-09 | Build "Really Us?" instead of GridCare | Global problem; stronger action and judgment story |
| 2026-11-09 | Conversation stays in eGain; no CrewAI, Dify or vector DB | eGain use is scored; fewer failure points |
| 2026-11-09 | Deterministic verdicts | Reliability and auditability |
| 2026-11-09 | Fictional data only | Hackathon rules |

| 2026-11-09 | Verdict order: TESTFAIL error; invalid Proof Code never GENUINE; scam signs beat a notice or valid code; then GENUINE; else NO_MATCHING_NOTICE | Stops a real notice or copied code from vouching for a scam-style message |
| 2026-11-09 | Bank and telecom are "Examplia Bank" and "Examplia Mobile", `.example` domains | Clearly fictional. ASSUMPTION: no real business uses these names (not searched online) |
| 2026-11-09 | `TESTFAIL` (verify 500) and `TESTFAILWRITE` (write returns success:false) exist only when `DEMO_DATA_ONLY=true` | Failure-path demos without a test hook in production |
| 2026-11-09 | Contract additions: optional `sender` on `/v1/verify` (to fill `sender_hash`, `report_count`, `warning`); `next_step` on `/v1/cases`; `already_reported` on `/v1/reports`; outbreak approve also needs `confirmed=true` and `idempotency_key` | Golden rule 2: every write is confirmed and idempotent. `sender_hash` needs a sender |
| 2026-11-09 | One report record per customer per sender; `report_count` is distinct customers | Only distinct customers count |
| 2026-11-09 | Damage reasons (ALREADY_PAID, SHARED_DETAILS, CLICKED_LINK, INSTALLED_APP) force priority P1 on the server | A caller cannot lower a damage case |

## Known gaps (documented, not fixed yet)
- Proof Code: no expiry, no one-time use, no rate limit on wrong guesses. A code can be reused and guessed (10,000 possible codes per company).
- "Matching notice" means the demo account has a notice on file. It is not text similarity with the pasted message. GENUINE now also needs a valid Proof Code or a supplied sender on the company's official allowlist (fixed: a notice with a missing or non-official sender returns NO_MATCHING_NOTICE). Remaining gap: the sender is user-supplied and could be spoofed, so a notice plus an allowlisted sender is still not proof of origin; the Proof Code is the stronger check.
- Verify has no timeout simulation. T8 covers the 500 path only.
- Memory storage only. No Supabase, HTTP adapter, console endpoints, reset or knowledge draft yet.

## Pre-existing templates, code, third-party assets
Dev dependencies in `api/package.json` (installed with npm, not vendored): `typescript` ^7.0.2, `vitest` ^5.1.0, `@types/node` ^26.6.6. Exact versions are in `api/package-lock.json`. No other templates or third-party code.
