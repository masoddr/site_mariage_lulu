"""Convert Lucie's guest spreadsheet into `src/data/guests.json`.

Source: `docs/sources/invites-laique.csv`, exported from the Google Sheet listed
in `docs/sources-lucie.md`. Re-run after each new export:

    python scripts/import_guests.py

The sheet is a planning grid, not a database: three name columns (Lucie's side,
common, Lucas's side) followed by lodging columns listing who already has a bed.
This script flattens it, and deliberately keeps every oddity visible rather than
silently cleaning it up — see `needs_review` below.
"""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "docs" / "sources" / "invites-laique.csv"
JSON_PATH = ROOT / "src" / "data" / "guests.json"

# Column index -> side of the family. Row 2 of the sheet carries these headers.
SIDE_COLUMNS = {0: "lucie", 1: "commun", 2: "lucas"}

# Column index -> lodging already arranged by Lucie, verbatim from row 1.
LODGING_COLUMNS = {
    5: "chez ju",
    6: "camping car",
    8: "5 chambres doubles",
    9: "2 chambres de 4",
    10: "1 chambre de 8",
}

# Row 0 holds the lodging titles, row 1 the three side titles ("Lucie",
# "COMMUN", "Lucas"). The two sets differ: row 1 already lists names in the
# lodging columns (JULIANA, DENIS), so it must be skipped for sides only.
SIDE_HEADER_ROWS = {0, 1}
LODGING_HEADER_ROWS = {0}

# Entries that are placeholders for someone not yet identified, or notes to
# Lucie rather than guests. Flagged, never dropped.
PLACEHOLDER = re.compile(r"\?|^\+\s*1|^1 chambre", re.IGNORECASE)

# The couple themselves, listed in the COMMUN column so Lucie can count heads.
# They have no reason to pick their own name in the RSVP dropdown.
EXCLUDED = {"lucie", "lucas"}

# Spellings the sheet uses for one and the same person. Without this, "LOU ANN"
# and "LOUANN" become two guests — and only one of them carries the bed Lucie
# booked. Keys and values are both `normalise`d forms.
ALIASES = {"lou ann": "louann"}


def normalise(name: str) -> str:
    """Key used to match the same person across columns.

    The sheet mixes cases and accents (`lucie` / `Lucie`, `MEGANE` / `MEGAN`),
    so matching is done on a casefolded, unaccented, space-collapsed form.
    """
    stripped = unicodedata.normalize("NFKD", name)
    stripped = "".join(c for c in stripped if not unicodedata.combining(c))
    key = re.sub(r"\s+", " ", stripped).strip().casefold()
    return ALIASES.get(key, key)


def main() -> None:
    with CSV_PATH.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.reader(handle))

    # First pass: who already has a bed, and which one.
    lodging: dict[str, str] = {}
    for index, row in enumerate(rows):
        if index in LODGING_HEADER_ROWS:
            continue
        for column, label in LODGING_COLUMNS.items():
            if column < len(row) and (cell := row[column].strip()):
                lodging.setdefault(normalise(cell), label)

    # Second pass: the guests themselves, in sheet order.
    guests: list[dict[str, object]] = []
    seen: dict[str, dict[str, object]] = {}
    for index, row in enumerate(rows):
        if index in SIDE_HEADER_ROWS:
            continue
        for column, side in SIDE_COLUMNS.items():
            if column >= len(row) or not (cell := row[column].strip()):
                continue
            key = normalise(cell)
            if key in EXCLUDED:
                continue
            if key in seen:
                # Same person listed on both sides: keep the first entry and
                # record the second side instead of creating a duplicate.
                sides = seen[key]["sides"]
                if side not in sides:
                    sides.append(side)
                continue

            logement = lodging.get(key)
            guest = {
                "name": cell,
                # The sheet has no email column; the RSVP form collects it.
                "email": None,
                "hebergement": "hotel" if logement else "libre",
                "logement": logement,
                "sides": [side],
                "needs_review": bool(PLACEHOLDER.search(cell)),
            }
            seen[key] = guest
            guests.append(guest)

    JSON_PATH.write_text(
        json.dumps(guests, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    review = [g["name"] for g in guests if g["needs_review"]]
    housed = sum(1 for g in guests if g["hebergement"] == "hotel")
    print(f"{len(guests)} invités -> {JSON_PATH.relative_to(ROOT)}")
    print(f"  {housed} déjà logés, {len(guests) - housed} à confirmer")
    if review:
        print(f"  {len(review)} entrées à clarifier avec Lucie : {', '.join(review)}")


if __name__ == "__main__":
    main()
