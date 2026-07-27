#!/usr/bin/env python3
"""Project monthly operating profit and cumulative payback from explicit assumptions."""

from __future__ import annotations

import argparse
import json
from decimal import Decimal
from typing import Any

try:
    from .selection_math import profit_timeline, unit_economics
except ImportError:
    from selection_math import profit_timeline, unit_economics


def _decimal_list(value: str) -> tuple[Decimal, ...]:
    return tuple(Decimal(item.strip()) for item in value.split(",") if item.strip())


def _integer_list(value: str) -> tuple[int, ...]:
    return tuple(int(item.strip()) for item in value.split(",") if item.strip())


def _jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--price", type=Decimal, required=True)
    parser.add_argument("--landed-cost", type=Decimal, required=True)
    parser.add_argument("--referral-fee-rate", type=Decimal, required=True)
    parser.add_argument("--fba-fee", type=Decimal, required=True)
    parser.add_argument("--other-cost", type=Decimal, default=Decimal("0"))
    parser.add_argument("--return-rate", type=Decimal, default=Decimal("0"))
    parser.add_argument("--loss-per-return", type=Decimal, default=Decimal("0"))
    parser.add_argument("--cpc", type=Decimal, required=True)
    parser.add_argument("--target-margin", type=Decimal, default=Decimal("0"))
    parser.add_argument("--monthly-orders", type=_integer_list, required=True)
    parser.add_argument("--monthly-conversion-rates", type=_decimal_list, required=True)
    parser.add_argument("--monthly-paid-order-shares", type=_decimal_list, required=True)
    parser.add_argument("--initial-loss", type=Decimal, default=Decimal("0"))
    parser.add_argument("--monthly-fixed-costs", type=_decimal_list, required=True)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    first_conversion_rate = args.monthly_conversion_rates[0]
    economics = unit_economics(
        price=args.price,
        landed_cost=args.landed_cost,
        referral_fee_rate=args.referral_fee_rate,
        fba_fee=args.fba_fee,
        other_cost=args.other_cost,
        return_rate=args.return_rate,
        loss_per_return=args.loss_per_return,
        cpc=args.cpc,
        conversion_rate=first_conversion_rate,
        target_margin=args.target_margin,
    )
    timeline = profit_timeline(
        pre_ad_profit=economics["pre_ad_profit"],
        cpc=args.cpc,
        monthly_orders=args.monthly_orders,
        monthly_conversion_rates=args.monthly_conversion_rates,
        monthly_paid_order_shares=args.monthly_paid_order_shares,
        initial_loss=args.initial_loss,
        monthly_fixed_costs=args.monthly_fixed_costs,
    )
    print(
        json.dumps(
            _jsonable(
                {
                    "pre_ad_profit": economics["pre_ad_profit"],
                    **timeline,
                }
            ),
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
