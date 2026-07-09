"""Emergency home-service trades and their per-source identifiers.

* ``cslb_class``      — California CSLB license classification code
* ``azroc_keywords``  — substrings matched against AZ ROC classification
                        names (ROC uses R-/C-/CR-/K- prefixed codes whose
                        numbering shifted over the years, so we match on the
                        classification *name* instead)
* ``google_queries``  — Places API text-search templates; ``{area}`` is
                        replaced with the metro label
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Trade:
    key: str
    label: str
    cslb_class: str
    azroc_keywords: tuple[str, ...]
    google_queries: tuple[str, ...]


PLUMBING = Trade(
    key="plumbing",
    label="Plumbing",
    cslb_class="C36",
    azroc_keywords=("PLUMBING",),
    google_queries=(
        "emergency plumber in {area}",
        "24 hour plumber in {area}",
    ),
)

ELECTRICAL = Trade(
    key="electrical",
    label="Electrical",
    cslb_class="C10",
    azroc_keywords=("ELECTRICAL",),
    google_queries=(
        "emergency electrician in {area}",
        "24 hour electrician in {area}",
    ),
)

HVAC = Trade(
    key="hvac",
    label="HVAC",
    cslb_class="C20",
    azroc_keywords=("AIR CONDITIONING", "REFRIGERATION", "HEATING"),
    google_queries=(
        "emergency HVAC repair in {area}",
        "24 hour AC repair in {area}",
    ),
)

TRADES: dict[str, Trade] = {t.key: t for t in (PLUMBING, ELECTRICAL, HVAC)}

# Business-name keywords that signal an emergency-service positioning.
# Used by the optional --emergency-only filter for license-board sources
# (Google queries already target emergency services explicitly).
EMERGENCY_NAME_KEYWORDS = (
    "24 hour", "24-hour", "24hr", "24/7", "emergency", "rooter",
    "drain", "rescue", "rapid", "same day", "same-day", "express",
    "on call", "on-call",
)


def looks_like_emergency_service(business_name: str) -> bool:
    lowered = business_name.lower()
    return any(kw in lowered for kw in EMERGENCY_NAME_KEYWORDS)


def trades_for(keys: list[str]) -> list[Trade]:
    unknown = [k for k in keys if k not in TRADES]
    if unknown:
        raise KeyError(f"Unknown trade(s) {unknown}; valid: {sorted(TRADES)}")
    seen: set[str] = set()
    return [TRADES[k] for k in keys if not (k in seen or seen.add(k))]
