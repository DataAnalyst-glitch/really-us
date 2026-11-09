# Trust Check template (eGain build specs)
Fill one file per workflow after the capability check: `pre-chat.md`, `process-check-message.md`, `escalation.md`, `agent-settings.md`.
Mark each platform fact ASSUMPTION or VERIFIED.

## Capability check
| Capability | Status | Evidence |
|---|---|---|
| Create agent, upload knowledge | VERIFIED (2026-11-09, trial UI) | 6 files trained |
| Intents, map to workflow | VERIFIED (2026-11-10, owner, in chat) | Intents map to the Process workflows: see workflows.md |
| Pre-chat, Process, Escalation workflows | VERIFIED (2026-11-10, owner, published and run in chat) | pre-chat.md, workflows.md, escalation.md |
| API node | VERIFIED (2026-11-10, owner, live chats) | Process workflows call the live API: see workflows.md |
| Enable Actions, Custom Actions | VERIFIED (2026-11-09, trial UI) | Create Custom API visible |
| Publish, demo link | VERIFIED (2026-11-10, owner) | Demo Link created from Personalize and Publish; opens without a code; link in the root README.md. The settings box shows an empty URL after creation, but the link works |
| Certified Answers | VERIFIED setting present (2026-11-09); use ASSUMPTION | Toggle in Conversation Behavior |
| Connectors | ASSUMPTION | |

## Built and verified on 2026-11-10 (owner, live)
| Item | Name in eGain | Spec |
|---|---|---|
| AI Agent | Really Us Message Verifier | [agent-settings.md](agent-settings.md) |
| Pre-chat workflow | Really Us Pre-chat | [pre-chat.md](pre-chat.md) |
| Process workflows | Verify Message (v3), Verify With Proof Code, Report Message, Open Case, and Verify Bank Message (second company, Examplia Bank) | [workflows.md](workflows.md) |
| Escalation workflow | Really Us Escalation | [escalation.md](escalation.md) |
| External Credential | `really-us-api-key` (the value is never recorded here) | [workflows.md](workflows.md) |

## Knowledge ingestion (eGain facts found)
- No API was found to create knowledge articles. Content is added through Point to Content: files, a website crawl, or a portal.
- The Knowledge Loop therefore stops at a human-approved draft in the Trust Console. Nothing is uploaded to eGain knowledge by this project.
- Idea, NOT built: publish approved articles on a `/kb/` page with a sitemap, then crawl that page from eGain.

## Second fictional company (verified 2026-11-10, owner)
Examplia Bank works in the same agent through the Process workflow "Verify Bank Message" and the intent "Check a message from my bank". It is a copy of Verify Message v3 whose body sends `"company_id":"examplia_bank"`. The Pre-chat greeting is still the one written for Northline Power. Only the verify flow exists for the bank; the report, case and Proof Code flows are Northline only. Details and test results: [workflows.md](workflows.md) and `docs/TEST_PLAN.md`.
