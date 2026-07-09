"""Deduplication and CSV output."""

from __future__ import annotations

import csv
import logging
from typing import Iterable, Iterator

from .models import Lead

log = logging.getLogger(__name__)


def dedupe(leads: Iterable[Lead]) -> Iterator[Lead]:
    """Drop duplicate businesses (same phone, or same name + location).

    When a duplicate carries data the kept lead lacks (owner name, license
    number), merge it in — license-board rows enrich Google rows and vice
    versa.
    """
    kept: dict[tuple, Lead] = {}
    for lead in leads:
        key = lead.dedupe_key()
        existing = kept.get(key)
        if existing is None:
            kept[key] = lead
            continue
        if not existing.name and lead.name:
            existing.name = lead.name
        if not existing.license_number and lead.license_number:
            existing.license_number = lead.license_number
        if not existing.phone and lead.phone:
            existing.phone = lead.phone
        if lead.source not in existing.source:
            existing.source = f"{existing.source}+{lead.source}"
    yield from kept.values()


def write_csv(leads: Iterable[Lead], path: str) -> int:
    rows = 0
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=Lead.CSV_COLUMNS)
        writer.writeheader()
        for lead in leads:
            row = lead.as_csv_row()
            row["name"] = lead.display_name
            writer.writerow(row)
            rows += 1
    log.info("Wrote %d leads to %s", rows, path)
    return rows
