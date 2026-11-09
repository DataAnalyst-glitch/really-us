# Pre-chat workflow: "Really Us Pre-chat"
Status: published. VERIFIED (2026-11-10, owner, live chat).

Purpose: collect the one thing the agent needs before the conversation starts, which is the message the customer wants checked.

## Blocks, in order
1. **Greeting.** A short welcome message.
2. **Question: paste the message.** Asks the customer to paste the message they want checked.
3. **Send to AI Agent.** Hands the conversation, with the pasted message, to the AI Agent "Really Us Message Verifier".

## Customer-facing texts
The exact wording of the greeting and of the question is NOT RECORDED here, because it was not supplied for this file. Copy it from the workflow in eGain Agentic Studio before relying on this page. Do not rewrite it from memory.

| Block | Exact text as built |
|---|---|
| Greeting | NOT RECORDED. Copy from eGain. |
| Question: paste the message | NOT RECORDED. Copy from eGain. |

## Notes
- `/v1/verify` accepts a message of at most 600 characters; a longer one returns `MESSAGE_TOO_LONG`.
- The pre-chat collects no personal data. All data in the demo is fictional.
- No keys or credentials are used in this workflow.
