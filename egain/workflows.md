# Process workflows
Status: all four published. VERIFIED (2026-11-10, owner, live chats in the Test AI Agent and the Demo Link).

API base: `https://really-us-verifier.netlify.app`. `/v1/verify` is called with no authentication, by design. The two write calls (`/v1/reports`, `/v1/cases`) use the eGain External Credential named `really-us-api-key`, which sends the `X-API-Key` header. The credential value is never written in this repository.

All API blocks use: header `Content-Type: application/json`, timeouts 5000 ms (connection) and 8000 ms (response), 0 retries, and the Success Condition `status === 200 && body.success === true`. The API contract is in `docs/TECHNOLOGY.md`.

## 1. Verify Message (published v3)
Intents: Fraud Prevention and Security Awareness.
1. **Question (Text):** "Please paste the full message you received." Skipped when the first message was already answered. Invalid: statement "We could not check...".
2. **Question (Text):** "Which phone number or sender name did the message come from? Type unknown if you don't know." Invalid: "Sorry, I didn't get that. Please start again."
3. **API:** `POST https://really-us-verifier.netlify.app/v1/verify`, no authentication.
   Body: `{"company_id":"northline","message":"{{userQuery}}","sender":"{{verifySender}}"}`
   Mappings: `customer_text` to `customer_text`, `verdict` to `verdict`, `warning` to `warning`.
4. **On success:** Statement `{{customer_text}}`. End.
   **On Error and On Timeout:** Statement "We could not check this right now. Don't call or pay yet. Please use the company's official channels." End.

Notes:
- `warning` is mapped but not shown as its own line. The API puts an approved-outbreak warning inside `customer_text` ("Heads-up: ...").
- `{{userQuery}}` is the customer's first message. If the first message is not the pasted message, that sentence is checked as the message, and the next reply becomes the sender.

## 2. Verify With Proof Code (published v1)
Intent: Verify with a Proof Code.
1. **Question (Text):** "Please type the Proof Code printed on your notice (it looks like NP-1234)." Invalid: "Sorry, I didn't get that. Please start again."
2. **API:** `POST https://really-us-verifier.netlify.app/v1/verify`, no authentication.
   Body: `{"company_id":"northline","message":"{{userQuery}}","proof_code":"{{proofCode}}"}`
   Mappings: `customer_text`, `verdict`.
3. **On success:** Statement `{{customer_text}}`. End.
   **On Error and On Timeout:** "I couldn't check that just now. Please try again or contact the fraud desk." End.

Notes:
- `{{userQuery}}` is whatever the customer typed first. The check confirms the Proof Code (one notice). It does not compare the notice text.
- The demo code is `NP-4821`, which gives "Genuine notice found" (T3 in `docs/TEST_PLAN.md`). A wrong code such as `NP-9999` is not genuine.

## 3. Report Message (published v2)
Intent: Report a suspicious message.
1. **Statement:** "I can send this report to the fraud team. Please don't share passwords or codes."
2. **Question (Text):** "What phone number or sender name did the message come from?" Invalid: "Sorry, I didn't get that. Please start the report again."
3. **Question (Select Yes/No):** "Do you confirm you want to report this message? Yes or No."
   No: "Okay, nothing was sent." End. Invalid: the "Sorry" statement.
4. **Set Variable:** `reportKey` = `rep-{{sessionId}}`.
5. **API:** `POST https://really-us-verifier.netlify.app/v1/reports`, description "Send confirmed fictional report to the fraud team", External Credential `really-us-api-key`.
   Body: `{"company_id":"northline","sender":"{{reportSender}}","customer_ref":"{{sessionId}}","message":"{{userQuery}}","confirmed":true,"idempotency_key":"{{reportKey}}"}`
   Mapping: `report_id` to `reportRef`.
6. **On success:** "Thank you. Your report was sent. Reference: {{reportRef}}." End.
   **On Error and On Timeout:** "I couldn't send the report just now. Please try again or contact the fraud desk." End.

v2 is published and has the Success Condition `status === 200 && body.success === true`. It was tested in chat with a normal report reference. The failure branch itself was not exercised from chat (see "Demo failure paths" below).

Notes from the API contract:
- `customer_ref` is the chat session id (a known limit).
- The API ignores the `message` field on reports and does not store it.
- The key `rep-{{sessionId}}` is the same for every report in one chat. A second report in the same chat with a different sender is rejected by the API as a reused key (409), and the customer would see the error text.

## 4. Open Case (published v2)
Intent: I already paid or shared details.
1. **Statement:** "I'm sorry this happened. I'll open a case so a person can review it. Please don't share more details here."
2. **Question (Select):** "What happened?" Options: Already paid, Shared details, Clicked link, Installed app.
3. **Question (Select Yes/No):** "Do you confirm you want me to open a case? Yes or No." No: "Okay, nothing was sent." End.
4. **Conditional "Normalize caseReason":** matches the option ids `OPTION_1` to `OPTION_4` and the labels. Four Set Variable blocks set `caseReason` to `ALREADY_PAID`, `SHARED_DETAILS`, `CLICKED_LINK` or `INSTALLED_APP`. Anything else continues unchanged. This was added after the first live chat sent the reason `OPTION_1`. Afterwards the Trust Console showed `ALREADY_PAID` and `CLICKED_LINK`.
5. **Set Variable:** `caseKey` = `case-{{sessionId}}`.
6. **API:** `POST https://really-us-verifier.netlify.app/v1/cases`, description "Open a case for the fraud team", External Credential `really-us-api-key`.
   Body: `{"company_id":"northline","priority":"P1","reason":"{{caseReason}}","summary":"Customer reported damage after a suspicious message. Chat session {{sessionId}}.","confirmed":true,"idempotency_key":"{{caseKey}}"}`
   Mappings: `case_id` to `caseId`, `next_step` to `caseNextStep`.
7. **On success:** "Your case is open. Case number: {{caseId}}. {{caseNextStep}}" End.
   **On Error and On Timeout:** "I couldn't open the case just now. Please contact the fraud desk." End.

Note: the key `case-{{sessionId}}` is the same for every case in one chat, so a second case with a different reason in the same chat is rejected as a reused key.

## Intent mapping (verified in chat)
| Intent | Process workflow |
|---|---|
| Fraud Prevention and Security Awareness | Verify Message |
| Report a suspicious message | Report Message |
| Verify with a Proof Code | Verify With Proof Code |
| I already paid or shared details | Open Case |

Routing was stable: 5 of 5 new sessions routed the check-a-message request to Verify (R-T15 in `docs/TEST_PLAN.md`).

## Demo failure paths
The API has two demo failure triggers, `TESTFAIL` for verify and `TESTFAILWRITE` for reports and cases. They fire on the `company_id` field only (exact match, and only when `DEMO_DATA_ONLY` is `true`). These workflows send `"company_id":"northline"`, so the paths cannot be reached from the chat. They are verified by unit tests (T8 and T9) and by direct API calls, not from the chat. The error and timeout branches in each workflow are wired but not exercised from chat.

## Other facts from the 2026-11-10 run
- The off-topic filter turns away unrelated questions, gibberish, an injection sentence, a very long first message and "TESTFAIL" as the first message, with the single text in [agent-settings.md](agent-settings.md).
- The eGain Test panel hides some mapped values, so some mappings were checked in the chat itself.
