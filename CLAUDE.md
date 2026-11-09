# Really Us? - instructions for Claude Code

Read this file first, then `docs/HACKATHON_RULES.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/TECHNOLOGY.md`.

## What this is
A customer-service agent on eGain that answers: "Is this message really from us?"
Customer conversation lives in eGain. This repo holds the demo API, Trust Console,
demo page, knowledge articles, eGain build specs, tests and evidence.

## Golden rules
1. AI suggests; the workflow decides. Never let model text create a record.
2. Writes require `confirmed=true` and an `idempotency_key`, enforced in the API.
3. Only three verdicts: `MATCHES_SCAM_SIGNS`, `NO_MATCHING_NOTICE`, `GENUINE_NOTICE_FOUND`.
   A failed check is an error path, never a verdict. Never output "safe".
4. `GENUINE_NOTICE_FOUND` requires a matching notice for that demo account or a valid Proof Code.
5. Official senders are allowlisted and can never enter an outbreak. Only distinct customers count.
6. Outbreak alerts and knowledge drafts need human approval in the console.
7. Fictional data only. No real names, phones, account numbers, OTPs or card data.
8. Never promise recovery of lost money. Never show a reference unless the API returned success.
9. No CrewAI, Dify, vector DB, custom chat UI or multi-tenant auth. Scope changes need `docs/DECISIONS.md`.
10. Claims must have evidence. Never say "first", "integrated with", "prevents losses", or a % saved.

## Git workflow
Never commit or push directly to `main`. Use one branch per task (`feat/...`, `fix/...`, `docs/...`), run `make verify`,
open a pull request to `main`, and merge only when CI passes. `main` must always be demo-ready.

## Hackathon rules
`docs/HACKATHON_RULES.md` is the source of truth. Every task must keep every rule covered.
Update its checkboxes and `docs/JUDGES.md` evidence only after a rule is actually verified.

## Definition of done (every task)
Run `make verify` (on Windows without make: `python scripts/harness_check.py`, then the API test command). All of it must pass before saying a task is done:
- `python3 scripts/harness_check.py` (docs, rule map, claims)
- unit and behavioral tests (assert state, not wording)
Then update `docs/CHANGELOG.md`, and `docs/TEST_PLAN.md` results if behavior changed.
If a check fails, fix the cause. Do not weaken or delete a test to pass.

## Friction log
Any eGain confusion, limit, doc gap or workaround goes in `docs/FRICTION_LOG.md` as it happens,
including time lost. Facts only. Be constructive; it is useful product feedback for eGain.

## Assumptions
Mark unverified platform facts `ASSUMPTION` and verified ones `VERIFIED (date, how)`.
If a requirement conflicts with what the eGain account allows, stop and report it.

## Build order
1. API contract + fixtures + tests  2. Proof Code + verify  3. Reports, outbreak, anti-poisoning
4. Console + demo page  5. Knowledge drafts  6. Deploy  7. eGain build (human, from `egain/`)
8. End-to-end tests  9. Video and submission  10. Second company agent, 45 minutes maximum

Keep changes small. Do not refactor unrelated code.
