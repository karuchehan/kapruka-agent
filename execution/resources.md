# Autoresearch Learnings Log

> This file is automatically updated by the autoresearch loop. Do not edit manually.

## What Works (Confirmed Improvements)
<!-- populated automatically -->
### Iteration 4 — 2026-06-10 — Winner: **CHALLENGER**

**Scores:** baseline 4.19 → challenger 4.5

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.75 | 5 ▲ +0.25 |
| personalization | 3.7 | 3.95 ▲ +0.25 |
| product_quality | 3.35 | 3.95 ▲ +0.60 |
| tone | 4.75 | 4.9 ▲ +0.15 |
| language_match | 4.8 | 4.95 ▲ +0.15 |
| completeness | 3.8 | 4.25 ▲ +0.45 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_004**: The response asks two questions simultaneously ('for whom' and 'what occasion') in a single sentence, directly violating the requirement to ask exactly one clarifying question. *(dims: product_quality: No products were suggested or referenced, but more critically the clarifying question asks two things at once ('for yourself or someone special, AND what's the occasion') — violating the one-question rule, personalization: Used the name but ignored gender/age context that could have shaped the question, completeness: Asks two sub-questions in one sentence, which may confuse and slow down the conversation rather than move it forward cleanly)*
  - **scenario_009**: The response implies Sunday delivery is doable without any caveat or verification, which could set false expectations before knowing the area or product. *(dims: product_quality: No products were mentioned or suggested — this dimension is not applicable yet, but scoring reflects no product guidance at this stage, relevance: Did not caveat or acknowledge uncertainty about Sunday delivery feasibility before asking follow-up questions — slightly over-promises with 'I'd love to help you get something there by Sunday')*
  - **scenario_010**: The response dismissed same-day delivery too quickly and failed to mention any product categories that might qualify, missing a key expected quality of the response. *(dims: product_quality: No product categories were mentioned at all — the response missed the opportunity to indicate which types of items (e.g. cakes, flowers, groceries) might qualify for faster delivery to Kandy, personalization: Used name but made no use of gender or age context, which could have helped tailor suggestions, completeness: Deflected to next-day without exploring whether any same-day options exist for specific categories, leaving the user less informed than they could be)*
  - **scenario_011**: The response skips the essential step of acknowledging the international sender context and providing reassurance about how Kapruka handles overseas gifting, making it feel premature and incomplete for someone ordering from London. *(dims: completeness: Jumps straight to specific products without asking about budget, delivery address, or preferences — critical for an international sender, personalization: Uses the name but ignores the international context entirely — no reassurance about overseas ordering or Kapruka's cross-border service, completeness: Does not acknowledge that the user is calling from London or explain how they can place the order from abroad)*

**What challenger targeted:**
  (not recorded)

**Outcome:** No regressions — challenger promoted.

---

### Iteration 3 — 2026-06-10 — Winner: **CHALLENGER**

**Scores:** baseline 4.12 → challenger 4.29

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.55 | 4.8 ▲ +0.25 |
| personalization | 3.7 | 3.75 → |
| product_quality | 3.45 | 3.45 → |
| tone | 4.7 | 4.9 ▲ +0.20 |
| language_match | 4.7 | 4.85 ▲ +0.15 |
| completeness | 3.6 | 4 ▲ +0.40 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_004**: The agent ignored the expected behavior entirely — it should have asked one warm clarifying question instead of jumping to random product recommendations with no context about the recipient or occasion. *(dims: relevance: User gave a vague request; agent should have asked a clarifying question (for whom, what occasion) instead of jumping to products, personalization: Used the name but ignored the core issue — no context was gathered before recommending; gender assumption led to male grooming products without asking, product_quality: Products were suggested without knowing who the gift is for, the occasion, or the budget — completely context-free, completeness: Did not ask the single most important clarifying question (who is this for / what occasion); conversation is not meaningfully advanced, tone: Slightly casual but the unsolicited product dump undermines warmth and feels presumptuous)*
  - **scenario_007**: The response skips any discovery questions entirely and jumps to specific products, which feels presumptuous when the user explicitly said they have no idea what to get — asking about budget or preferences was essential here. *(dims: completeness: jumped straight to product recommendations without asking any clarifying questions (budget, parents' preferences, occasion style) — misses a key expected quality, personalization: uses Kasun's name but doesn't leverage his age (23) or any other context to make the suggestion feel truly tailored, completeness: does not move the conversation forward interactively — no follow-up question asked to refine the recommendation)*
  - **scenario_009**: The response doesn't acknowledge or caveat the Sunday deadline feasibility at all — it jumps to asking questions without addressing whether Sunday delivery is actually possible, which was the user's core concern. *(dims: product_quality: No products were mentioned or explored at all — this dimension cannot be rated meaningfully and scores minimum as there was no product engagement, relevance: The response didn't directly address whether Sunday delivery is feasible or caveat the uncertainty — it skipped past the deadline question slightly)*
  - **scenario_010**: The response completely avoids answering the core question about same-day Kandy delivery availability, offering no information about which categories typically qualify, making it unhelpful despite having a friendly tone. *(dims: relevance: The response doesn't actually answer whether same-day delivery to Kandy is possible — it deflects entirely without providing any useful information, product_quality: No product categories or options were mentioned at all, missing a key expected quality, completeness: While it asks two questions, it fails to provide any substantive information about what is or isn't available for same-day delivery to Kandy, leaving the user no better informed, personalization: Using the name is minimal personalization; age/gender context not leveraged at all)*

**What challenger targeted:**
  (not recorded)

**Outcome:** No regressions — challenger promoted.

---


### Protected Behavioral Rules — Delivery + Completeness (DO NOT REVERT)

**Scenarios 009 & 010 — Delivery honesty pattern:**

The correct behavior is NOT to say "not available" and NOT to promise delivery without checking. Be specific and helpful.

- For Kandy same-day: "Same-day to Kandy is possible for flowers and cakes but not for most other categories — want me to check what's available?"
- For Sunday deadlines: acknowledge urgency first, then ask city, then check

**Pattern: validate → clarify → check → confirm. Never guess. Never deflect.**

This is a protected behavioral rule. The loop must not override or weaken it. If a challenger modifies delivery behavior, the validate→clarify→check→confirm sequence must be preserved exactly.

**Scenario 011 — London expat / international sender completeness:**

Agent is over-qualifying and under-delivering. After getting city and occasion, immediately search and show products — do NOT keep asking qualification questions. The user has given enough context. Search, surface options, let the user react.

Rule: once city + occasion are known, go to products. Additional questions come AFTER showing options, not before.

---

### Manual Patch — 2026-06-10 — v4.0 System Prompt (DO NOT REVERT)

These three rules were patched manually after 2 consecutive autoresearch iterations both failed with the same product_quality regression. The loop was generating challengers that were too broad — applying gifting qualification rules globally, which made Claude too cautious in self-shopping scenarios.

**Why manual instead of through the loop:**
The loop cannot break this pattern on its own because it doesn't know *which* rule causes the regression. It sees "qualification rules improved completeness" and keeps adding more of them. The regression source is scope creep — rules intended for gifting accidentally suppressing products in self-shopping turns.

**The three protected rules (treat as stable — do not modify in challenger generation):**

1. **MODE B scoped to GIFTING ONLY** — self-shopping always uses MODE A (show products + optional follow-up question). Before this fix, MODE B was triggering for all vague requests, causing Claude to withhold products when it should have shown them. This was the root cause of the product_quality regression in iterations 1 and 2.

2. **DELIVERY warmth before city question** — When a user asks about delivery or mentions a deadline, Claude must acknowledge urgency warmly first ("I'd love to get something there by Sunday!"), then ask for city. Before this fix, the delivery rule was technically correct (ask for city) but the judge consistently penalized the cold, abrupt tone. The fix is phrasing, not a new rule.

3. **BUDGET HARD RULE (gifting only)** — When the user states a budget, never suggest items or combinations exceeding it. Lead with within-budget options. Only mention pricier items with an explicit caveat ("if you want to stretch a little..."). Scoped to gifting context only.

**For future challenger generation:** These rules may be *refined* but not removed or weakened. If a challenger wants to modify delivery behavior, the warmth acknowledgment must be preserved. If a challenger wants to modify MODE B, the GIFTING ONLY scope must be preserved.

---

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
| 4 | 2026-06-10 | 4.19 | 4.5 | CHALLENGER | relevance: 4.75 → 5 (+0.25); personalization: 3.7 → 3.95 (+0.25) |
| 3 | 2026-06-10 | 4.12 | 4.29 | CHALLENGER | relevance: 4.55 → 4.8 (+0.25); tone: 4.7 → 4.9 (+0.20) |
| 2 | 2026-06-10 | 4.07 | 4.3 | BASELINE | relevance: 4.45 → 4.85 (+0.40); personalization: 3.6 → 3.75 (+0.15) |
| 1 | 2026-06-10 | 4.02 | 4.14 | BASELINE | challenger regressed product_quality (-0.20) despite improving personalization (+0.35), completeness (+0.40) |

## Weakest Dimensions Over Time
<!-- populated automatically -->
- **Run 4**: product_quality, personalization, completeness
- **Run 3**: product_quality, completeness, personalization
- **Run 2**: product_quality, personalization, completeness

- **Run 1**: product_quality (3.45), completeness (3.45), personalization (3.55)
