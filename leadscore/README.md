# leadscore

A standalone lead-scraper pipeline for Nexus. It discovers home-service
businesses, enriches them with contact + social data pulled from **their own**
public web presence, scores whether they've **already** adopted AI call
handling, and exports qualified leads to an `.xlsx` sorted **hottest-first**.

Built to the architecture in `nexusleadscraperplan.md`. This repo had no
existing `leadgen` module to extend, so every client (Google Places, Hunter.io,
Twilio Lookup, Claude Haiku, Supabase) is implemented here from scratch using
native `fetch` — the only runtime dependencies are `exceljs` and `dotenv`.

## Quick start

```bash
cd leadscore
npm install

# 1. Free dry-run — mocks every paid API with realistic fake data.
npm run dry-run
# or with options:
node src/index.js --dry-run --cities="San Rafael, CA; Novato, CA" --target=50

# 2. Live run — copy .env.example to .env and fill in keys first.
cp .env.example .env   # then edit
node src/index.js --target=50 --cities="San Rafael, CA"
```

Outputs land in `./out/`:

| File | What it is |
|------|-----------|
| `leads.xlsx` | One row per qualified lead, sorted by `lead_score` desc. 21 columns. |
| `instantly.csv` | Instantly-ready CSV (email + merge vars) for cold email. |
| `manual-verify-queue.txt` | Top 25 leads' name + phone for you to **hand-dial**. |

Qualified rows are also upserted to Supabase (when configured).

### CLI flags

| Flag | Default | Notes |
|------|---------|-------|
| `--dry-run` | off | Mock Places/Hunter/Twilio/Claude/Supabase. No keys, no cost. |
| `--cities="A, ST; B, ST"` | Marin County list | **Semicolon-separated** — city names contain commas. |
| `--target=N` | all | Cap total discovered businesses. |
| `--out=DIR` | `out` | Output directory. |

## Pipeline stages

1. **Discover** (`stages/discover.js`) — Google Places API (New) Text Search
   over `categories × cities`. Dedupes by `place_id`, drops non-operational.
2. **Enrich** (`stages/enrich.js`) — fetches each business's homepage +
   `/contact` + `/about`, extracts email / phone / owner / social URLs via
   regex **and** a Claude Haiku pass, then falls back to Hunter.io by domain if
   no on-site email is found.
3. **Fingerprint** (`stages/fingerprint.js`) — Twilio Lookup line type +
   website automation signatures → `maturity_score` (0-100). **Low = hot.**
4. **Score & filter** (`stages/score.js`) — hard-drops must-have failures, then
   ranks survivors by a weighted `lead_score`.
5. **Output** (`stages/output.js`) — personalisation note per lead, then
   `.xlsx` / CSV / call-queue / Supabase.

## Compliance (baked in, do not loosen)

- **No scraping of Instagram / Facebook / LinkedIn / Nextdoor.** Social URLs
  come *only* from links a business publishes on its own site. No platform
  logins, no headless harvesting of those sites.
- **Only the business's own public site is fetched**, respecting `robots.txt`,
  with a real User-Agent, rate-limited to ~1.5 req/sec with exponential backoff
  on 429/403, and HTML cached to `.cache/` so re-runs don't re-fetch.
- **No auto-dialing and no call recording anywhere.** AI-voice handling is
  *inferred* from metadata + website signals. The top leads are written to
  `manual-verify-queue.txt` for you to call **by hand**.

## Scoring weights (all in `config/weights.js`)

The model is two parts: **must-haves** (hard filter) + **weighted signals**
(ranking). Tune everything in `config/weights.js`.

### Must-haves — fail any and the lead is dropped
- Valid business phone (≥ 10 digits).
- At least one contact channel: email **or** a social profile URL.
- `ai_handling_detected` is **false** (maturity below `AI_HANDLING_THRESHOLD`,
  default 60).

### Maturity signal (`maturity_score`, higher = colder)
| Signal | Points |
|--------|-------:|
| VoIP via known receptionist/telephony SaaS carrier | 30 |
| VoIP, unknown carrier | 15 |
| Online-booking / scheduling widget on site | 25 |
| Embedded live-chat / chatbot | 15 |
| Explicit AI-receptionist brand string ("answered by …") | 40 |

Landline / basic mobile + a bare "call us" site score **0** → hottest.

### Lead-score signals (higher = hotter)
| Signal | Weight | Sub-score basis |
|--------|-------:|-----------------|
| Review count in the busy-but-not-enterprise band | 30 | peak at ideal (`REVIEW_BAND`, default 20–300, ideal 120) |
| Rating ≥ 4.0 (reputation-conscious) | 20 | ramps with rating above the floor |
| Front-office hiring signal | 15 | careers/jobs link + a receptionist-type keyword |
| Owner name found | 15 | enables personalisation |
| Email confidence | 20 | Hunter score / 100 (on-site email = 1.0) |

`lead_score = 100 × Σ(weight × subscore) / Σ(weight)`, then sorted descending.

## Environment variables

See `.env.example`. All optional in `--dry-run`. For a live run:
`GOOGLE_PLACES_API_KEY`, `HUNTER_API_KEY`, `TWILIO_ACCOUNT_SID` +
`TWILIO_AUTH_TOKEN`, `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`), and
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (+ optional `SUPABASE_TABLE`).

### Supabase table

Create a table (default name `leads`) with a **unique `place_id`** column
(used as the upsert conflict target) plus columns matching the flattened lead
shape: `business_name, owner_name, category, city, phone, line_type, carrier,
email, email_confidence, website, gbp_url, socials (jsonb), review_count,
rating, ai_handling_detected, maturity_score, hiring_signal,
personalization_note, lead_score`.

## Cost estimate (~500-business live run)

| Service | Rough cost |
|---------|-----------|
| Google Places (New) Text Search | ~$5–15 |
| Twilio Lookup (~$0.005–0.01 / number) | ~$3–5 |
| Claude Haiku enrichment + notes (~$0.001–0.003 / business) | ~$1–2 |
| Hunter.io | per your plan's quota |
| **Total** | **≈ $15–30**, plus Hunter quota |

Website fetches are free but rate-limited and cached, so re-runs cost nothing
extra for pages already fetched.

## Recommended rollout

1. `npm run dry-run`, open `out/leads.xlsx`, eyeball the spread, tune weights.
2. Small live run: `--target=50 --cities="San Rafael, CA"`.
3. Scale to the full pull once the scoring feels right.
4. Feed the `personalization_note` column into cold-email variants 6A/6B.
5. Work `manual-verify-queue.txt` as your daily call list — pre-scored, warm.
