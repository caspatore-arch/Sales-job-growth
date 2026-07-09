"""Target metro areas.

Each region defines:
  * ``zip_codes`` — used by the CSLB zip-code search (queried one at a time)
  * ``cities``    — used to filter AZ ROC results and build Google queries
  * ``state``     — two-letter state code

Zip lists are intentionally curated (dense residential zips) rather than
exhaustive: every extra zip is another polite-rate request against the state
site.  Extend the ranges below if you want wider coverage.
"""

from __future__ import annotations

from dataclasses import dataclass


def _zip_range(start: int, end: int) -> list[str]:
    return [f"{z:05d}" for z in range(start, end + 1)]


@dataclass(frozen=True)
class Region:
    key: str
    label: str
    state: str
    cities: tuple[str, ...]
    zip_codes: tuple[str, ...]

    def matches_city(self, city: str) -> bool:
        return city.strip().upper() in {c.upper() for c in self.cities}


BAY_AREA = Region(
    key="bay_area",
    label="Bay Area, CA",
    state="CA",
    cities=(
        "San Francisco", "Oakland", "San Jose", "Fremont", "Hayward",
        "Sunnyvale", "Santa Clara", "Concord", "Berkeley", "Richmond",
        "Daly City", "San Mateo", "Vallejo", "Antioch", "Fairfield",
        "San Leandro", "Livermore", "Milpitas", "Walnut Creek",
        "Pleasanton", "South San Francisco", "Mountain View", "Alameda",
        "Redwood City", "Napa", "Santa Rosa", "San Rafael", "Petaluma",
        "Union City", "Palo Alto", "Cupertino", "Vacaville",
    ),
    zip_codes=tuple(
        _zip_range(94102, 94134)      # San Francisco
        + _zip_range(94002, 94070)    # San Mateo County
        + _zip_range(94301, 94306)    # Palo Alto
        + _zip_range(94401, 94404)    # San Mateo
        + _zip_range(94501, 94512)    # Alameda / Solano edge
        + _zip_range(94513, 94531)    # East Contra Costa
        + _zip_range(94536, 94546)    # Fremont / Castro Valley
        + _zip_range(94550, 94566)    # Livermore / Pleasanton
        + _zip_range(94577, 94588)    # San Leandro / Dublin
        + _zip_range(94601, 94621)    # Oakland
        + _zip_range(94701, 94710)    # Berkeley
        + _zip_range(94801, 94806)    # Richmond
        + _zip_range(94901, 94960)    # Marin
        + _zip_range(95002, 95054)    # Santa Clara County
        + _zip_range(95110, 95148)    # San Jose
    ),
)

PHOENIX = Region(
    key="phoenix",
    label="Phoenix metro, AZ",
    state="AZ",
    cities=(
        "Phoenix", "Mesa", "Chandler", "Scottsdale", "Glendale", "Tempe",
        "Gilbert", "Peoria", "Surprise", "Avondale", "Goodyear",
        "Buckeye", "Queen Creek", "El Mirage", "Fountain Hills",
        "Apache Junction", "Sun City", "Sun City West", "Litchfield Park",
        "Tolleson", "Laveen", "Cave Creek", "Paradise Valley",
    ),
    zip_codes=tuple(
        _zip_range(85003, 85087)      # Phoenix proper
        + _zip_range(85201, 85215)    # Mesa
        + _zip_range(85224, 85226)    # Chandler
        + _zip_range(85233, 85234)    # Gilbert
        + _zip_range(85248, 85266)    # Chandler S / Scottsdale
        + _zip_range(85281, 85284)    # Tempe
        + _zip_range(85295, 85298)    # Gilbert S
        + _zip_range(85301, 85310)    # Glendale
        + _zip_range(85323, 85340)    # Avondale / Litchfield
        + _zip_range(85345, 85345)    # Peoria
        + _zip_range(85351, 85351)    # Sun City
        + _zip_range(85374, 85396)    # Surprise / Buckeye / Goodyear
    ),
)

TUCSON = Region(
    key="tucson",
    label="Tucson metro, AZ",
    state="AZ",
    cities=(
        "Tucson", "Oro Valley", "Marana", "Sahuarita", "Green Valley",
        "Vail", "Catalina", "Catalina Foothills", "Casas Adobes",
        "South Tucson",
    ),
    zip_codes=tuple(
        _zip_range(85701, 85757)      # Tucson proper
        + ["85614", "85622"]          # Green Valley / Sahuarita area
        + ["85641"]                   # Vail
        + ["85653", "85658"]          # Marana
        + ["85704", "85737", "85739", "85742", "85755"]  # Oro Valley / NW
    ),
)

REGIONS: dict[str, Region] = {r.key: r for r in (BAY_AREA, PHOENIX, TUCSON)}


def regions_for(keys: list[str]) -> list[Region]:
    unknown = [k for k in keys if k not in REGIONS]
    if unknown:
        raise KeyError(
            f"Unknown region(s) {unknown}; valid: {sorted(REGIONS)}"
        )
    # de-dup while preserving order
    seen: set[str] = set()
    return [REGIONS[k] for k in keys if not (k in seen or seen.add(k))]
