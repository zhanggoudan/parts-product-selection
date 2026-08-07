from pathlib import Path
import json
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[1]


class CalculatorCliTests(unittest.TestCase):
    def test_cpc_cli_requires_pre_ad_profit(self):
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "calc_cpc.py"),
                "--price",
                "1750",
                "--bid",
                "1.78",
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--pre-ad-profit", result.stderr)

    def test_cpc_cli_marks_zero_profit_allowance_unviable(self):
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "calc_cpc.py"),
                "--price",
                "1750",
                "--bid",
                "1.78",
                "--pre-ad-profit",
                "0",
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        base = json.loads(result.stdout)[1]
        self.assertEqual(base["max_cpc"], "0.00")
        self.assertEqual(base["classification"], "unviable")
        self.assertEqual(base["score_15"], 3)

    def test_unit_economics_cli_accepts_route_neutral_fulfillment_and_fee(self):
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "calc_unit_economics.py"),
                "--price",
                "1000",
                "--landed-cost",
                "400",
                "--referral-fee",
                "94",
                "--fulfillment-cost",
                "200",
                "--cpc",
                "1",
                "--conversion-rate",
                "0.10",
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["pre_ad_profit"], "306")


if __name__ == "__main__":
    unittest.main()
