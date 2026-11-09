# Changelog
- 2026-11-09: Repo docs and harness created.
- 2026-11-09: Branch-to-main workflow and hackathon rules checklist added.
- 2026-11-09: Demo API (build steps 1-3) in `api/`: three fictional company configs, deterministic verdicts, Proof Code, verify, reports, cases, sender lookup, outbreak detection, outbreak approval, in-memory storage. Tests T1-T15 and T18 pass on the API surface.
- 2026-11-09: HTTP adapter: Netlify Functions for verify, senders, reports, cases and outbreak approve, `netlify.toml`, `.env.example`, and tests that call each function directly. Not deployed.
- 2026-11-09: `customer_text` added to successful `/v1/verify` responses: one plain string (opening line, numbered reasons, next step; max 900 characters) for eGain chat. Existing fields unchanged.
- 2026-11-09: Trust Console build: Netlify Blobs storage adapter behind the `Storage` interface; console API (`/v1/console/state`, `/v1/demo/reset`, `/v1/outbreaks/{id}/draft`, `/v1/drafts/{id}/approve`) behind `X-Demo-Key`; outbreak approval now stores a simulated Scam Vaccine alert text; `console/index.html` (fictional Northline demo home page) and `console/trust.html` (Trust Console). Not deployed.
