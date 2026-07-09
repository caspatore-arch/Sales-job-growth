"""Arizona Registrar of Contractors (AZ ROC) source.

AZ ROC's contractor search (https://azroc.my.site.com/AZRoc/s/contractor-search)
is a Salesforce Experience Cloud app.  Its UI calls an Aura endpoint
(``/AZRoc/s/sfsites/aura``) whose Apex action returns contractor records as
JSON.  ``AzRocScraper`` speaks that protocol:

  1. GET the search page and lift the Aura framework context (``fwuid`` and
     loaded app markup versions) out of the bootstrap config.
  2. POST an Apex action per city + classification keyword.

Salesforce sites change their fwuid on every platform release (harmless —
we re-read it each run) but AZ ROC can also rename the Apex controller;
if searches start failing, inspect the site's network traffic in a browser
DevTools session and update ``APEX_DESCRIPTOR`` / ``build_search_params``.

Fallback: ``load_azroc_export`` imports a CSV exported from the search UI
or obtained through ROC's public-records process, which is sturdier than
the Aura protocol and puts no scraping load on the portal.
"""

from __future__ import annotations

import csv
import json
import logging
import re
from typing import Iterable, Iterator

from ..http import PoliteSession
from ..models import Lead, clean_text
from ..regions import Region
from ..trades import Trade

log = logging.getLogger(__name__)

SITE_BASE = "https://azroc.my.site.com/AZRoc"
SEARCH_PAGE = f"{SITE_BASE}/s/contractor-search"
AURA_ENDPOINT = f"{SITE_BASE}/s/sfsites/aura"

# Apex controller behind the public contractor search. Verify in DevTools
# (Network tab -> "aura" POST -> message payload) if requests start 500ing.
APEX_DESCRIPTOR = (
    "apex://AZRoc_ContractorSearchController/ACTION$searchContractors"
)

_FWUID_RE = re.compile(r'"fwuid"\s*:\s*"([^"]+)"')
_APP_RE = re.compile(
    r'"loaded"\s*:\s*({[^}]*})', re.DOTALL,
)


def extract_aura_context(page_html: str) -> dict:
    """Pull the Aura bootstrap context out of the search page HTML."""
    fwuid = _FWUID_RE.search(page_html)
    loaded = _APP_RE.search(page_html)
    if not fwuid or not loaded:
        raise RuntimeError(
            "Could not find Aura context on the AZ ROC search page; "
            "the portal layout may have changed."
        )
    return {
        "mode": "PROD",
        "fwuid": fwuid.group(1),
        "app": "siteforce:communityApp",
        "loaded": json.loads(loaded.group(1)),
        "dn": [],
        "globals": {},
        "uad": False,
    }


def build_search_params(city: str, search_term: str = "") -> dict:
    """Parameters for the contractor-search Apex action."""
    return {
        "searchTerm": search_term,
        "city": city,
        "licenseStatus": "Active",
        "pageSize": 100,
        "pageNumber": 1,
    }


def parse_search_response(payload: dict | str) -> list[dict]:
    """Normalize an Aura search response into plain dicts.

    Accepts the decoded JSON body (or a JSON string) and tolerates both a
    bare list ``returnValue`` and a ``{"records": [...]}`` wrapper.  Field
    names on the Salesforce records vary in casing, so lookups are
    case/underscore-insensitive.
    """
    if isinstance(payload, str):
        payload = json.loads(payload)
    actions = payload.get("actions") or []
    records: list = []
    for action in actions:
        rv = (action.get("returnValue") or {})
        if isinstance(rv, list):
            records.extend(rv)
        elif isinstance(rv, dict):
            for key in ("records", "contractors", "results", "data"):
                if isinstance(rv.get(key), list):
                    records.extend(rv[key])
                    break

    def get(record: dict, *names: str) -> str:
        squashed = {
            re.sub(r"[^a-z0-9]", "", k.lower()): v
            for k, v in record.items() if isinstance(v, (str, int))
        }
        for name in names:
            v = squashed.get(re.sub(r"[^a-z0-9]", "", name.lower()))
            if v not in (None, ""):
                return str(v)
        return ""

    results = []
    for rec in records:
        if not isinstance(rec, dict):
            continue
        results.append({
            "business_name": get(rec, "businessName", "name", "dbaName",
                                 "doingBusinessAs"),
            "license_number": get(rec, "licenseNumber", "licenseNo",
                                  "rocLicenseNumber", "licenseId"),
            "classification": get(rec, "classification",
                                  "classificationName", "licenseClass",
                                  "classDescription"),
            "phone": get(rec, "phone", "phoneNumber", "businessPhone"),
            "city": get(rec, "city", "businessCity", "mailingCity"),
            "qualifying_party": get(rec, "qualifyingParty",
                                    "qualifierName", "qualifyingIndividual",
                                    "ownerName"),
            "status": get(rec, "status", "licenseStatus"),
        })
    return results


