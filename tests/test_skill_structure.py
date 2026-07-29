from pathlib import Path
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[1]


def _frontmatter(path: Path):
    text = path.read_text(encoding="utf-8")
    _, raw, _ = text.split("---", 2)
    return yaml.safe_load(raw)


class SkillStructureTests(unittest.TestCase):
    def test_frontmatter_has_only_required_fields(self):
        metadata = _frontmatter(ROOT / "SKILL.md")
        self.assertEqual(set(metadata), {"name", "description"})
        self.assertEqual(metadata["name"], "parts-product-selection")
        self.assertTrue(metadata["description"].startswith("Use when "))

    def test_required_resources_exist(self):
        required = (
            "agents/openai.yaml",
            "references/scoring-rubric.md",
            "references/research-protocol.md",
            "scripts/calc_cpc.py",
            "scripts/calc_profit_timeline.py",
            "scripts/calc_unit_economics.py",
            "scripts/sellersprite_client.py",
        )
        for relative_path in required:
            with self.subTest(path=relative_path):
                self.assertTrue((ROOT / relative_path).is_file())

    def test_sellersprite_web_fallback_is_explicit(self):
        content = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("已登录的 SellerSprite 网页端", content)
        self.assertIn("不得把未覆盖维度按 0 分计入", content)

    def test_v2_requires_market_keyword_and_test_gates(self):
        skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        protocol = (ROOT / "references/research-protocol.md").read_text(
            encoding="utf-8"
        )
        combined = skill + protocol

        for required_text in (
            "市场健康度预筛",
            "商品集中度",
            "新品销售占比",
            "类目退货率",
            "流量词、ABA出单词、广告词",
            "7/14/30天",
            "GIG",
            "外观专利",
        ):
                with self.subTest(required_text=required_text):
                    self.assertIn(required_text, combined)

    def test_sellersprite_analysis_report_is_a_structured_review_evidence_layer(self):
        skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        protocol = (ROOT / "references/research-protocol.md").read_text(
            encoding="utf-8"
        )
        combined = skill + protocol

        for required_text in (
            "卖家精灵分析报告",
            "父体总评分",
            "子体/变体",
            "评论星级统计",
            "评论类型统计",
            "变体评论变化趋势",
            "不得把父体总评论",
        ):
            with self.subTest(required_text=required_text):
                self.assertIn(required_text, combined)

        self.assertNotIn("用户类型", combined)


if __name__ == "__main__":
    unittest.main()
