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


def maximum_cpc(
    *,
    price: Decimal,
    target_acos: Decimal,
    conversion_rate: Decimal,
    pre_ad_profit: Decimal | None = None,
    target_profit: Decimal = ZERO,
) -> Decimal:
    _positive("price", price)
    _rate("target_acos", target_acos, allow_zero=False)
    _rate("conversion_rate", conversion_rate, allow_zero=False)
    _nonnegative("target_profit", target_profit)

    allowance = price * target_acos
    if pre_ad_profit is not None:
        allowance = min(allowance, pre_ad_profit - target_profit)
    return max(ZERO, allowance) * conversion_rate


def required_conversion_rate(
    *,
    bid: Decimal,
    price: Decimal,
    target_acos: Decimal,
    pre_ad_profit: Decimal | None = None,
    target_profit: Decimal = ZERO,
) -> Decimal | None:
    _nonnegative("bid", bid)
    _positive("price", price)
    _rate("target_acos", target_acos, allow_zero=False)
    _nonnegative("target_profit", target_profit)

    allowance = price * target_acos
    if pre_ad_profit is not None:
        allowance = min(allowance, pre_ad_profit - target_profit)
    if allowance <= ZERO:
        return None
    return bid / allowance


def classify_cpc(*, bid: Decimal, max_cpc: Decimal) -> str:
    _nonnegative("bid", bid)
    _nonnegative("max_cpc", max_cpc)
    if max_cpc == ZERO:
        return "unviable"
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


def scenario_matrix(
    *,
    price: Decimal,
    bid: Decimal,
    pre_ad_profit: Decimal | None = None,
    target_profit: Decimal = ZERO,
) -> list[dict[str, Any]]:
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
            pre_ad_profit=pre_ad_profit,
            target_profit=target_profit,
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
                    pre_ad_profit=pre_ad_profit,
                    target_profit=target_profit,
                ),
                "classification": classify_cpc(bid=bid, max_cpc=max_cpc),
            }
        )
    return rows


