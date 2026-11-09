# Escalation workflow: "Really Us Escalation"
Status: published. VERIFIED (2026-11-10, owner, live chat).

Purpose: give the customer a way to reach a person when the agent cannot help, or when they ask.

## Options (two)
| Option label as built | Behaviour |
|---|---|
| Call the fraud desk | NOT RECORDED beyond the label |
| Email the fraud desk | NOT RECORDED beyond the label |

The demonstration contact details are fictional. The company config in `api/src/companies/northline.ts` lists the fraud reporting line as "Demo fraud desk phone: +1 555 0101". The exact phone and email values shown by the eGain workflow are NOT RECORDED here: copy them from eGain.

## Triggers
All three were verified firing on 2026-11-10 (owner):
| Trigger | Verified |
|---|---|
| Direct | Yes |
| Knowledge Gap | Yes |
| Thumbs Down | Yes |

## Customer-facing texts
The exact wording of the escalation message is NOT RECORDED here. Copy it from eGain Agentic Studio.

## Notes
- The full T1-T23 run (including T16 and T17 in `docs/TEST_PLAN.md`) is not done. Only the three triggers firing is recorded.
- No keys or credentials are used in this workflow.
