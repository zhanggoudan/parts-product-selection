from decimal import Decimal
import unittest

from scripts.selection_math import (
    classify_cpc,
    cpc_score,
    maximum_cpc,
    required_conversion_rate,
    scenario_matrix,
    unit_economics,
)


class CPCMathTests(unittest.TestCase):
    def test_maximum_cpc_keeps_exact_decimal_precision(self):
        self.assertEqual(
            maximum_cpc(
                price=Decimal("49.99"),
                target_acos=Decimal("0.30"),
                conversion_rate=Decimal("0.08"),
            ),
            Decimal("1.19976"),
        )

    def test_required_conversion_rate_uses_unrounded_values(self):
        self.assertEqual(
            required_conversion_rate(
                bid=Decimal("1.20"),
                price=Decimal("49.99"),
                target_acos=Decimal("0.30"),
            ),
            Decimal("1.20") / (Decimal("49.99") * Decimal("0.30")),
        )

    def test_bid_slightly_above_exact_max_is_low_budget_only(self):
        self.assertEqual(
            classify_cpc(
                bid=Decimal("1.20"),
                max_cpc=Decimal("1.19976"),
            ),
            "low-budget-only",
        )

    def test_cpc_score_includes_advertiser_pressure(self):
        self.assertEqual(
            cpc_score(
                bid=Decimal("0.70"),
                max_cpc=Decimal("1.00"),
                advertising_competitors=128,
            ),
            13,
        )

    def test_default_scenarios_are_conservative_base_and_aggressive(self):
        rows = scenario_matrix(price=Decimal("50"), bid=Decimal("1"))
        self.assertEqual([row["name"] for row in rows], ["conservative", "base", "aggressive"])
        self.assertEqual(rows[0]["target_acos"], Decimal("0.20"))
        self.assertEqual(rows[0]["conversion_rate"], Decimal("0.03"))
        self.assertEqual(rows[1]["target_acos"], Decimal("0.30"))
        self.assertEqual(rows[1]["conversion_rate"], Decimal("0.05"))
        self.assertEqual(rows[2]["target_acos"], Decimal("0.40"))
        self.assertEqual(rows[2]["conversion_rate"], Decimal("0.08"))

    def test_base_scenario_is_the_only_formal_score_when_targets_are_missing(self):
        rows = scenario_matrix(price=Decimal("50"), bid=Decimal("1"))
        self.assertEqual([row["formal_score"] for row in rows], [False, True, False])


class UnitEconomicsTests(unittest.TestCase):
    def test_unit_economics_includes_returns_and_advertising(self):
        result = unit_economics(
            price=Decimal("50"),
            landed_cost=Decimal("15"),
            referral_fee_rate=Decimal("0.15"),
            fba_fee=Decimal("5"),
            other_cost=Decimal("2"),
            return_rate=Decimal("0.10"),
            loss_per_return=Decimal("12"),
            cpc=Decimal("1"),
            conversion_rate=Decimal("0.10"),
            target_margin=Decimal("0.15"),
        )

        self.assertEqual(result["referral_fee"], Decimal("7.50"))
        self.assertEqual(result["return_reserve"], Decimal("1.20"))
        self.assertEqual(result["ad_cost_per_order"], Decimal("10"))
        self.assertEqual(result["pre_ad_profit"], Decimal("19.30"))
        self.assertEqual(result["contribution_profit"], Decimal("9.30"))
        self.assertEqual(result["contribution_margin"], Decimal("0.186"))
        self.assertEqual(result["break_even_acos"], Decimal("0.386"))
        self.assertEqual(result["max_landed_cost"], Decimal("16.80"))

    def test_zero_conversion_rate_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "conversion_rate"):
            unit_economics(
                price=Decimal("50"),
                landed_cost=Decimal("15"),
                referral_fee_rate=Decimal("0.15"),
                fba_fee=Decimal("5"),
                other_cost=Decimal("2"),
                return_rate=Decimal("0.10"),
                loss_per_return=Decimal("12"),
                cpc=Decimal("1"),
                conversion_rate=Decimal("0"),
                target_margin=Decimal("0.15"),
            )


if __name__ == "__main__":
    unittest.main()
