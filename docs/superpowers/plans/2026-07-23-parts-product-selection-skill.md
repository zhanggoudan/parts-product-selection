# Parts Product Selection Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an auto-discovered Skill that evaluates an Amazon ASIN or product image through a new-seller-entry model and produces an evidence-labelled product-selection decision.

**Architecture:** Create one concise instruction file for the reusable workflow and one UI metadata file. The Skill will use public/product research tools and authenticated SellerSprite pages or an already configured local API key; it will never persist or expose credentials. The workflow separates head-seller market validation from middle/tail-seller entry validation before scoring.

**Tech Stack:** Markdown Skill package, YAML UI metadata, Codex browser tools, SellerSprite web/API documentation.

## Global Constraints

- Install at `/Users/pingwei/.codex/skills/parts-product-selection` so Codex auto-discovers it.
- Do not read, print, write, or commit `SELLERSPRITE_SECRET_KEY`.
- Do not claim a formal score when ASIN, verified market data, or hard-fit specifications are unavailable.
- Treat head-seller data as a 25-point validation layer and middle/tail-seller data as a 75-point entry layer.
- Never make purchases, add products to carts, modify listings, or change SellerSprite subscriptions while researching.

---

### Task 1: Scaffold the auto-discovered Skill

**Files:**
- Create: `/Users/pingwei/.codex/skills/parts-product-selection/SKILL.md`
- Create: `/Users/pingwei/.codex/skills/parts-product-selection/agents/openai.yaml`

**Interfaces:**
- Consumes: A user prompt containing an Amazon ASIN, product image, or both.
- Produces: A reusable instruction package selected automatically for product-selection requests.

- [ ] **Step 1: Initialize the package with the platform scaffold**

Run:

```bash
python3 /Users/pingwei/.codex/skills/.system/skill-creator/scripts/init_skill.py parts-product-selection --path /Users/pingwei/.codex/skills --interface display_name='配件选品（新卖家）' --interface short_description='基于头部验证与中尾部进入难度的配件选品' --interface default_prompt='Use $parts-product-selection to evaluate this ASIN or product image for new-seller entry.'
```

Expected: a folder containing `SKILL.md` and `agents/openai.yaml`.

- [ ] **Step 2: Replace the scaffold instructions with the new-seller workflow**

Write `SKILL.md` with frontmatter whose `name` is `parts-product-selection` and whose description explicitly triggers for Amazon ASIN, product image, SellerSprite keyword/CPC research, and new-seller product-selection scoring. Include the exact eight score dimensions, 25/75 data-layer split, CPC formulas, hard-fit gate, data-gap handling, and required output headings from the approved design.

- [ ] **Step 3: Verify UI metadata**

Ensure `agents/openai.yaml` includes quoted `display_name`, `short_description`, and a `default_prompt` that explicitly invokes `$parts-product-selection`.

- [ ] **Step 4: Validate the package**

Run:

```bash
python3 /Users/pingwei/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/pingwei/.codex/skills/parts-product-selection
```

Expected: validation exits with code 0.

### Task 2: Forward-test the Skill with a known ASIN

**Files:**
- Modify: `/Users/pingwei/.codex/skills/parts-product-selection/SKILL.md` only if the test exposes a missing instruction.

**Interfaces:**
- Consumes: `B0BV241H3F` and the known SellerSprite outcome: 238 reverse-order keywords, a relevant core term `beach shirts for men`, an example PPC range of $0.93–$1.22, and multiple invalid-exposure terms.
- Produces: An evidence-labelled entry assessment that does not treat a head keyword’s suggested bid as a new seller’s default bid.

- [ ] **Step 1: Run a fresh invocation prompt**

Use this prompt without preloading the expected conclusion:

```text
Use $parts-product-selection to evaluate Amazon ASIN B0BV241H3F for a new seller.
```

- [ ] **Step 2: Check required behaviours**

Confirm the result labels head versus middle/tail data, puts `mens birthday gift ideas`, `trending items`, and `mens clothing` in the negative-keyword section when they have no conversion signal, and calculates the default CPC ceiling from 30% ACoS and 8% conversion when costs are absent.

- [ ] **Step 3: Correct the package only if needed**

If an instruction is missing, update `SKILL.md`, rerun `quick_validate.py`, and repeat the invocation.

### Task 3: Commit and synchronize the source copy

**Files:**
- Create: `skills/parts-product-selection/SKILL.md`
- Create: `skills/parts-product-selection/agents/openai.yaml`
- Modify: `docs/superpowers/specs/2026-07-23-parts-product-selection-design.md`
- Create: `docs/superpowers/plans/2026-07-23-parts-product-selection-skill.md`

**Interfaces:**
- Consumes: The validated installed package and a Git repository with a user-authorized `origin` remote.
- Produces: A local commit and, when a remote exists, a pushed branch containing the Skill.

- [ ] **Step 1: Copy the validated package into the repository**

Run:

```bash
mkdir -p skills
cp -R /Users/pingwei/.codex/skills/parts-product-selection skills/parts-product-selection
```

Expected: the repository contains the same `SKILL.md` and `agents/openai.yaml` as the installed package.

- [ ] **Step 2: Create the local Git commit**

Run:

```bash
git init
git add skills/parts-product-selection docs/superpowers/specs/2026-07-23-parts-product-selection-design.md docs/superpowers/plans/2026-07-23-parts-product-selection-skill.md
git commit -m "feat: add new-seller product selection skill"
```

Expected: one local commit containing the reusable Skill and approved documentation. If a repository already exists, omit `git init`.

- [ ] **Step 3: Push only when `origin` is configured**

Run:

```bash
git remote get-url origin
git push -u origin HEAD
```

Expected: the remote accepts the commit. If `origin` is absent, stop after the local commit and request the remote repository URL; do not invent or add a remote.
