# Contractor Lead Scraper

Collects **emergency home-service contractors** (plumbers, electricians,
HVAC) in the **Bay Area, Phoenix, and Tucson** from public sources, and
writes a structured CSV with owner name, phone, business type, and location.

## Data sources

| Source | What it provides | How |
|---|---|---|
| **CA CSLB** (Contractors State License Board) | Business name, phone, city, classification, owner/qualifier names | Public "Check a License" zip-code search + license detail pages |
| **AZ ROC** (Registrar of Contractors) | Business name, phone, city, classification, qualifying party | The contractor-search portal's JSON API (Salesforce Aura) |
| **Google Business listings** | Business name, phone, address for "emergency plumber"-style queries | Official **Places API (New)** — *not* HTML scraping, which Google's ToS prohibits |

Owner names come from the license boards (Google listings don't expose
owners); the deduper merges a Google row and a license row for the same
phone number into one lead carrying both the owner name and license number.

## Setup

```bash
cd scraper
pip install -r requirements.txt
export GOOGLE_PLACES_API_KEY=...   # only needed for the google source
```

## Usage

```bash
# See what would be queried without touching the network
python -m leadgen --dry-run

# Everything (CSLB + AZ ROC + Google), all three metros, all trades
python -m leadgen --out leads.csv

# Only plumbers & electricians, Bay Area, first 10 zips, cap 50 leads/source
python -m leadgen --sources cslb google --regions bay_area \
    --trades plumbing electrical --max-zips 10 --limit 50 --out bay.csv

# Keep only businesses whose NAME signals emergency service (24hr, rooter…)
python -m leadgen --emergency-only --out emergency_leads.csv
```

### Output columns

`name, phone, business_type, location, business_name, license_number, source, state`

* `name` — business owner / qualifying individual when available, else the
  business name
* `phone` — normalized to `(XXX) XXX-XXXX`
* `business_type` — Plumbing / Electrical / HVAC
* `location` — `City, ST`

### Importing portal exports (recommended for bulk pulls)

Both boards offer ways to get bulk data without scraping:

* **CSLB Public Data Portal** (<https://www.cslb.ca.gov/onlineservices/dataportal/>)
  lets you build a list by county + classification and download it.
* **AZ ROC** search results can be exported, or bulk data requested through
  their public-records process.

Feed those files in — they're filtered to the target trades/metros and
merged with anything scraped:

```bash
python -m leadgen --sources none \
    --cslb-file cslb_export.csv --azroc-file roc_export.csv --out leads.csv
```

## Targeting

* **Trades** (`leadgen/trades.py`): plumbing (CSLB C-36), electrical (C-10),
  HVAC (C-20); AZ ROC classifications are matched by name keyword
  (PLUMBING / ELECTRICAL / AIR CONDITIONING…). Add more trades there.
* **Metros** (`leadgen/regions.py`): curated zip lists (CSLB queries) and
  city lists (AZ ROC queries, Google filters). Widen the ranges there for
  broader coverage.

## Testing

Parsers are covered by offline fixture tests — no network needed:

```bash
cd scraper && python -m pytest tests/
```

## Maintenance notes

* **CSLB** is ASP.NET WebForms; the scraper re-reads `__VIEWSTATE` each run
  and locates fields/rows by label rather than control ID, but a site
  redesign would require updating `sources/cslb.py`.
* **AZ ROC** is a Salesforce Experience site; the Aura `fwuid` is re-read
  each run, but if ROC renames the Apex search controller, capture one
  search in browser DevTools (Network → the `aura` POST) and update
  `APEX_DESCRIPTOR` in `sources/azroc.py`.
* **Google**: Places API (New) Text Search; billed per request — the
  default plan is ~18 queries plus pagination.

## Responsible use

* Both license databases are **public records** published for consumer
  protection; this tool queries them at a polite rate (default ≥2s between
  requests per host, identified User-Agent, retry/backoff on 429/5xx).
  Don't lower `--delay` aggressively.
* Google data comes via the **official API** under your own API key and
  Google's terms.
* If you cold-call or text these leads, **you are responsible for TCPA /
  FTC Telemarketing Sales Rule / state Do-Not-Call compliance** (business
  numbers are not exempt from all rules, and many contractors use personal
  cell phones). Scrub against the DNC registry before autodialing or
  texting.
