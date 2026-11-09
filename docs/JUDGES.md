# Judge guide
Status values: PLANNED, BUILT, VERIFIED. Update with evidence links as work completes.

## Rule-to-evidence map
| Hackathon requirement | Implementation | Status | Evidence |
|---|---|---|---|
| Knowledge-based AI Agent | `knowledge/`, eGain sources | BUILT | 6 fictional articles trained; 4 grounded answers in `docs/TEST_PLAN.md`. Generated-intent review not recorded |
| Published experience, demo link | eGain publish | VERIFIED | Demo Link in `README.md`; opens without a code; chat answered on desktop and phone (owner, 2026-11-10) |
| Pre-chat workflow | `egain/pre-chat.md` | VERIFIED | "Really Us Pre-chat" published and run (owner, 2026-11-10) |
| Escalation, 2+ options | `egain/escalation.md` | VERIFIED | Call and Email the fraud desk; Direct, Knowledge Gap and Thumbs Down fired (owner, 2026-11-10) |
| Process workflow on an intent | `egain/workflows.md` | VERIFIED | Four Process workflows mapped to intents and run in chat (owner, 2026-11-10) |
| Actions | Reports and cases via API | BUILT | `api/test/writes.test.ts`, `api/test/http.test.ts`. Report and case flows ran in chat and returned a report reference and a case number (owner, 2026-11-10). "Actions enabled and added to the AI Agent" is not recorded |
| Validation in Test AI Agent and demo link | `docs/TEST_PLAN.md` | BUILT | "Run on 2026-11-10" lists the chats run. The full T1-T23 run is NOT done |
| Fictional data, authorized content | `knowledge/`, API fixtures | BUILT | `api/src/fixtures.ts`, `api/src/companies/`, `console/index.html` |
| Outbreak, Trust Console, Scam Vaccine, Knowledge Loop (beyond the checklist) | `api/src/console.ts`, `console/trust.html` | BUILT | `api/test/console.test.ts`, `api/test/http-console.test.ts`, `api/test/console-pages.test.ts`. Outbreak end to end verified in production (owner, 2026-11-10): 3 chat sessions, Suspected, person approval, warning shown to the next customer, draft created and approved |
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
Open the Demo Link in README.md (no code needed).
1. Paste the fake 9:30 message for a demo account with no notice.
2. Use Proof Code `NP-4821` on the matching demo notice (shown on the fictional Northline home page).
3. Say "I already paid". 4. Ask something off topic.
Allow up to 5 minutes after publishing for changes to appear.

## Try the Trust Console (live)
1. Open `/trust.html` and type the demo key you were given. The key is held in page memory only.
2. Report the same fictional sender from three different customers; an outbreak card appears as Suspected.
3. Approve it (the alert send is simulated), then create and approve the knowledge draft. Nothing is published.
4. Reset Demo clears everything.

## Known limits
- The scam rules are deliberately narrow. "Pay now or your power is cut", with no time word, link or phone number, is not flagged. The reply says "no matching notice" and "do not act on it yet".
- The customer reference for outbreak counting is the chat session id, so one person opening three chats could trigger an outbreak.
- Alerts are simulated. Nobody is contacted.
- No knowledge upload: approving a draft only records the approval. No API was found to create eGain knowledge articles.
- Two requests with the same new idempotency key at the same instant are not atomic.
- The eGain Test panel hides some mapped values.
- Not done yet: the video, the final description edit, the full T1-T23 run, the submission channel, participant information, license and repo visibility.
