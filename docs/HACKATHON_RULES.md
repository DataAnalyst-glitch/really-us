# Hackathon rules: source of truth
Source: eGain AI Agent Hackathon page and Devpost listing, read 9 Nov 2026. Re-check before submitting. Every item must stay covered.

## Solution requirements
- [ ] 01 Knowledge-based AI Agent: authorized content; agent language matches source content; generated intents reviewed; answer accuracy tested. Partly shown: 6 fictional articles trained and 4 grounded answers recorded (docs/TEST_PLAN.md). Left unchecked: review of the generated intents is not recorded
- [x] 02 Published experience: personalized and published; working shareable demo link. Evidence (owner-verified 2026-11-10): Demo Link made from Personalize and Publish, previewing on https://really-us-verifier.netlify.app; it opens without a code and the chat answered on desktop and phone (the eGain settings box shows an empty URL after creation, but the link works). Link in README.md
- [x] 03 Pre-chat workflow: collects useful information before the AI Agent. Evidence (owner-verified 2026-11-10): published "Really Us Pre-chat" (greeting, paste-message question, Send to AI Agent). See egain/pre-chat.md
- [x] 04 Escalation workflow: at least two escalation or contact options; demonstration contact details. Evidence (owner-verified 2026-11-10): "Really Us Escalation" with Call the fraud desk and Email the fraud desk; Direct, Knowledge Gap and Thumbs Down triggers all fired. See egain/escalation.md
- [x] 05 Process workflow: guides a task, decision or recommendation; connected to an appropriate intent. Evidence (owner-verified 2026-11-10): four published Process workflows mapped to intents and checked in chat. See egain/workflows.md
- [ ] 06 Actions: a real action on the customer's behalf; actions enabled and added to the AI Agent. Partly shown: Report Message and Open Case call the live API and return a report reference and a case number (owner-verified 2026-11-10). Left unchecked: "actions enabled and added to the AI Agent" is not recorded
- [ ] 07 Validation: agent and all workflow paths tested in Test AI Agent and through the published demo link; allow up to 5 minutes after publishing. Partly shown: every workflow was run at least once in chat (docs/TEST_PLAN.md, "Run on 2026-11-10"). Left unchecked until the full T1-T23 run is done
- [ ] Goes beyond visual customization: valuable use case, thoughtful workflows, original experience

## Submission requirements
- [ ] Participant or team information
- [x] Agent name, industry, use case (docs/SUBMISSION.md; the agent in eGain is named "Really Us Message Verifier")
- [x] Working demo link (README.md and docs/SUBMISSION.md; opens without a code, owner-verified 2026-11-10)
- [x] Description up to 150 words: problem, intended user, business value, distinctive features. Evidence: `docs/SUBMISSION.md`, 144 words (harness-checked). It states the problem, the intended user (utility customers), the business value (a clear answer for customers and earlier warning of scam waves for support teams) and the distinctive features
- [ ] One-minute video: content-based answer, at least one workflow, most valuable or distinctive feature
- [ ] Confirmation that all required workflows were published and tested
- [ ] Ready for temporary reviewer access or a short live demo

## Content and conduct
- [x] Only content and assets owned, authorized, or supplied for the hackathon. Evidence: `knowledge/` holds 6 articles written for this project and each is marked fictional; no other content or assets are used; code dependencies are listed in `docs/DECISIONS.md`
- [x] No confidential information, personal data, passwords, account numbers or real customer records. Evidence: all data is fictional (`api/src/fixtures.ts`, `api/src/companies/`); the harness scans for key patterns on every run; Secrets scan 2026-11-10: working tree and all 25 commits on every ref (history and commit messages) checked for key and token prefixes, private key blocks, JWTs, env files and long key-like strings. No secrets found; only test placeholders and a public Demo Link path. See docs/DECISIONS.md.
- [x] Fictional test data and demonstration contact details. Evidence: 555-range numbers and `.example` domains in `api/src/companies/`, fixtures in `api/src/fixtures.ts`, labels on `console/index.html`; fictional names recorded in `docs/DECISIONS.md`
- [x] Material pre-existing templates, code and third-party assets disclosed. Evidence: section "Pre-existing templates, code, third-party assets" in `docs/DECISIONS.md` (typescript, vitest, @types/node, @netlify/blobs); AI-tool use disclosed in `README.md`; MIT `LICENSE` added
- [ ] Able to explain and demonstrate the solution
- [ ] eGain platform terms and community guidelines followed
- [ ] No plagiarism, harmful content, misrepresentation, interference or vote manipulation

## Judging (125 points)
Customer and business value 25; Functionality and reliability 25; Effective use of eGain 20; Creativity and customer experience 15; Action and good judgment 25; Demo video and storytelling 15.
Tie-breakers: Functionality and reliability, then Demo video and storytelling, then Customer and business value.

## Open with organizers
Final deadline (Nov 12 11:30 PM EST on Devpost; Nov 15 11:59 PM PST on eGain); submission channel; cash eligibility and payment for remote entrants; trial connectors.
Eligibility: above legal age of majority; individual or team up to 3; one submission per participant.