def unit_economics(
    *,
    price: Decimal,
    landed_cost: Decimal,
    referral_fee_rate: Decimal | None = None,
    other_cost: Decimal,
    return_rate: Decimal,
    loss_per_return: Decimal,
    cpc: Decimal,
    conversion_rate: Decimal,
    target_margin: Decimal,
    fulfillment_cost: Decimal | None = None,
    fba_fee: Decimal | None = None,
    referral_fee: Decimal | None = None,
) -> dict[str, Decimal]:
    _positive("price", price)
    if referral_fee_rate is not None and referral_fee is not None:
        raise ValueError("provide either referral_fee_rate or referral_fee, not both")
    if referral_fee_rate is None:
        if referral_fee is None:
            raise ValueError("referral_fee_rate or referral_fee must be provided")
        _nonnegative("referral_fee", referral_fee)
    else:
        _rate("referral_fee_rate", referral_fee_rate)
        referral_fee = price * referral_fee_rate
    if fulfillment_cost is not None and fba_fee is not None:
        raise ValueError("provide either fulfillment_cost or fba_fee, not both")
    if fulfillment_cost is None:
        if fba_fee is None:
            raise ValueError("fulfillment_cost must be provided")
        fulfillment_cost = fba_fee
    for name, value in (
        ("landed_cost", landed_cost),
        ("fulfillment_cost", fulfillment_cost),
        ("other_cost", other_cost),
        ("loss_per_return", loss_per_return),
        ("cpc", cpc),
    ):
        _nonnegative(name, value)
    _rate("return_rate", return_rate)
    _rate("conversion_rate", conversion_rate, allow_zero=False)
    _rate("target_margin", target_margin)

    return_reserve = return_rate * loss_per_return
    ad_cost_per_order = cpc / conversion_rate
    pre_ad_profit = (
        price
        - referral_fee
        - fulfillment_cost
        - landed_cost
        - other_cost
        - return_reserve
    )
    contribution_profit = pre_ad_profit - ad_cost_per_order
    contribution_margin = contribution_profit / price
    break_even_acos = pre_ad_profit / price
    target_profit = price * target_margin
    max_landed_cost = (
        price
        - referral_fee
        - fulfillment_cost
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


def minimum_organic_share_for_break_even(
    *,
    pre_ad_profit: Decimal,
    cpc: Decimal,
    conversion_rate: Decimal,
) -> Decimal | None:
    """Return the minimum organic-order share needed for blended break-even."""
    _nonnegative("cpc", cpc)
    _rate("conversion_rate", conversion_rate, allow_zero=False)
    if pre_ad_profit < ZERO:
        return None
    ad_cost_per_paid_order = cpc / conversion_rate
    if ad_cost_per_paid_order == ZERO:
        return ZERO
    required_share = ONE - pre_ad_profit / ad_cost_per_paid_order
    return min(ONE, max(ZERO, required_share))


def profit_timeline(
    *,
    pre_ad_profit: Decimal,
    cpc: Decimal,
    monthly_orders: tuple[int, ...],
    monthly_conversion_rates: tuple[Decimal, ...],
    monthly_paid_order_shares: tuple[Decimal, ...],
    initial_loss: Decimal,
    monthly_fixed_costs: tuple[Decimal, ...],
) -> dict[str, Any]:
    """Project operating and cumulative break-even over an explicit monthly schedule."""
    _nonnegative("cpc", cpc)
    _nonnegative("initial_loss", initial_loss)
    lengths = {
        len(monthly_orders),
        len(monthly_conversion_rates),
        len(monthly_paid_order_shares),
        len(monthly_fixed_costs),
    }
    if len(lengths) != 1:
        raise ValueError("monthly schedules must contain the same number of months")
    if not monthly_orders:
        raise ValueError("monthly schedules must not be empty")

    cumulative_profit = -initial_loss
    operating_break_even_month: int | None = None
    cumulative_break_even_month: int | None = None
    rows: list[dict[str, Any]] = []

    for index, (orders, conversion_rate, paid_share, fixed_cost) in enumerate(
        zip(
            monthly_orders,
            monthly_conversion_rates,
            monthly_paid_order_shares,
            monthly_fixed_costs,
            strict=True,
        ),
        start=1,
    ):
        if isinstance(orders, bool) or orders < 0:
            raise ValueError("monthly_orders must contain nonnegative integers")
        _rate("monthly_conversion_rate", conversion_rate, allow_zero=False)
        _rate("monthly_paid_order_share", paid_share)
        _nonnegative("monthly_fixed_cost", fixed_cost)

        ad_cost_per_paid_order = cpc / conversion_rate
        blended_ad_cost_per_order = paid_share * ad_cost_per_paid_order
        unit_contribution = pre_ad_profit - blended_ad_cost_per_order
        monthly_profit = unit_contribution * Decimal(orders) - fixed_cost
        cumulative_profit += monthly_profit

        if operating_break_even_month is None and monthly_profit > ZERO:
            operating_break_even_month = index
        if cumulative_break_even_month is None and cumulative_profit >= ZERO:
            cumulative_break_even_month = index

        rows.append(
            {
                "month": index,
                "orders": orders,
                "conversion_rate": conversion_rate,
                "paid_order_share": paid_share,
                "organic_order_share": ONE - paid_share,
                "ad_cost_per_paid_order": ad_cost_per_paid_order,
                "blended_ad_cost_per_order": blended_ad_cost_per_order,
                "unit_contribution": unit_contribution,
                "monthly_fixed_cost": fixed_cost,
                "monthly_profit": monthly_profit,
                "cumulative_profit": cumulative_profit,
            }
        )

    return {
        "operating_break_even_month": operating_break_even_month,
        "cumulative_break_even_month": cumulative_break_even_month,
        "rows": rows,
    }
