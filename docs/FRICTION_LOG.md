# eGain friction log
Constructive builder feedback, written as it happens. Facts only.

| Date | Area | What happened | Impact | Workaround | Suggestion |
|---|---|---|---|---|---|
| 2026-11-09 | Hackathon info | Devpost shows Nov 12 11:30 PM EST; the eGain page shows Nov 15 11:59 PM PST | Unclear deadline | Plan for the earlier date | One authoritative date |
| 2026-11-09 | Hackathon info | eGain page says submit on its page; Devpost has its own submission | Unclear where to submit | Asked organizers | State the required channel |
| 2026-11-09 | Support bot | eGain site chat replied with a topic list to a hackathon question | No answer or next step | Used the contact email | Add hackathon content or a handoff |
| 2026-11-09 | Signup | Trial form rejected Gmail ("Use a valid business email"); hackathon page says a working email is enough | Blocked until a domain email was used | Used own domain email | Allow personal email for hackathon entrants, or state the rule on the page |
| 2026-11-09 | Agent setup | Display name rejects "?" | Brand name changed | Removed the character | Allow common punctuation in display names |
| 2026-11-09 | Hackathon info | The Discord invite link on the hackathon page shows as invalid or expired | No way to reach the community channel for questions | Used the contact email | Keep the invite link current or use a non-expiring one |
| 2026-11-09 | Workflow editor | No preview for a draft Process workflow | Cannot see the customer-facing result before publishing | Test one block at a time | Add a draft preview |
| 2026-11-09 | Chat runtime | No run indicator shows whether an answer came from a workflow or from knowledge | Hard to tell which path handled a message | Judged from the wording of the reply | Show the path used for each reply |
| 2026-11-09 | API block | The API block's main output has no Success label | Hard to pick the field for the Success Condition | Used body.success in the condition | Label the main output fields |
| 2026-11-09 | API block | The Test panel hides mapped values | Cannot confirm a response mapping works from the test | Checked the raw response instead | Show mapped variable values in Test |
| 2026-11-09 | Chat | Blank lines in a reply are removed in chat | Multi-line text collapses into one block | Added customer_text as one plain string | Keep line breaks, or document the rule |
| 2026-11-09 | Variables | An array variable is shown as raw text like ['a', 'b'] | Reasons list looks broken to customers | Added customer_text with numbered reasons | Render arrays as a list or join them |
| 2026-11-09 | AI Agent routing | The same question was routed to different paths in different sessions | Results are not repeatable for testing | Re-ran the test and noted both outcomes | Make routing repeatable or explain why it varies |
| 2026-11-10 | Knowledge | No API was found to create knowledge articles; content is added through Point to Content (files, website crawl, portal) | An approved draft cannot be sent to eGain knowledge automatically | The Knowledge Loop stops at human approval; upload is manual | An API or webhook to create or update articles |
