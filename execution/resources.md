# Autoresearch Learnings Log

> This file is automatically updated by the autoresearch loop. Do not edit manually.

## What Works (Confirmed Improvements)
<!-- populated automatically -->

## What Does Not Work (Tried And Discarded)
<!-- populated automatically -->

### Iteration 1 — 2026-06-10 — Winner: **BASELINE**

**Scores:** baseline 4.02 → challenger 4.14

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.55 | 4.65 ▲ +0.10 |
| personalization | 3.55 | 3.90 ▲ +0.35 |
| product_quality | 3.45 | 3.25 ▼ -0.20 |
| tone | 4.40 | 4.35 → |
| language_match | 3.80 | 3.65 ▼ -0.15 |
| completeness | 3.45 | 3.85 ▲ +0.40 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_004**: The agent asked the wrong clarifying question — jumped to product categories instead of asking who the gift is for and what the occasion is *(dims: personalization:2, product_quality:1, completeness:2)*
  - **scenario_007**: Agent skipped all qualification questions and immediately pushed products for an anniversary gift where sender said "I have no idea what to get" *(dims: completeness:2)*
  - **scenario_009**: Failed to ask for delivery city before suggesting Sunday delivery feasibility *(dims: product_quality:1)*
  - **scenario_010**: Confidently asserted same-day Kandy delivery without caveats or category specifics *(dims: product_quality:1, completeness:2)*
  - **scenario_014**: Responded in formal English to Tanglish input ("machan I need something for my amma la") — complete language_match failure *(dims: relevance:2, personalization:2, product_quality:1, language_match:1, completeness:1)*

**What challenger targeted:**
  - [personalization]: Added age/gender profiling with concrete category guidance per demographic
  - [completeness/product_quality]: Added BUDGET RULES requiring within-budget options first
  - [completeness]: Added gifting qualification requirement for anniversary/milestone gifts
  - [completeness/relevance]: Added DELIVERY section with honest caveats, requiring city before any delivery assurance
  - [relevance/completeness]: Added HONESTY section for unavailable products
  - [language_match]: Strengthened Sinhala script rule to minimize English filler
  - [relevance/completeness]: Added VAGUE REQUESTS section redirecting to who/occasion

**Outcome:** **Blocked by regression:** product_quality 3.45 → 3.25 (-0.20). The challenger's extra qualification rules caused it to withhold products in scenarios where it should have shown them (e.g. scenario_008 dropped from 4.67→4.00, scenario_015 still at 3.67). Challenger improved completeness and personalization significantly but hurt product_quality.

**Do not repeat:** Adding too many "qualify before showing products" rules breaks product_quality — Claude becomes too cautious and withholds products unnecessarily. Qualification rules must be scoped to GIFTING only, not all searches.

---

## Iteration History

| Run | Date | Baseline | Challenger | Winner | Key Changes |
|---|---|---|---|---|---|
| 1 | 2026-06-10 | 4.02 | 4.14 | BASELINE | challenger regressed product_quality (-0.20) despite improving personalization (+0.35), completeness (+0.40) |

## Weakest Dimensions Over Time
<!-- populated automatically -->

- **Run 1**: product_quality (3.45), completeness (3.45), personalization (3.55)
