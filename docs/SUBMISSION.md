# Submission
Target: before 13 Nov 2026 10:00 IST unless the organizers confirm a later date.

**Agent:** Really Us? (named "Really Us Message Verifier" in eGain, because the display name rejects "?") **Industry:** Utilities (fictional demo). **Use case:** verify messages sent in a company's name.

## Description (under 150 words)
Really Us Message Verifier helps customers of a utility check a suspicious text, email or call before they act. It aims to give customers a clear answer and to give support teams earlier warning of scam waves. A customer pastes the message into the eGain chat. A workflow sends it to a small API that returns a deterministic verdict, three plain reasons and one next step. A Proof Code printed on a real notice can confirm that one notice. Customers can report a sender or open a case. When three different chat sessions report the same sender, the Trust Console suggests an outbreak alert, and a person must approve it before later customers see the warning. People also approve knowledge drafts. The AI suggests; the workflow decides; a human approves. A second fictional company, Examplia Bank, runs the verify flow on the same API. All data is fictional.

## Links
Note: After creation the eGain settings box shows an empty URL field, but the Demo Link itself works, so the link is kept in this repository.

- Demo Link (eGain): https://ai.egain.cloud/d3y6/system/web/apps/aiagent/demo.html?agentId=714122e0-9c7e-4143-8554-12afacbf3728&backgroundUrl=https://cdn.aiagent.egain.cloud/TMPRODB52840291/screenshots/7ac7046c-bc4b-4b04-b0af-a67ce25d3f2c.png
- Live demo site and API: https://really-us-verifier.netlify.app
- Trust Console: https://really-us-verifier.netlify.app/trust.html (needs the demo key, which is not recorded in the repo)

## Testing
The Trust Console is protected by a demo key and is shown in the demo video. Judges who want to try it can email contact@srdevelopers.live to request a temporary key. It controls fictional demo data only.

## Checklist
- [ ] Agent trained, tested, published
- [x] Content authorized, no sensitive data (fictional content only; secrets scan of the tree and full history on 2026-11-10 found none; see docs/DECISIONS.md)
- [x] Pre-chat, escalation, process work; process on an intent (owner-verified 2026-11-10; see egain/)
- [ ] Demo link works in a clean browser
- [x] Description complete (148 words, within the 150-word limit; checked by `scripts/harness_check.py`)
- [ ] 1-minute video complete
- [ ] Submitted on every required channel
