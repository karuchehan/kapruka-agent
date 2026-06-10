# Autoresearch Learnings Log

> This file is automatically updated by the autoresearch loop. Do not edit manually.

## What Works (Confirmed Improvements)
<!-- populated automatically -->

## What Does Not Work (Tried And Discarded)
<!-- populated automatically -->
### Iteration 2 — 2026-06-10 — Winner: **BASELINE**

**Scores:** baseline 4.07 → challenger 4.3

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.45 | 4.85 ▲ +0.40 |
| personalization | 3.6 | 3.75 ▲ +0.15 |
| product_quality | 3.55 | 3.4 ▼ -0.15 |
| tone | 4.6 | 4.75 ▲ +0.15 |
| language_match | 4.65 | 4.9 ▲ +0.25 |
| completeness | 3.6 | 4.15 ▲ +0.55 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_005**: The agent skipped asking about occasion, budget, and preferences — rushing to specific products without enough information to make truly tailored recommendations. *(dims: completeness: Jumped straight to product recommendations without asking about occasion, budget, or recipient preferences — skips important qualification steps, personalization: Used Dinesh's name but ignored the age/gender context of the recipient in a meaningful way; a spa voucher suits a 55-year-old but no rationale or tailoring was explained, relevance: Did not mention delivery to Colombo is possible, which was an implicit concern given the scenario)*
  - **scenario_007**: The agent skipped all discovery questions and immediately pushed specific products, despite the user signalling uncertainty — this is premature and risks irrelevance. *(dims: completeness: Jumped straight to specific products without asking a single clarifying question (budget, parents' preferences, what they enjoy) — user explicitly said they had 'no idea' what to get, product_quality: Chocolate + Wine hamper may not be appropriate for all Sri Lankan parents (cultural/religious considerations not assessed); no budget check done before suggesting Rs. 6,800, personalization: Used the name but ignored the 23-year-old male context — a young adult buying for parents likely has budget constraints worth asking about)*
  - **scenario_009**: The response is a single cold question that ignores the user's actual concern about Sunday delivery feasibility and doesn't move the conversation toward identifying what product they need. *(dims: relevance: The user asked if Sunday delivery is possible — the agent skipped any acknowledgment of that concern entirely, product_quality: No products were mentioned or asked about, which is understandable at this stage, but the agent didn't even attempt to move toward understanding what Pradeep wants to buy, tone: The response is too terse and clinical — feels like a form field, not a human conversation, completeness: Only asked one question (city/area) without acknowledging the Sunday deadline concern or asking what they want to buy, leaving the conversation feeling incomplete)*
  - **scenario_010**: The response completely avoided answering the user's core question about same-day Kandy delivery and instead asked an off-topic clarifying question about the specific area, without mentioning any product categories, delivery feasibility, or asking what they want to send. *(dims: relevance: Did not answer whether same-day delivery to Kandy is possible — deflected entirely with a clarifying question, product_quality: No product categories or delivery options were mentioned at all, completeness: Failed to move conversation forward meaningfully — asking about sub-area without first addressing the core question or asking what they want to send)*

**What challenger targeted:**
  (not recorded)

**Outcome:** **Blocked by regression:** product_quality: 3.55 → 3.4 (-0.15)

---


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
| 2 | 2026-06-10 | 4.07 | 4.3 | BASELINE | relevance: 4.45 → 4.85 (+0.40); personalization: 3.6 → 3.75 (+0.15) |
| 1 | 2026-06-10 | 4.02 | 4.14 | BASELINE | challenger regressed product_quality (-0.20) despite improving personalization (+0.35), completeness (+0.40) |

## Weakest Dimensions Over Time
<!-- populated automatically -->
- **Run 2**: product_quality, personalization, completeness

- **Run 1**: product_quality (3.45), completeness (3.45), personalization (3.55)
