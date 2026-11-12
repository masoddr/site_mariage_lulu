"""Convert Lucie's registration sheet into `src/data/guests.json`.

Source: `docs/sources/fichier-inscription.csv`, exported from the
`fichier inscription` tab of the Google Sheet listed in `docs/sources-lucie.md`.
Re-run after each new export:

    python scripts/import_guests.py

This replaces an earlier import built on the `LAÏQUE` tab, which listed first
names only. That was not merely untidy: twelve first names are shared by
twenty-five different people (two Corinne, three Maxime...), so the old list
silently merged them and those guests had no way to identify themselves. The
registration tab carries full names and is the only unambiguous source.

The tab is a tracking grid — one row per guest, which the site fills in as
answers arrive — so this script only reads its two stable columns: the name and
the lodging Lucie has already arranged.
"""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "docs" / "sources" / "fichier-inscription.csv"
JSON_PATH = ROOT / "src" / "data" / "guests.json"

# Row 0 spans "REPAS" over the meal columns, row 1 holds the real headers.
HEADER_ROWS = {0, 1}

NAME_COLUMN = 0
LODGING_COLUMN = 2

# The couple themselves. They have their own row like everyone else, and no
# reason to pick their own name in the RSVP dropdown.
EXCLUDED = {"lucie galpern", "lucas brugnoli"}

# Entries that are a note to Lucie rather than an identified guest. The
# registration tab has none today — she resolved the "+1" placeholders of the
# LAÏQUE tab into real names — but a new export may bring some back.
PLACEHOLDER = re.compile(r"\?|^\+\s*1", re.IGNORECASE)


def normalise(name: str) -> str:
    """Key used to compare two spellings of the same name.

    Only for detecting duplicates and the excluded couple: the name written to
    `guests.json` is always the sheet's own spelling, since that is what has to
    match back when the site looks up the row to fill in.
    """
    stripped = unicodedata.normalize("NFKD", name)
    stripped = "".join(c for c in stripped if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", stripped).strip().casefold()


def main() -> None:
    with CSV_PATH.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.reader(handle))

    guests: list[dict[str, object]] = []
    seen: dict[str, int] = {}
    duplicates: list[str] = []

    for index, row in enumerate(rows):
        if index in HEADER_ROWS or NAME_COLUMN >= len(row):
            continue
        name = row[NAME_COLUMN].strip()
        if not name:
            continue

        key = normalise(name)
        if key in EXCLUDED:
            continue
        if key in seen:
            # Two rows for one person would make the row lookup ambiguous at
            # write time, so flag rather than silently keep the first.
            duplicates.append(f"{name} (lignes {seen[key] + 1} et {index + 1})")
            continue
        seen[key] = index

        logement = row[LODGING_COLUMN].strip() if LODGING_COLUMN < len(row) else ""
        guests.append(
            {
                "name": name,
                # The sheet has no email column; the RSVP form collects it.
                "email": None,
                "hebergement": "hotel" if logement else "libre",
                "logement": logement or None,
                "needs_review": bool(PLACEHOLDER.search(name)),
            }
        )

    JSON_PATH.write_text(
        json.dumps(guests, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    review = [g["name"] for g in guests if g["needs_review"]]
    housed = sum(1 for g in guests if g["hebergement"] == "hotel")
    print(f"{len(guests)} invités -> {JSON_PATH.relative_to(ROOT)}")
    print(f"  {housed} déjà logés, {len(guests) - housed} sans logement prévu")
    if duplicates:
        print(f"  ⚠️  {len(duplicates)} doublons ignorés : {', '.join(duplicates)}")
    if review:
        print(f"  {len(review)} entrées à clarifier avec Lucie : {', '.join(review)}")


if __name__ == "__main__":
    main()
