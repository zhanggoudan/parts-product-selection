#!/usr/bin/env python3
"""Print CPC viability scenarios as JSON."""

from __future__ import annotations

import argparse
from decimal import Decimal
import json

try:
    from .selection_math import cpc_score, scenario_matrix
except ImportError:
    from selection_math import cpc_score, scenario_matrix


def _json_default(value):
    if isinstance(value, Decimal):
        return str(value)
    raise TypeError(f"Unsupported value: {type(value).__name__}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--price", required=True, type=Decimal)
    parser.add_argument("--bid", required=True, type=Decimal)
    parser.add_argument("--pre-ad-profit", required=True, type=Decimal)
    parser.add_argument("--target-profit", default=Decimal("0"), type=Decimal)
    parser.add_argument("--advertising-competitors", type=int)
    args = parser.parse_args()

    rows = scenario_matrix(
        price=args.price,
        bid=args.bid,
        pre_ad_profit=args.pre_ad_profit,
        target_profit=args.target_profit,
    )
    for row in rows:
        row["score_15"] = cpc_score(
            bid=args.bid,
            max_cpc=row["max_cpc"],
            advertising_competitors=args.advertising_competitors,
        )
    print(json.dumps(rows, default=_json_default, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
