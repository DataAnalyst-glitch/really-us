# Process workflows
Status: all four published. VERIFIED (2026-11-10, owner, live chats in the Test AI Agent and the Demo Link).

API base: `https://really-us-verifier.netlify.app`. The API contract is in `docs/TECHNOLOGY.md`. The write calls send the header `X-API-Key`, with the value taken from the eGain External Credential named `really-us-api-key`. The credential value is never written in this repository.

Items marked NOT RECORDED were not supplied for this file. Copy them from eGain Agentic Studio; do not guess them.

## 1. Verify Message (v3)
Intents: Fraud Prevention and Security Awareness.
1. Ask for the message to check.
2. Ask for the sender.
3. Call `POST /v1/verify` (no key needed) with the message and the sender.
4. Map the response fields `customer_text`, `verdict` and `warning`.
5. Show `customer_text` to the customer.

What the customer sees comes from the API, not from the workflow. `customer_text` is one plain string (opening line, `Result:`, three numbered reasons, `Next:`), at most 900 characters. For an approved outbreak it also has "Heads-up: Several customers have reported this sender. Treat it with care." right after the opening line. See `api/src/customer-text.ts`.

## 2. Verify With Proof Code
Intent: Verify with a Proof Code.
1. Ask for the Proof Code.
2. Call `POST /v1/verify` with the code in `proof_code`.
3. Show the result. The demo code is `NP-4821`, which gives GENUINE_NOTICE_FOUND for a clean message.

The other request fields this workflow sends, and the exact question text, are NOT RECORDED.

## 3. Report Message
Intent: Report a suspicious message.
1. Ask for the sender.
2. Ask for confirmation: Yes or No.
3. On Yes, call `POST /v1/reports` with the header `X-API-Key` (credential `really-us-api-key`), `confirmed: true` and an idempotency key.
4. Show the report reference returned by the API. (Project rule: never show a reference unless the API returned success. The failure path was not part of the 2026-11-10 run.)

The No path was not part of the 2026-11-10 run (T5 in `docs/TEST_PLAN.md` is NOT RUN).

## 4. Open Case
Intent: I already paid or shared details.
1. Ask what happened.
2. Ask for confirmation.
3. Normalise the answer to a reason value. `ALREADY_PAID` and `CLICKED_LINK` were recorded in chat after a normalisation fix.
4. Call `POST /v1/cases` with the header `X-API-Key` (credential `really-us-api-key`), `confirmed: true` and an idempotency key.
5. Show the case number returned by the API.

The server sets priority P1 for `ALREADY_PAID`, `SHARED_DETAILS`, `CLICKED_LINK` and `INSTALLED_APP`. The reply never promises recovery of money.

## Intent mapping (verified in chat)
| Intent | Process workflow |
|---|---|
| Fraud Prevention and Security Awareness | Verify Message |
| Report a suspicious message | Report Message |
| Verify with a Proof Code | Verify With Proof Code |
| I already paid or shared details | Open Case |

## Not recorded
- Exact question and confirmation texts for each workflow.
- API block settings as built (timeout, retries, success condition). The planned values are in `docs/TECHNOLOGY.md`: 8000 ms, no retries on writes, success when the status is 200 and `success` is true.
- The full request bodies each block sends.
- The eGain Test panel hides some mapped values, so some mappings were checked in the chat itself (see `docs/FRICTION_LOG.md`).
