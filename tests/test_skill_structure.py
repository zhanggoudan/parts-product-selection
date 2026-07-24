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


if __name__ == "__main__":
    unittest.main()
