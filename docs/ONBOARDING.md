# Onboarding a new company
Really Us? is a reusable template, not a multi-company platform. A new company is added by hand, by a developer and an eGain builder working together. All data in this repo is fictional; a new company's demo must be fictional too.

Example: Examplia Bank is a second fictional company on the same API. It has its own config (`api/src/companies/examplia-bank.ts`), its own Process workflow "Verify Bank Message" and its own intent "Check a message from my bank". Only the verify flow is built for it (see `egain/workflows.md`, section 5).

## Steps
1. **Add the company config.** Copy `api/src/companies/northline.ts`. Set `company_id`, the display name, official channels, official senders, official domains, the Proof Code format and any company-specific scam signals. Register it in `api/src/companies/index.ts`. Run `make verify`.
2. **Supply your own notice-code (Proof Code) data.** Demo notices live in `api/src/fixtures.ts`: one record per notice with `notice_id`, `company_id`, `demo_account` and `proof_code`. A Proof Code here is demo-only: static, reusable and guessable. A production design needs per-notice one-time codes and rate limiting.
3. **Replace the knowledge files.** Write the company's own articles (see `knowledge/` for the shape: how real notices look, official channels, what to do if you already paid). Add them to the AI Agent through Point to Content.
4. **Create the intents and workflows in eGain Studio.** Use `egain/workflows.md` as the node-by-node spec. Change `"company_id"` in every API body to the new company's id. Intents are routed by their description only (no training phrases), so write a clear description for each.
5. **Attach each intent to its workflow.** Check the mapping in a new chat for every intent, as in the table at the end of `egain/workflows.md`.
6. **Set the API URL and key.** The API base is your Netlify site URL. `/v1/verify` needs no key. `/v1/reports` and `/v1/cases` need the `X-API-Key` header: store the key in an eGain External Credential, never in the repo.
7. **Deploy to Netlify.** Set `API_KEY`, `DEMO_KEY` and `DEMO_DATA_ONLY` as environment variables (names in `.env.example`; never commit values). Run `npm install` in the repo root before a CLI deploy (see the README deploy note).

> **Warning:** do not click **Retrain AI Agent** after the intents are wired to workflows. It can regenerate the intents and undo the mapping. (Owner observation; not checked from this repo.)

## Not built yet
- Self-serve onboarding: there is no sign-up or admin screen; every step above is manual.
- Per-company data separation: all companies share one Netlify Blobs store and one Trust Console.
- Per-company keys: all companies share one `API_KEY` and one `DEMO_KEY`.
