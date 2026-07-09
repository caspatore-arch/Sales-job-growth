"""Google Business listings via the official Places API (New), v1.

Scraping Google Maps/Search HTML violates Google's Terms of Service and
breaks constantly, so this module uses the supported Text Search endpoint:

    POST https://places.googleapis.com/v1/places:searchText

You need an API key with "Places API (New)" enabled:
https://developers.google.com/maps/documentation/places/web-service/get-api-key
Export it as ``GOOGLE_PLACES_API_KEY`` (or pass --google-api-key).

Each trade defines "emergency ..." / "24 hour ..." query templates
(see leadgen/trades.py); we run each against each metro and page through
results.  Note the Places API only returns business-level data — there is
no owner name — so ``name`` falls back to the business name and the
license-board sources are what fill in owners.
"""

from __future__ import annotations

import logging
from typing import Iterator

from ..http import PoliteSession
from ..models import Lead
from ..regions import Region
from ..trades import Trade

log = logging.getLogger(__name__)

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"

FIELD_MASK = ",".join((
    "places.displayName",
    "places.nationalPhoneNumber",
    "places.formattedAddress",
    "places.addressComponents",
    "places.types",
    "places.businessStatus",
    "nextPageToken",
))

# Reject obvious non-locals (directories, lead-gen aggregators) by type.
_EXCLUDED_TYPES = {"corporate_office", "travel_agency"}


def parse_places_response(payload: dict, trade_label: str,
                          region: Region) -> list[Lead]:
    leads = []
    for place in payload.get("places", []):
        if place.get("businessStatus") not in (None, "OPERATIONAL"):
            continue
        if _EXCLUDED_TYPES.intersection(place.get("types") or []):
            continue
        city = ""
        for comp in place.get("addressComponents", []):
            if "locality" in (comp.get("types") or []):
                city = comp.get("longText") or comp.get("shortText") or ""
                break
        if not city:
            # fall back to "..., City, ST 12345, USA" in formattedAddress
            parts = [p.strip() for p in
                     (place.get("formattedAddress") or "").split(",")]
            if len(parts) >= 3:
                city = parts[-3]
        business_name = (place.get("displayName") or {}).get("text", "")
        leads.append(Lead(
            name=business_name,  # Places has no owner data
            phone=place.get("nationalPhoneNumber", ""),
            business_type=trade_label,
            location=f"{city}, {region.state}" if city else region.label,
            business_name=business_name,
            source="google-places",
            state=region.state,
        ))
    return leads


class GooglePlacesSource:
    def __init__(self, api_key: str,
                 session: PoliteSession | None = None) -> None:
        if not api_key:
            raise ValueError("Google Places API key is required")
        self.api_key = api_key
        self.http = session or PoliteSession(min_delay_seconds=0.5)

    def _search(self, query: str, page_token: str | None = None) -> dict:
        body: dict = {"textQuery": query, "pageSize": 20,
                      "regionCode": "US"}
        if page_token:
            body["pageToken"] = page_token
        resp = self.http.post(
            SEARCH_URL,
            json=body,
            headers={
                "X-Goog-Api-Key": self.api_key,
                "X-Goog-FieldMask": FIELD_MASK,
            },
        )
        return resp.json()

    def leads(self, region: Region, trade: Trade,
              limit: int | None = None, max_pages: int = 3) -> Iterator[Lead]:
        count = 0
        for template in trade.google_queries:
            query = template.format(area=region.label)
            token: str | None = None
            for _page in range(max_pages):
                try:
                    payload = self._search(query, token)
                except Exception as exc:
                    log.warning("Places query %r failed: %s", query, exc)
                    break
                for lead in parse_places_response(payload, trade.label,
                                                  region):
                    yield lead
                    count += 1
                    if limit and count >= limit:
                        return
                token = payload.get("nextPageToken")
                if not token:
                    break
