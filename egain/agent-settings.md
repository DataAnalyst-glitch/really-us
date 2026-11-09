# Agent settings
Status: VERIFIED (2026-11-10, owner, read from eGain Agentic Studio).

| Setting | Value |
|---|---|
| Display name | Really Us Message Verifier (the display name rejects "?") |
| Language | English (US) |
| Tone | Professional |
| Topic Identification | On |
| Certified Answers threshold | 0.75 |
| Escalation mode | Escalation Workflows |
| Direct Escalation | "Really Us Escalation" |
| Knowledge Gap Escalation | "Really Us Escalation" |
| Dislike / Thumbs Down | "Really Us Escalation" |

## Texts, exactly as set
- **Conversation Behavior greeting (Static):** "Hi, how can I help you?" It is hidden, because the Pre-chat statement replaces it.
- **Topic Identification Failure Message:** "I can only help with messages sent in Northline's name and Northline billing, disconnection or scam questions. To reach a person, type: talk to a person."

## What the failure message covers
One text answers everything the topic filter rejects: off-topic questions, gibberish, a prompt-injection sentence typed as the first message, a very long first message, and the word TESTFAIL typed as the first message. In the Test AI Agent runs these were turned away with this text and no invented answer (`docs/TEST_PLAN.md`).

## Process workflows and Pre-chat
See [pre-chat.md](pre-chat.md), [workflows.md](workflows.md) and [escalation.md](escalation.md).
