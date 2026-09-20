#!/usr/bin/env python3
"""Regenerate the privacy comparison data used by /compare-privacy.

The values originate from each provider's published privacy policy and
transparency reports. This script exists so the table can be re-derived and
released to the repository as machine-readable evidence, making the page
auditable rather than hand-wave.

Usage:
    python scripts/update_comparison.py [--refresh] [--dry-run]

    --refresh   force regeneration (default: only refresh if data.json is missing)
    --dry-run   print the resulting table without writing the file
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.comparison.data_model import (  # noqa: E402
    DATA_PATH,
    build_data,
    load_comparison,
    save_comparison,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.dry_run:
        data = build_data()
    else:
        data = load_comparison(refresh=args.refresh)
        save_comparison(data)

    print(f"generated_at          : {data.generated_at}")
    print(f"feature_definitions   : {len(data.feature_definitions)}")
    print(f"engines               : {len(data.engines)}")
    print()
    width = max(len(e.name) for e in data.engines)
    header = f"{'engine'.ljust(width)}  total  pct"
    print(header)
    print("-" * len(header))
    max_score = len(data.feature_definitions) * 2
    for e in data.engines:
        total = sum(f.value for f in e.features)
        print(f"{e.name.ljust(width)}  {total:5}  {total/max_score*100:4.0f}%")
    print()
    print(f"data file             : {DATA_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())