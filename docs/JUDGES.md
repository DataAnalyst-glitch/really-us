# Judge guide
Status values: PLANNED, BUILT, VERIFIED. Update with evidence links as work completes.

## Rule-to-evidence map
| Hackathon requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Knowledge-based AI Agent | `knowledge/`, eGain sources | PLANNED | |
| Published experience, demo link | eGain publish | PLANNED | |
| Pre-chat workflow | `egain/pre-chat.md` | PLANNED | |
| Escalation, 2+ options | `egain/escalation.md` | PLANNED | |
| Process workflow on an intent | `egain/process-check-message.md` | PLANNED | |
| Actions | Reports and cases via API | BUILT | `api/test/writes.test.ts`, `api/test/http.test.ts`. eGain wiring and published test NOT RUN |
| Validation in Test AI Agent and demo link | `docs/TEST_PLAN.md` | PLANNED | |
| Fictional data, authorized content | `knowledge/`, API fixtures | BUILT | `api/src/fixtures.ts`, `api/src/companies/`, `console/index.html` |
| Outbreak, Trust Console, Scam Vaccine, Knowledge Loop (beyond the checklist) | `api/src/console.ts`, `console/trust.html` | BUILT | `api/test/console.test.ts`, `api/test/http-console.test.ts`, `api/test/console-pages.test.ts`. Not deployed; real Netlify Blobs untested |
| 150 words and 1-minute video | `docs/SUBMISSION.md` | PLANNED | |

## Scoring guide
| Criterion | Points | Where to look |
|---|---|---|
| Customer and business value | 25 | README, PRD |
| Functionality and reliability | 25 | Test results, demo link |
| Effective use of eGain | 20 | `egain/`, Friction log |
| Creativity and customer experience | 15 | Proof Code, Outbreak, DESIGN |
| Action and good judgment | 25 | Verdict rules, failure table |
| Demo video and storytelling | 15 | Video |

## Try these
1. Paste the fake 9:30 message for a demo account with no notice.
2. Use Proof Code `NP-4821` on the matching demo notice (shown on the fictional Northline home page).
3. Say "I already paid". 4. Ask something off topic.
Allow up to 5 minutes after publishing for changes to appear.

## Try the Trust Console (after deploy)
1. Open `/trust.html` and type the demo key you were given. The key is held in page memory only.
2. Report the same fictional sender from three different customers; an outbreak card appears as Suspected.
3. Approve it (the alert send is simulated), then create and approve the knowledge draft. Nothing is published.
4. Reset Demo clears everything.
