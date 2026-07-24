#!/usr/bin/env python3
"""Exact CPC and per-unit economics calculations using Decimal."""

from __future__ import annotations

from decimal import Decimal
from typing import Any


ZERO = Decimal("0")
ONE = Decimal("1")


def _positive(name: str, value: Decimal) -> None:
    if value <= ZERO:
        raise ValueError(f"{name} must be greater than zero")


def _nonnegative(name: str, value: Decimal) -> None:
    if value < ZERO:
        raise ValueError(f"{name} must not be negative")


def _rate(name: str, value: Decimal, *, allow_zero: bool = True) -> None:
    lower_ok = value >= ZERO if allow_zero else value > ZERO
    if not lower_ok or value > ONE:
        qualifier = "between 0 and 1" if allow_zero else "greater than 0 and at most 1"
        raise ValueError(f"{name} must be {qualifier}")


def maximum_cpc(*, price: Decimal, target_acos: Decimal, conversion_rate: Decimal) -> Decimal:
    _positive("price", price)
    _rate("target_acos", target_acos, allow_zero=False)
    _rate("conversion_rate", conversion_rate, allow_zero=False)
    return price * target_acos * conversion_rate


def required_conversion_rate(*, bid: Decimal, price: Decimal, target_acos: Decimal) -> Decimal:
    _nonnegative("bid", bid)
    _positive("price", price)
    _rate("target_acos", target_acos, allow_zero=False)
    return bid / (price * target_acos)


def classify_cpc(*, bid: Decimal, max_cpc: Decimal) -> str:
    _nonnegative("bid", bid)
    _positive("max_cpc", max_cpc)
    ratio = bid / max_cpc
    if ratio <= Decimal("0.75"):
        return "high-feasibility"
    if ratio <= ONE:
        return "testable"
    if ratio <= Decimal("1.25"):
        return "low-budget-only"
    return "unviable"


def cpc_score(
    *,
    bid: Decimal,
    max_cpc: Decimal,
    advertising_competitors: int | None,
) -> int:
    """Map CPC feasibility to the skill's 0-15 band, then apply ad-pressure penalty."""
    base = {
        "high-feasibility": 15,
        "testable": 12,
        "low-budget-only": 8,
        "unviable": 3,
    }[classify_cpc(bid=bid, max_cpc=max_cpc)]

    if advertising_competitors is None:
        penalty = 0
    elif advertising_competitors < 0:
        raise ValueError("advertising_competitors must not be negative")
    elif advertising_competitors <= 50:
        penalty = 0
    elif advertising_competitors <= 100:
        penalty = 1
    elif advertising_competitors <= 200:
        penalty = 2
    else:
        penalty = 3
    return max(0, base - penalty)


def scenario_matrix(*, price: Decimal, bid: Decimal) -> list[dict[str, Any]]:
    scenarios = (
        ("conservative", Decimal("0.20"), Decimal("0.03")),
        ("base", Decimal("0.30"), Decimal("0.05")),
        ("aggressive", Decimal("0.40"), Decimal("0.08")),
    )
    rows: list[dict[str, Any]] = []
    for name, target_acos, conversion_rate in scenarios:
        max_cpc = maximum_cpc(
            price=price,
            target_acos=target_acos,
            conversion_rate=conversion_rate,
        )
        rows.append(
            {
                "name": name,
                "formal_score": name == "base",
                "target_acos": target_acos,
                "conversion_rate": conversion_rate,
                "max_cpc": max_cpc,
                "required_conversion_rate": required_conversion_rate(
                    bid=bid,
                    price=price,
                    target_acos=target_acos,
                ),
                "classification": classify_cpc(bid=bid, max_cpc=max_cpc),
            }
        )
    return rows


def unit_economics(
    *,
    price: Decimal,
    landed_cost: Decimal,
    referral_fee_rate: Decimal,
    fba_fee: Decimal,
    other_cost: Decimal,
    return_rate: Decimal,
    loss_per_return: Decimal,
    cpc: Decimal,
    conversion_rate: Decimal,
    target_margin: Decimal,
) -> dict[str, Decimal]:
    _positive("price", price)
    for name, value in (
        ("landed_cost", landed_cost),
        ("fba_fee", fba_fee),
        ("other_cost", other_cost),
        ("loss_per_return", loss_per_return),
        ("cpc", cpc),
    ):
        _nonnegative(name, value)
    _rate("referral_fee_rate", referral_fee_rate)
    _rate("return_rate", return_rate)
    _rate("conversion_rate", conversion_rate, allow_zero=False)
    _rate("target_margin", target_margin)

    referral_fee = price * referral_fee_rate
    return_reserve = return_rate * loss_per_return
    ad_cost_per_order = cpc / conversion_rate
    pre_ad_profit = price - referral_fee - fba_fee - landed_cost - other_cost - return_reserve
    contribution_profit = pre_ad_profit - ad_cost_per_order
    contribution_margin = contribution_profit / price
    break_even_acos = pre_ad_profit / price
    target_profit = price * target_margin
    max_landed_cost = (
        price
        - referral_fee
        - fba_fee
        - other_cost
        - return_reserve
        - ad_cost_per_order
        - target_profit
    )
    return {
        "referral_fee": referral_fee,
        "return_reserve": return_reserve,
        "ad_cost_per_order": ad_cost_per_order,
        "pre_ad_profit": pre_ad_profit,
        "contribution_profit": contribution_profit,
        "contribution_margin": contribution_margin,
        "break_even_acos": break_even_acos,
        "target_profit": target_profit,
        "max_landed_cost": max_landed_cost,
    }
