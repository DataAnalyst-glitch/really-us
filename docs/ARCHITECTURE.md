# Architecture

```text
Customer -> Northline demo page -> eGain widget
                                    |
             Pre-chat (damage check) -> AI Agent (knowledge, intents)
                                    |
                        Process workflow: Check a message
                         |            |              |
                     API verify   Confirm step   API report/case
                                    |
                            Really Us Demo API  <-> Netlify Blobs (reports, cases, outbreaks, drafts, audit)
                                    |
                       Trust Console (human approves outbreak and knowledge draft)
                                    |
                 Draft article -> human uploads to eGain knowledge
```

## Boundaries
- eGain owns: conversation, intent, knowledge retrieval, workflow, confirmation, escalation.
- API owns: deterministic verdict, Proof Code match, counting, idempotency, audit.
- Console owns: human approval. It never talks to customers.

## Harness map
| Layer | Implementation |
|---|---|
| Knowledge | `knowledge/`, Display as Source |
| Guardrails | Server rules in CLAUDE.md, allowlist, `confirmed=true`, Topic Identification |
| Workflows | `egain/`; API node Success, Error, Timeout all wired |
| Verification | Behavioral tests on state, `scripts/harness_check.py`, CI, end-to-end cases |
| Traces | `audit_events` table and console feed |

## Failure behaviour
| Failure | Result |
|---|---|
| Verify error or timeout | No verdict; escalate |
| Write timeout | Outcome unknown; do not resubmit; offer support |
| `success:false` with HTTP 200 | Routed to error by Success Condition |
| Repeated report | Same record returned |
