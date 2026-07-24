#!/usr/bin/env python3
"""Print return- and advertising-adjusted unit economics as JSON."""

from __future__ import annotations

import argparse
from decimal import Decimal
import json

try:
    from .selection_math import unit_economics
except ImportError:
    from selection_math import unit_economics


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--price", required=True, type=Decimal)
    parser.add_argument("--landed-cost", required=True, type=Decimal)
    parser.add_argument("--referral-fee-rate", required=True, type=Decimal)
    parser.add_argument("--fba-fee", required=True, type=Decimal)
    parser.add_argument("--other-cost", default=Decimal("0"), type=Decimal)
    parser.add_argument("--return-rate", default=Decimal("0"), type=Decimal)
    parser.add_argument("--loss-per-return", default=Decimal("0"), type=Decimal)
    parser.add_argument("--cpc", required=True, type=Decimal)
    parser.add_argument("--conversion-rate", required=True, type=Decimal)
    parser.add_argument("--target-margin", default=Decimal("0.15"), type=Decimal)
    args = parser.parse_args()

    result = unit_economics(
        price=args.price,
        landed_cost=args.landed_cost,
        referral_fee_rate=args.referral_fee_rate,
        fba_fee=args.fba_fee,
        other_cost=args.other_cost,
        return_rate=args.return_rate,
        loss_per_return=args.loss_per_return,
        cpc=args.cpc,
        conversion_rate=args.conversion_rate,
        target_margin=args.target_margin,
    )
    print(json.dumps({key: str(value) for key, value in result.items()}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
