# Nexus AI Receptionist

A deployable, config-driven AI receptionist built on [Retell AI](https://retellai.com). One JSON file per client business + one command = a live phone number with a 24/7 receptionist that:

- answers with the business's own greeting, hours, services, and FAQs
- captures every caller's name, callback number, and reason for calling
- offers the business's booking link, or transfers to a human when configured
- logs every call to a per-client Google Sheet (no server hosting needed)

## One-time setup (you, not per client)

1. Create a Retell account at https://dashboard.retellai.com and add billing (new accounts get $10 free credit ≈ 70–90 test minutes).
2. Grab an API key: Dashboard → Settings → API Keys.
3. Install dependencies:

```bash
cd receptionist
npm install
```

## Deploy a new client (~10 minutes)

1. **Create the config:** copy `clients/_template.json` to `clients/<client-name>.json` and fill in the business details. Required: name, industry, hours, at least one service. Everything else is optional.

2. **(Optional) Set up the call-log Sheet:** follow the instructions at the top of `webhook/apps-script.js` (~3 min). Paste the resulting web app URL into the config as `actions.webhook_url`.

3. **Preview what will be deployed** (no API key needed):

```bash
npx tsx src/deploy.ts clients/<client-name>.json --dry-run
```

4. **Deploy:**

```bash
RETELL_API_KEY=your_key npx tsx src/deploy.ts clients/<client-name>.json
```

This creates the prompt (Retell LLM), the agent, and buys a phone number ($2/mo), then prints the number. Resource IDs are saved to `clients/<client-name>.state.json` — commit this file; re-running deploy updates the existing resources instead of duplicating them.

5. **Test it:** call the number, or use a free web call from the Retell dashboard (open the agent → "Test"). Check that a row appears in the call-log Sheet.

6. **Hand off:** give the client the new number directly, or have them forward their existing business line to it (all carriers support call forwarding — this is the usual setup, so they keep their known number).

## Updating a client

Edit their JSON config and re-run the same deploy command. The existing agent and phone number are updated in place.

## What it costs to run (per client, mid-2026)

| Volume | Talk time | Monthly cost |
|---|---|---|
| ~100 calls/mo | ~400 min | ~$50–75 |
| ~500 calls/mo | ~2,000 min | ~$225–300 |
| ~2,500 calls/mo | ~10,000 min | ~$1,100–1,500 |

Retell's realistic all-in rate is **$0.11–0.15/min** of talk time, plus **$2/mo** per phone number. There are no idle charges — a quiet line costs $2/mo. Price your client retainers accordingly.

## Troubleshooting

- **`RETELL_API_KEY environment variable is not set`** — export the key or prefix the command as shown above.
- **HTTP 401 from the Retell API** — key is wrong or revoked; make a new one in the dashboard.
- **HTTP 402 / payment errors when buying a number** — add a payment method to the Retell account.
- **Calls not appearing in the Sheet** — re-check the Apps Script deployment is a *Web app* with access set to *Anyone*, and that `actions.webhook_url` is the `/exec` URL. Re-run deploy after changing the config.
- **Retell API field errors (HTTP 400)** — Retell occasionally evolves its API; compare the payloads from `--dry-run` against https://docs.retellai.com/api-references and adjust `src/deploy.ts`.

## Roadmap (v2 ideas)

- Live calendar booking mid-call (Retell function calling → Google Calendar/Cal.com API) instead of reading out a link
- SMS the booking link to the caller after the call
- CRM integrations (HubSpot, Airtable) as alternatives to Google Sheets
- Multi-language support
