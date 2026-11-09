# Really Us?
**Everyone tries to spot the fake. We prove the real.**

A customer gets "Your power will be cut at 9:30 tonight." Really Us?, built on eGain AI Agent,
lets them ask the only party that knows: the company named in the message.

> All companies, accounts, numbers and notices are fictional demo data.

## For judges: 60-second tour
| Want to | Go to |
|---|---|
| Try the agent | Demo link: `TO_ADD_AFTER_PUBLISH` |
| See the 1-minute video | `TO_ADD_AFTER_RECORDING` |
| Check every rule against evidence | [docs/JUDGES.md](docs/JUDGES.md) |
| See test results | [docs/TEST_PLAN.md](docs/TEST_PLAN.md) |
| Understand the design | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Read platform feedback for eGain | [docs/FRICTION_LOG.md](docs/FRICTION_LOG.md) |

## What it does
1. **Checks** a pasted message against official guidance and a demo account.
2. **Explains** one of three verdicts with 3 reasons and one next step.
3. **Acts** after confirmation: reports the sender or opens a fraud case.
4. **Learns**: 3 distinct reports suggest an outbreak; a person approves a prebunk alert and a knowledge draft.

## Repo map
`docs/` product, design, architecture, tests, decisions, friction log
`egain/` node-by-node eGain build specs (the "Trust Check" template)
`knowledge/` fictional articles for the agent
`api/` demo API and tests | `console/` Trust Console and demo page
`test-results/` recorded evidence | `CLAUDE.md` rules for coding agents

## Run
`make verify` runs the harness checks and tests.

## AI use and disclosure
Built with Claude Code and other AI tools, as the rules permit. The author reviewed and can explain the solution.
Pre-existing templates, code or third-party assets are listed in `docs/DECISIONS.md`.
Not affiliated with or endorsed by eGain or any company named in research.
