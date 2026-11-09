# PRD
Status: locked 9 Nov 2026. Changes need an entry in DECISIONS.md.

## Problem
Fake disconnection and account messages push people to call a number, open a link or install an app.
A generic checker can only judge wording. Only the company knows whether a notice is real.

Evidence (cite with source, never inflate):
- GASA 2025, 42 markets: 57% of adults encountered a scam in 12 months, 23% lost money.
- FTC: $3.5B reported lost to imposter scams in 2025.
- Amazon built a similar check for its logged-in customers (Sept 2026). This is demand proof. Never claim to be first.

## Position
Amazon built this for itself; eGain can offer the pattern to other companies.
eGain workflows handle fraud escalation. Really Us? extends protection one step earlier, before the customer pays.

## Users
Worried customer; older customer or relative; fraud-desk agent; company operator.

## Scope
| ID | Requirement | Priority |
|---|---|---|
| R1 | Grounded answers from company articles (Tier 1) | Must |
| R2 | Pre-chat damage check | Must |
| R3 | Process workflow "Check a suspicious message", mapped to an intent | Must |
| R4 | Three verdicts, each with 3 reasons and one next step | Must |
| R5 | Confirmed report and fraud case as real API actions | Must |
| R6 | Escalation with 2+ options; Direct, Knowledge Gap, Thumbs Down triggers | Must |
| R7 | Proof Code: confirms that notice only, reveals no account detail, works without login | Must |
| R8 | Outbreak: 3 distinct customers, one sender, not allowlisted | Must |
| R9 | Trust Console: outbreak card, Approve, feed, 4 counts, Reset Demo, demo key | Must |
| R10 | Scam Vaccine: approved alert shows fake pattern and real process (simulated send) | Should |
| R11 | Knowledge Loop: draft article, human approves, manual upload on trial | Should |
| R12 | Company config: one file per company; 3 fictional sectors in API tests | Should |
| R13 | Second company eGain agent, 45 minutes maximum | Could |

Tier 1 needs only a file. Tier 2 needs the API for account checks.

## Non-goals
Real customer data, payments, refund decisions, recovery promises, multi-tenant platform, voice, WhatsApp,
Telugu agent, custom chat UI, external agent frameworks, vector DB. Roadmap only: Composer or MCP ingestion, number takedown.

## Damage path
If the customer already paid, clicked or shared details: stop, contact the official bank or card channel,
use local fraud reporting from company config, open a P1 case. No recovery promise.

## Allowed claims
"Designed to plug in." "A pattern any eGain customer could add."
"Tested with three fictional companies" only after the tests pass. Real measured counts only.
