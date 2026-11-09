# Escalation workflow: "Really Us Escalation"
Status: published v2. VERIFIED (2026-11-10, owner, live chat). No API blocks and no credentials.

Purpose: give the customer a way to reach a person.

## Blocks, with the exact texts as built
1. **Statement:** "I'll help you reach a person. Please don't call, pay or share codes using details from any unverified message."
2. **Question (Select):** "How would you like to contact the fraud desk?" Options: "Call the fraud desk" and "Email the fraud desk".
3. **Call the fraud desk -> Statement:** "Demo fraud desk phone: +1 555 0101. Tell them you checked a suspicious message." End.
4. **Email the fraud desk -> Statement:** "Email notices@northline.example with a copy of the message. Do not include passwords or OTPs." End.

The phone number and the email address are fictional demonstration contacts (the same values as in `api/src/companies/northline.ts`).

Not confirmed: where the Invalid output of the Select question goes.

## Triggers
Direct Escalation, Knowledge Gap Escalation and Dislike/Thumbs Down all use this workflow ("Escalation mode: Escalation Workflows", see [agent-settings.md](agent-settings.md)). All three were verified firing on 2026-11-10 (owner). The Test AI Agent run of "I want to talk to a person" showed the two buttons; the buttons were not clicked in that run (`docs/TEST_PLAN.md`, Part A, A6).

## Notes
- The off-topic message also points customers here: "To reach a person, type: talk to a person."
- The full T1-T23 run is not done. Only what is listed in `docs/TEST_PLAN.md` under "Run on 2026-11-10" is recorded.
