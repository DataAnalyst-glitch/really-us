# Pre-chat workflow: "Really Us Pre-chat"
Status: published v2, 5 nodes. VERIFIED (2026-11-10, owner, live chat). No API blocks and no credentials.

Purpose: tell the customer what the agent is, ask for the message to check, and hand over to the AI Agent.

## Blocks, with the exact texts as built
1. **Statement:**
   "Hi. I'm an AI assistant for Northline Power, a fictional demo company. I can check a message sent in its name. Please don't share passwords, OTPs or card numbers."
2. **Question (Text):** "Paste the message you received, or ask your question."
   - Valid: go to block 3.
   - Invalid: go to block 4.
3. **Send to AI Agent**, shown as "Sending: User Query". End.
4. **Statement (Invalid path):** "I couldn't read that. Don't call or pay yet. Please start a new chat and paste the message again." End.

## How this affects the Verify flow
The text typed in block 2 is the customer's first message. The AI Agent receives it as `{{userQuery}}`, and the Verify Message workflow uses that first message as the message to check. See [workflows.md](workflows.md) and the known limit in the root `README.md`: paste the real message as the first message.

## Notes
- The Conversation Behavior greeting ("Hi, how can I help you?") is hidden because this pre-chat statement replaces it. See [agent-settings.md](agent-settings.md).
- `/v1/verify` accepts a message of at most 600 characters; a longer one returns `MESSAGE_TOO_LONG`.
- All data in the demo is fictional.
