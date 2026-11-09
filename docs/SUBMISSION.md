# Submission
Target: before 13 Nov 2026 10:00 IST unless the organizers confirm a later date.

**Agent:** Really Us? (named "Really Us Message Verifier" in eGain, because the display name rejects "?") **Industry:** Utilities (fictional demo). **Use case:** verify messages sent in a company's name.

## Description (under 150 words; update to match what is built)
Scammers send messages threatening to cut off a customer's power tonight, and customers have no quick way to ask the real company. Really Us? is a customer-support agent that answers one question: is this message really from us? Built on eGain, it checks a pasted message against official guidance and a demo account or Proof Code, then gives one of three verdicts with three reasons and a next step. After explicit confirmation it reports the sender or opens a fraud case. When three different customers report one sender, a person approves a simulated warning in a Trust Console and reviews a draft help article; nothing is sent or published automatically. If someone already paid or shared details, it opens a priority case and never promises recovery. Companies can use it to protect customer trust. Its distinctive advantage: only the company can verify its own notices. All data is fictional.

## Links
Note: After creation the eGain settings box shows an empty URL field, but the Demo Link itself works, so the link is kept in this repository.

- Demo Link (eGain): https://ai.egain.cloud/d3y6/system/web/apps/aiagent/demo.html?agentId=714122e0-9c7e-4143-8554-12afacbf3728&backgroundUrl=https://cdn.aiagent.egain.cloud/TMPRODB52840291/screenshots/7ac7046c-bc4b-4b04-b0af-a67ce25d3f2c.png
- Live demo site and API: https://really-us-verifier.netlify.app
- Trust Console: https://really-us-verifier.netlify.app/trust.html (needs the demo key, which is not recorded in the repo)

## Checklist
- [ ] Agent trained, tested, published
- [x] Content authorized, no sensitive data (fictional content only; secrets scan of the tree and full history on 2026-11-10 found none; see docs/DECISIONS.md)
- [x] Pre-chat, escalation, process work; process on an intent (owner-verified 2026-11-10; see egain/)
- [ ] Demo link works in a clean browser
- [ ] Description and 1-minute video complete
- [ ] Submitted on every required channel