class AzRocScraper:
    def __init__(self, session: PoliteSession | None = None) -> None:
        self.http = session or PoliteSession(min_delay_seconds=2.0)
        self._aura_context: dict | None = None

    def _context(self) -> dict:
        if self._aura_context is None:
            page = self.http.get(SEARCH_PAGE)
            self._aura_context = extract_aura_context(page.text)
        return self._aura_context

    def search_city(self, city: str) -> list[dict]:
        message = {
            "actions": [{
                "id": "1;a",
                "descriptor": APEX_DESCRIPTOR,
                "callingDescriptor": "UNKNOWN",
                "params": build_search_params(city),
            }]
        }
        resp = self.http.post(
            AURA_ENDPOINT,
            params={"r": "1", "aura.ApexAction.execute": "1"},
            data={
                "message": json.dumps(message),
                "aura.context": json.dumps(self._context()),
                "aura.pageURI": "/AZRoc/s/contractor-search",
                "aura.token": "null",
            },
            headers={"Referer": SEARCH_PAGE,
                     "Origin": "https://azroc.my.site.com"},
        )
        body = resp.text
        # Aura guards JSON bodies with a "while(1);" style prefix sometimes.
        body = re.sub(r"^\s*while\s*\(\s*1\s*\)\s*;", "", body)
        return parse_search_response(body)

    def leads(
        self,
        region: Region,
        trade: Trade,
        limit: int | None = None,
    ) -> Iterator[Lead]:
        assert region.state == "AZ", "AZ ROC only covers Arizona"
        count = 0
        seen: set[str] = set()
        for city in region.cities:
            try:
                rows = self.search_city(city)
            except Exception as exc:
                log.warning("AZ ROC search for %s failed: %s", city, exc)
                continue
            log.info("AZ ROC %s: %d records in %s", trade.key, len(rows), city)
            for rec in rows:
                classification = rec["classification"].upper()
                if not any(kw in classification for kw in trade.azroc_keywords):
                    continue
                if rec.get("status") and rec["status"].lower() != "active":
                    continue
                key = rec["license_number"] or rec["business_name"]
                if not key or key in seen:
                    continue
                seen.add(key)
                yield Lead(
                    name=rec["qualifying_party"],
                    phone=rec["phone"],
                    business_type=trade.label,
                    location=f"{(rec['city'] or city).title()}, AZ",
                    business_name=rec["business_name"],
                    license_number=rec["license_number"],
                    source="azroc",
                    state="AZ",
                )
                count += 1
                if limit and count >= limit:
                    return


# --- CSV export import -------------------------------------------------------

_EXPORT_ALIASES = {
    "business_name": ("businessname", "business name", "name", "dba"),
    "license_number": ("license", "licenseno", "license number",
                       "license #", "rocnumber", "roc #"),
    "classification": ("classification", "class", "license class",
                       "classification name"),
    "phone": ("phone", "phone number", "business phone"),
    "city": ("city", "business city"),
    "qualifying_party": ("qualifying party", "qualifier",
                         "qualifying individual", "owner", "owner name"),
}


def load_azroc_export(
    path: str,
    trades: Iterable[Trade],
    region: Region,
) -> Iterator[Lead]:
    """Import a CSV exported from the AZ ROC search UI / public records."""
    trades = list(trades)
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        header = {re.sub(r"[^a-z#]", "", h.lower()): h
                  for h in (reader.fieldnames or [])}
        cols = {}
        for field_name, aliases in _EXPORT_ALIASES.items():
            for alias in aliases:
                key = re.sub(r"[^a-z#]", "", alias)
                if key in header:
                    cols[field_name] = header[key]
                    break
        if "business_name" not in cols:
            raise ValueError(
                f"Unrecognized AZ ROC export header: {reader.fieldnames}")
        for row in reader:
            classification = clean_text(
                row.get(cols.get("classification", ""), "")).upper()
            trade = next(
                (t for t in trades
                 if any(kw in classification for kw in t.azroc_keywords)),
                None,
            )
            if trade is None:
                continue
            city = clean_text(row.get(cols.get("city", ""), ""))
            if city and not region.matches_city(city):
                continue
            yield Lead(
                name=clean_text(row.get(cols.get("qualifying_party", ""), "")),
                phone=row.get(cols.get("phone", ""), ""),
                business_type=trade.label,
                location=f"{city.title()}, AZ" if city else region.label,
                business_name=row.get(cols["business_name"], ""),
                license_number=row.get(cols.get("license_number", ""), ""),
                source="azroc-export",
                state="AZ",
            )
