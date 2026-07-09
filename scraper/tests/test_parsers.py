import json
from pathlib import Path

import pytest

from leadgen.csv_out import dedupe, write_csv
from leadgen.models import Lead, normalize_phone
from leadgen.regions import PHOENIX, REGIONS
from leadgen.sources.azroc import parse_search_response
from leadgen.sources.cslb import (
    parse_license_detail,
    parse_search_results,
    pick_owner_name,
)
from leadgen.sources.google_places import parse_places_response
from leadgen.trades import PLUMBING, looks_like_emergency_service

FIXTURES = Path(__file__).parent / "fixtures"


# --- models -------------------------------------------------------------

@pytest.mark.parametrize("raw,expected", [
    ("602-555-0177", "(602) 555-0177"),
    ("(415) 555.0123", "(415) 555-0123"),
    ("1-480-555-0142", "(480) 555-0142"),
    ("555-0142", ""),          # too short
    (None, ""),
])
def test_normalize_phone(raw, expected):
    assert normalize_phone(raw) == expected


def test_lead_dedupe_prefers_phone():
    a = Lead(business_name="A Plumbing", phone="602 555 0177",
             business_type="Plumbing")
    b = Lead(business_name="A Plumbing LLC", phone="(602) 555-0177",
             business_type="Plumbing")
    assert a.dedupe_key() == b.dedupe_key()


# --- CSLB ---------------------------------------------------------------

def test_cslb_zip_results():
    rows = parse_search_results(
        (FIXTURES / "cslb_zip_results.html").read_text())
    assert [r["license_number"] for r in rows] == \
        ["123456", "234567", "345678"]
    assert rows[0]["business_name"] == "GOLDEN GATE ROOTER & PLUMBING INC"


def test_cslb_license_detail():
    detail = parse_license_detail((FIXTURES / "cslb_detail.html").read_text())
    assert detail["business_name"] == "GOLDEN GATE ROOTER & PLUMBING INC"
    assert detail["phone"] == "(415) 555-0123"
    assert detail["city"] == "San Francisco"
    assert "C36 - PLUMBING" in detail["classifications"]
    assert pick_owner_name(detail["personnel"]) == "MARIA ELENA SANTOS"


# --- AZ ROC -------------------------------------------------------------

def test_azroc_response_parsing():
    payload = json.loads((FIXTURES / "azroc_response.json").read_text())
    rows = parse_search_response(payload)
    assert len(rows) == 4
    plumber = rows[0]
    assert plumber["business_name"] == "DESERT SUN PLUMBING LLC"
    assert plumber["qualifying_party"] == "ROBERT M DELGADO"
    assert plumber["phone"] == "602-555-0177"
    # trade keyword filter finds the plumbing rows only
    plumbing = [r for r in rows
                if any(k in r["classification"].upper()
                       for k in PLUMBING.azroc_keywords)]
    assert {r["license_number"] for r in plumbing} == \
        {"ROC345678", "ROC111111"}


# --- Google Places ------------------------------------------------------

def test_places_parsing_skips_closed():
    payload = json.loads((FIXTURES / "places_response.json").read_text())
    region = REGIONS["bay_area"]
    leads = parse_places_response(payload, "Plumbing", region)
    names = [l.business_name for l in leads]
    assert "AAA 24 Hour Emergency Plumbing" in names
    assert "Closed Plumbers Inc" not in names
    oakland = leads[0]
    assert oakland.phone == "(510) 555-0134"
    assert oakland.location == "Oakland, CA"
    # fallback city extraction from formattedAddress
    san_jose = [l for l in leads if "Rooter" in l.business_name][0]
    assert san_jose.location == "San Jose, CA"


# --- filters / output ---------------------------------------------------

def test_emergency_keyword_filter():
    assert looks_like_emergency_service("AAA 24 Hour Emergency Plumbing")
    assert looks_like_emergency_service("Mission Drain Works")
    assert not looks_like_emergency_service("Smith Construction Co")


def test_dedupe_merges_owner_and_license(tmp_path):
    google = Lead(name="AAA Plumbing", business_name="AAA Plumbing",
                  phone="510-555-0134", business_type="Plumbing",
                  location="Oakland, CA", source="google-places", state="CA")
    cslb = Lead(name="MARIA SANTOS", business_name="AAA PLUMBING",
                phone="(510) 555-0134", business_type="Plumbing",
                location="Oakland, CA", license_number="123456",
                source="cslb", state="CA")
    merged = list(dedupe([google, cslb]))
    assert len(merged) == 1
    assert merged[0].license_number == "123456"
    assert "cslb" in merged[0].source

    out = tmp_path / "leads.csv"
    assert write_csv(merged, str(out)) == 1
    text = out.read_text()
    assert text.splitlines()[0] == \
        "name,phone,business_type,location,business_name," \
        "license_number,source,state"
    assert "(510) 555-0134" in text


def test_phoenix_region_city_match():
    assert PHOENIX.matches_city("MESA")
    assert not PHOENIX.matches_city("Tucson")
