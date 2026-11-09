# Technology
Stack: TypeScript, Netlify Functions, Netlify Blobs (storage), static HTML console, Vitest. ASSUMPTION: chosen for speed; change via DECISIONS.md.

All responses include `demo_data: true`. Writes return `success`. Auth: `X-API-Key` (eGain credential). Console: `X-Demo-Key`.

## Contract
| Endpoint | Input | Output |
|---|---|---|
| `POST /v1/verify` | `company_id, message, demo_account?, proof_code?` | `success, verdict, reasons[3], next_step, sender_hash, report_count, warning` |
| `GET /v1/senders/{hash}` | `company_id` | `report_count, warning, status` |
| `POST /v1/reports` | `company_id, sender, customer_ref, confirmed, idempotency_key` | `success, report_id, report_count, outbreak_status` |
| `POST /v1/cases` | `company_id, priority, reason, summary, confirmed, idempotency_key` | `success, case_id, priority` |
| `GET /v1/console/state` | `X-Demo-Key` | `success, counts{reports,cases,outbreaks,alerts}, outbreaks[], feed[]` |
| `POST /v1/outbreaks/{id}/approve` | `X-Demo-Key`; `confirmed, idempotency_key` | `success, outbreak_id, alerted_simulated` |
| `POST /v1/outbreaks/{id}/draft` | `X-Demo-Key`; `confirmed, idempotency_key` | `success, draft_id, status, title, article_markdown, published:false` |
| `POST /v1/drafts/{id}/approve` | `X-Demo-Key`; `confirmed, idempotency_key` | `success, draft_id, status, article_markdown, published:false, next_step` |
| `POST /v1/demo/reset` | `X-Demo-Key`; `confirmed, idempotency_key` | `success, reset` |

`/v1/verify` also returns `customer_text`, one plain string for chat (max 900 characters, no brackets or line breaks). It carries the outbreak warning as "Heads-up: ..." after the opening line only when `warning` is non-null, which happens only for an approved outbreak; otherwise it has no warning text. `/v1/reports` and `/v1/cases` need `X-API-Key`.

Verdict logic is deterministic rules from company config. No LLM decides a verdict.
Rules: valid Proof Code or account notice -> GENUINE; scam signals and no notice -> MATCHES_SCAM_SIGNS; otherwise NO_MATCHING_NOTICE.
Test locality: company `TESTFAIL` forces a 500 for failure-path demos.

## Company config
`company_id, display_name, official_channels, official_senders, notice_rules, scam_signals, fraud_reporting, demo_accounts, demo_contacts`.
Companies: Northline Power, one bank, one telecom. Check names do not match real businesses.

## eGain settings
API node Response 8000 ms; Max Retries 0 on writes; Success Condition `status === 200 && body.success === true`; paste Max Length 600.
Reads as Custom Action, writes in Process workflow.

## Data tables
`reports, cases, outbreaks, alerts, drafts, audit events, idempotency records`, stored in Netlify Blobs keyed by prefix (`report/`, `case/`, `outbreak/`, `alert/`, `draft/`, `audit/`, `idem/`). Notices are fixtures in code. Store sender as hash plus masked display. Unique `idempotency_key`.

## Environment
`DEMO_DATA_ONLY=true, API_KEY, DEMO_KEY`, optional `STORAGE_BACKEND` (`blobs` or `memory`). Netlify supplies the Blobs context itself. Never commit values.
