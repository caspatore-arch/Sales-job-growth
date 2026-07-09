"""Core data model for a scraped lead."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

_PHONE_DIGITS = re.compile(r"\d")


def normalize_phone(raw: str | None) -> str:
    """Normalize a US phone number to ``(XXX) XXX-XXXX``.

    Returns an empty string when fewer than 10 digits are present.
    """
    if not raw:
        return ""
    digits = "".join(_PHONE_DIGITS.findall(raw))
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        return ""
    return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"


def clean_text(raw: str | None) -> str:
    if not raw:
        return ""
    return re.sub(r"\s+", " ", raw).strip()


@dataclass
class Lead:
    """One row of output.

    ``name`` is the business owner / qualifying individual when the source
    provides one, otherwise the business name.
    """

    name: str = ""
    phone: str = ""
    business_type: str = ""
    location: str = ""
    business_name: str = ""
    license_number: str = ""
    source: str = ""
    state: str = ""
    extra: dict = field(default_factory=dict)

    CSV_COLUMNS = (
        "name",
        "phone",
        "business_type",
        "location",
        "business_name",
        "license_number",
        "source",
        "state",
    )

    def __post_init__(self) -> None:
        self.name = clean_text(self.name)
        self.phone = normalize_phone(self.phone)
        self.business_type = clean_text(self.business_type)
        self.location = clean_text(self.location)
        self.business_name = clean_text(self.business_name)
        self.license_number = clean_text(self.license_number)

    @property
    def display_name(self) -> str:
        return self.name or self.business_name

    def dedupe_key(self) -> tuple:
        """Prefer phone as identity; fall back to name + location."""
        if self.phone:
            return ("phone", self.phone, self.business_type)
        return (
            "name",
            self.display_name.lower(),
            self.location.lower(),
            self.business_type,
        )

    def as_csv_row(self) -> dict:
        return {col: getattr(self, col) for col in self.CSV_COLUMNS}
