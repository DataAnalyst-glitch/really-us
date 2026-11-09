# Really Us?
**Everyone tries to spot the fake. We prove the real.**

A customer gets "Your power will be cut at 9:30 tonight." Really Us?, built on eGain AI Agent,
lets them ask the only party that knows: the company named in the message.

> All companies, accounts, numbers and notices are fictional demo data.

## For judges: 60-second tour
| Want to | Go to |
|---|---|
| Try the agent | [Demo Link](https://ai.egain.cloud/d3y6/system/web/apps/aiagent/demo.html?agentId=714122e0-9c7e-4143-8554-12afacbf3728&backgroundUrl=https://cdn.aiagent.egain.cloud/TMPRODB52840291/screenshots/7ac7046c-bc4b-4b04-b0af-a67ce25d3f2c.png) (opens without a code) |
| See the live demo site | [https://really-us-verifier.netlify.app](https://really-us-verifier.netlify.app) |
| See the 1-minute video | `TO_ADD_AFTER_RECORDING` |
| Check every rule against evidence | [docs/JUDGES.md](docs/JUDGES.md) |
| See test results | [docs/TEST_PLAN.md](docs/TEST_PLAN.md) |
| Understand the design | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Read platform feedback for eGain | [docs/FRICTION_LOG.md](docs/FRICTION_LOG.md) |

## What it does
1. **Checks** a pasted message against official guidance and a demo account.
2. **Explains** one of three verdicts with 3 reasons and one next step.
3. **Acts** after confirmation: reports the sender or opens a fraud case.
4. **Learns**: 3 distinct reports suggest an outbreak; a person approves a simulated alert and a knowledge draft in the Trust Console. Nothing is sent or published automatically.

## Repo map
`docs/` product, design, architecture, tests, decisions, friction log
`egain/` node-by-node eGain build specs (the "Trust Check" template)
`knowledge/` fictional articles for the agent
`api/` demo API and tests | `console/` Trust Console and demo page
`test-results/` recorded evidence | `CLAUDE.md` rules for coding agents

## Status (honest)
| Part | State |
|---|---|
| Demo API (verify, Proof Code, reports, cases, outbreaks, approval) | Built; unit tests; running in production |
| Netlify Functions HTTP layer | Built and running at https://really-us-verifier.netlify.app |
| Storage (Netlify Blobs) | Running in production; reports, cases and outbreaks persisted (owner-verified 2026-11-10) |
| Trust Console (`console/trust.html`) and demo home page (`console/index.html`) | Running in production; outbreak approval and draft approval done in it |
| eGain agent and workflows | Published and run in chat (owner-verified 2026-11-10). Facts are recorded in `egain/` and `docs/TEST_PLAN.md`; they cannot be re-checked from this repo |
| Full test run (T1-T23) on eGain | Not done. Only the chats listed in `docs/TEST_PLAN.md` under "Run on 2026-11-10" were run |
| Video, final description, submission channel, participant info, license | Not done |

## Live URLs
- Demo Link (eGain agent): https://ai.egain.cloud/d3y6/system/web/apps/aiagent/demo.html?agentId=714122e0-9c7e-4143-8554-12afacbf3728&backgroundUrl=https://cdn.aiagent.egain.cloud/TMPRODB52840291/screenshots/7ac7046c-bc4b-4b04-b0af-a67ce25d3f2c.png
- Demo site and API: https://really-us-verifier.netlify.app (Trust Console at `/trust.html`, needs the demo key)

## Known limits
- The scam rules are deliberately narrow. A message such as "pay now or your power is cut", with no time word, no link and no phone number, is not flagged. The reply says "no matching notice" and "do not act on it yet", and that finding no known patterns does not mean the message is genuine.
- The customer reference used for outbreak counting is the chat session id. One person opening three chats could trigger an outbreak.
- Alerts are simulated. Nobody is contacted.
- There is no knowledge upload. Approving a draft only records the approval; nothing goes to eGain knowledge.
- Two requests with the same new idempotency key at the same instant are not atomic on Blobs. A retry after the first finishes is safe.
- The eGain Test panel hides some mapped values, so some checks were made in the chat itself.
- The full T1-T23 run on eGain is not done yet.

## Endpoints
`POST /v1/verify`, `GET /v1/senders/{hash}`, `POST /v1/reports` and `POST /v1/cases` (`X-API-Key`), and the Trust Console endpoints (`X-Demo-Key`): `GET /v1/console/state`, `POST /v1/outbreaks/{id}/approve`, `POST /v1/outbreaks/{id}/draft`, `POST /v1/drafts/{id}/approve`, `POST /v1/demo/reset`. Details: [docs/TECHNOLOGY.md](docs/TECHNOLOGY.md).

## Run
`make verify` runs the harness checks and tests. Keys are set as environment variables (`API_KEY`, `DEMO_KEY`, `DEMO_DATA_ONLY`); see `.env.example` for the names. Never commit values.

Deploy note: the functions need `@netlify/blobs` resolvable from the repo root. Run `npm install` in the repo root (not only in `api/`) before a CLI deploy. A Netlify build runs `npm ci --omit=dev` itself.

## AI use and disclosure
Built with Claude Code and other AI tools, as the rules permit. The author reviewed and can explain the solution.
Pre-existing templates, code or third-party assets are listed in `docs/DECISIONS.md`.
Not affiliated with or endorsed by eGain or any company named in research.
