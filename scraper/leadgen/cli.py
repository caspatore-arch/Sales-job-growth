"""Command-line entry point.

Examples (run from the scraper/ directory):

    # Everything, all sources, all metros:
    python -m leadgen --out leads.csv

    # Just California plumbers + electricians, first 5 zips per metro:
    python -m leadgen --sources cslb --regions bay_area \
        --trades plumbing electrical --max-zips 5 --out ca_leads.csv

    # Google Business listings only (needs GOOGLE_PLACES_API_KEY):
    python -m leadgen --sources google --out google_leads.csv

    # Import CSVs you exported from the state portals instead of scraping:
    python -m leadgen --cslb-file cslb_export.csv --azroc-file roc.csv \
        --sources none --out leads.csv
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from typing import Iterator

from .csv_out import dedupe, write_csv
from .models import Lead
from .regions import REGIONS, regions_for
from .trades import TRADES, looks_like_emergency_service, trades_for

log = logging.getLogger("leadgen")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="leadgen",
        description=(
            "Collect emergency home-service contractor leads (owner name, "
            "phone, trade, location) from the CA CSLB and AZ ROC public "
            "license databases and Google Business listings."
        ),
    )
    p.add_argument("--sources", nargs="+",
                   choices=["cslb", "azroc", "google", "none"],
                   default=["cslb", "azroc", "google"],
                   help="live sources to scrape ('none' = imports only)")
    p.add_argument("--regions", nargs="+", choices=sorted(REGIONS),
                   default=sorted(REGIONS))
    p.add_argument("--trades", nargs="+", choices=sorted(TRADES),
                   default=sorted(TRADES))
    p.add_argument("--out", default="leads.csv", help="output CSV path")
    p.add_argument("--limit", type=int, default=None,
                   help="max leads per source per region+trade")
    p.add_argument("--max-zips", type=int, default=None,
                   help="CSLB: only query the first N zips per region")
    p.add_argument("--emergency-only", action="store_true",
                   help="keep only license-board businesses whose name "
                        "signals emergency service (24hr, rooter, ...)")
    p.add_argument("--google-api-key",
                   default=os.environ.get("GOOGLE_PLACES_API_KEY", ""),
                   help="Places API key (default: $GOOGLE_PLACES_API_KEY)")
    p.add_argument("--cslb-file", help="import a CSLB Data Portal CSV export")
    p.add_argument("--azroc-file", help="import an AZ ROC CSV export")
    p.add_argument("--delay", type=float, default=2.0,
                   help="min seconds between requests per host (default 2)")
    p.add_argument("--dry-run", action="store_true",
                   help="print the planned queries and exit")
    p.add_argument("-v", "--verbose", action="store_true")
    return p


def collect(args: argparse.Namespace) -> Iterator[Lead]:
    from .http import PoliteSession

    regions = regions_for(args.regions)
    trades = trades_for(args.trades)
    sources = set(args.sources) - {"none"}
    session = PoliteSession(min_delay_seconds=args.delay)

    def emergency_gate(leads: Iterator[Lead]) -> Iterator[Lead]:
        if not args.emergency_only:
            yield from leads
            return
        for lead in leads:
            if looks_like_emergency_service(lead.business_name):
                yield lead

    # File imports first: they're free and enrich/dedupe the scraped rows.
    if args.cslb_file:
        from .sources.cslb import load_cslb_export
        for region in (r for r in regions if r.state == "CA"):
            yield from emergency_gate(
                load_cslb_export(args.cslb_file, trades, region))
    if args.azroc_file:
        from .sources.azroc import load_azroc_export
        for region in (r for r in regions if r.state == "AZ"):
            yield from emergency_gate(
                load_azroc_export(args.azroc_file, trades, region))

    if "cslb" in sources:
        from .sources.cslb import CslbScraper
        scraper = CslbScraper(session)
        for region in (r for r in regions if r.state == "CA"):
            for trade in trades:
                yield from emergency_gate(scraper.leads(
                    region, trade, limit=args.limit,
                    max_zips=args.max_zips))

    if "azroc" in sources:
        from .sources.azroc import AzRocScraper
        scraper = AzRocScraper(session)
        for region in (r for r in regions if r.state == "AZ"):
            for trade in trades:
                yield from emergency_gate(
                    scraper.leads(region, trade, limit=args.limit))

    if "google" in sources:
        if not args.google_api_key:
            log.warning(
                "Skipping Google Places: no API key. Set "
                "GOOGLE_PLACES_API_KEY or pass --google-api-key.")
        else:
            from .sources.google_places import GooglePlacesSource
            source = GooglePlacesSource(args.google_api_key, session)
            for region in regions:
                for trade in trades:
                    yield from source.leads(region, trade, limit=args.limit)


def print_plan(args: argparse.Namespace) -> None:
    regions = regions_for(args.regions)
    trades = trades_for(args.trades)
    sources = set(args.sources) - {"none"}
    print("Planned run:")
    for region in regions:
        for trade in trades:
            if "cslb" in sources and region.state == "CA":
                n = len(region.zip_codes[:args.max_zips]
                        if args.max_zips else region.zip_codes)
                print(f"  cslb    {region.key:9} {trade.key:10} "
                      f"class {trade.cslb_class}, {n} zip queries")
            if "azroc" in sources and region.state == "AZ":
                print(f"  azroc   {region.key:9} {trade.key:10} "
                      f"{len(region.cities)} city queries")
            if "google" in sources:
                for t in trade.google_queries:
                    print(f"  google  {region.key:9} {trade.key:10} "
                          f"\"{t.format(area=region.label)}\"")
    if args.cslb_file:
        print(f"  import  {args.cslb_file}")
    if args.azroc_file:
        print(f"  import  {args.azroc_file}")


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )
    if args.dry_run:
        print_plan(args)
        return 0
    leads = dedupe(collect(args))
    rows = write_csv(leads, args.out)
    print(f"Wrote {rows} leads to {args.out}")
    if rows == 0:
        print("No leads collected — check network access / API keys, or "
              "run with --dry-run to see the plan.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
