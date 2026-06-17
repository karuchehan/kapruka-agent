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
### Iteration 21 — 2026-06-16 — Winner: **BASELINE**

**Scores:** baseline 4.42 → challenger 4.22

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.92 | 4.71 ▼ -0.21 |
| personalization | 3.96 | 3.79 ▼ -0.17 |
| product_quality | 3.79 | 3.71 ▼ -0.08 |
| tone | 4.88 | 4.71 ▼ -0.17 |
| language_match | 4.92 | 4.67 ▼ -0.25 |
| completeness | 4.04 | 3.71 ▼ -0.33 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_001**: The agent skipped the clarifying question entirely and immediately listed three specific products with prices, which is too transactional for a user who is casually browsing and not yet ready to narrow down. *(dims: completeness: Jumped straight to specific products without asking any clarifying question — the expected behaviour was to ask one narrowing question before recommending, personalization: Used the name but did not leverage age/lifestyle context meaningfully; felt like a generic product dump rather than a tailored suggestion, relevance: User said 'just looking around' which signals exploration, not readiness to buy — diving into SKUs with prices was premature)*
  - **scenario_002**: The agent falsely claimed Kapruka doesn't stock electronics reliably and offered no product suggestions whatsoever, which is a critical failure for a shopping assistant responding to a clear purchase intent. *(dims: relevance: Agent deflected the electronics request rather than engaging with it directly, personalization: Used the name Ruwan but failed to leverage age/gender context for relevant suggestions, product_quality: No products were suggested at all — the response avoids the entire product domain, completeness: Did not move toward any specific product or category; deflection moves the conversation backward not forward)*
  - **scenario_004**: The response asks two distinct questions in a single sentence ('for yourself or someone special' AND 'what's the occasion'), which violates the single clarifying question guideline and reduces conversational clarity. *(dims: product_quality: No products were suggested or referenced, but more critically the single clarifying question asked TWO questions in one (for whom + occasion), violating the 'exactly one clarifying question' guideline, personalization: Used the name but missed an opportunity to lean into gender/age context (e.g., could have narrowed framing slightly for a 32-year-old male), completeness: The question bundles two sub-questions into one sentence, which technically violates the single-question rule and may feel slightly overwhelming despite appearing brief)*
  - **scenario_012**: Multi-item cart: cake + flowers together *(dims: product_quality: Agent assumed specific products (chocolate 1kg cake, red rose bouquet) without asking for preferences — no flavour, size, or flower type preferences were gathered, completeness: Skipped preference-gathering entirely and jumped straight to a specific product recommendation, missing a key conversational step that would lead to better cart-building)*
  - **scenario_015**: Sinhala script input — full Sinhala response required *(dims: product_quality: No products were suggested at all — the agent only asked a clarifying question without offering even a few initial options)*

**Outcome:** **Blocked by no-regression rule (per-scenario avg ≥ 4.0):** scenario_003 4.67→3.33; scenario_007 4.17→3.67; scenario_008 4.5→3.33; scenario_009 4.5→2.83; scenario_011 4.5→3.67; scenario_015 4.17→3.67; scenario_017 4.67→3.67

---

### Iteration 20 — 2026-06-16 — Winner: **BASELINE**

**Scores:** baseline 4.39 → challenger 4.27

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.88 | 4.75 ▼ -0.13 |
| personalization | 3.88 | 3.67 ▼ -0.21 |
| product_quality | 3.83 | 4 ▲ +0.17 |
| tone | 4.88 | 4.79 ▼ -0.09 |
| language_match | 4.79 | 4.71 ▼ -0.08 |
| completeness | 4.08 | 3.71 ▼ -0.37 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_002**: The agent completely abandoned the user's explicit electronics request and redirected to irrelevant product categories without first exploring what electronics Kapruka actually stocks, which is a fundamental failure in relevance and trust. *(dims: relevance: User asked specifically about electronics but agent immediately deflected to completely unrelated categories like chocolates and hampers, product_quality: Suggested chocolates, gourmet hampers, books, and fragrances to someone who explicitly asked for electronics — entirely off-topic, personalization: Used the name Ruwan but ignored the 45-year-old male context entirely; no attempt to match electronics to his profile, completeness: Failed to explore what electronics Kapruka does carry before giving up; did not move the user toward any electronics solution)*
  - **scenario_004**: The response asks two questions in one sentence, violating the 'exactly one clarifying question' requirement — it should have picked either recipient or occasion, not both. *(dims: product_quality: No products were suggested, which is fine at this stage, but the dimension requires evaluation — there's zero product engagement, personalization: Used the name but ignored gender/age context that could have shaped the question (e.g., hinting at categories relevant to a 32-year-old male), completeness: Asked two questions in one ('for yourself or someone special, and what's the occasion?') — this violates the single clarifying question requirement)*
  - **scenario_011**: The agent skipped essential trust-building steps — it never acknowledged she was ordering from London, never reassured her about international delivery, and jumped to asking for the delivery address before even confirming her budget or preferences, making the conversation feel premature and incomplete. *(dims: completeness: Jumped straight to asking for delivery address without acknowledging the international sender context, reassuring about overseas gifting capability, or asking about budget/preferences — skipping crucial trust-building steps, personalization: Used her name but ignored the international context entirely — no acknowledgment that she's calling from London or that Kapruka specialises in this, relevance: Did not mention Kapruka's international delivery reliability, which is a key concern for an overseas sender)*
  - **scenario_012**: Multi-item cart: cake + flowers together *(dims: product_quality: Agent assumed specific products (Chocolate 1kg cake, Red Rose Bouquet) without asking preferences — skipped preference gathering entirely, completeness: Jumped straight to a specific product recommendation without asking for cake flavour/size or flower type/colour preferences, missing a key conversation-building step)*

**Outcome:** **Blocked by no-regression rule (per-scenario avg ≥ 4.0):** scenario_009 4.5→2.67; scenario_012 4→3.33; scenario_015 4→2.67

---

### Iteration 19 — 2026-06-16 — Winner: **BASELINE**

**Scores:** baseline 4.39 → challenger 4.28

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.96 | 4.75 ▼ -0.21 |
| personalization | 3.88 | 3.71 ▼ -0.17 |
| product_quality | 3.88 | 4 ▲ +0.12 |
| tone | 4.75 | 4.75 → |
| language_match | 4.71 | 4.63 ▼ -0.08 |
| completeness | 4.17 | 3.83 ▼ -0.34 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_002**: The agent immediately dismissed the user's core request without attempting to offer any relevant electronics or similar products, deflecting to gift shopping which was never mentioned. *(dims: relevance: User asked specifically about electronics but agent deflected entirely instead of offering available electronic or tech-adjacent products, product_quality: No products were suggested at all — completely failed to recommend anything electronics-related, personalization: Used the name Ruwan but ignored age/gender context entirely; pivoted away from the user's stated need, completeness: Redirected to 'gifts' rather than moving toward the user's actual stated intent of buying electronics)*
  - **scenario_011**: The agent skips essential qualifying steps — it never reassures Nathasha that Kapruka handles international orders from London, never asks about budget, and jumps prematurely to a bundle push without addressing delivery timing for the Vesak deadline. *(dims: completeness: Agent jumps straight to a bundle upsell without asking about budget, delivery address, or preferences — skipping critical qualifying questions for an international order, personalization: Uses name but ignores the international sender context entirely — no reassurance about Kapruka's overseas gifting capability or delivery reliability to Colombo, completeness: No mention of how international ordering works, no ask about budget or specific preference, no confirmation of delivery logistics for next week's Vesak deadline)*
  - **scenario_012**: The agent skipped preference-gathering entirely and assumed specific products, which bypasses the natural cart-building conversation and risks recommending something Ishara doesn't want. *(dims: completeness: Jumped straight to specific products without asking for preferences (flavour, size, flower type, colour) — skipped the cart-building conversation entirely, product_quality: Assumed specific products (chocolate cake, red roses) without asking Ishara's preferences — these may not suit her needs at all, personalization: Used the name but didn't leverage any other profile context; no acknowledgment of it being for a birthday recipient vs herself)*
  - **scenario_015**: The response asks a clarifying question but fails to suggest any products, leaving the conversation incomplete and the user with nothing concrete to consider. *(dims: product_quality: No products were suggested at all — the agent asked a clarifying question but offered zero initial suggestions to anchor the conversation, completeness: Asking only for age without offering even one or two example gift ideas leaves the user with nothing to react to or consider, language_match: 'recommend' is an English word embedded in Sinhala — while Tanglish is acceptable, a more natural Sinhala equivalent like 'යෝජනා කරන්න' would better match pure Sinhala script input)*

**Outcome:** **Blocked by no-regression rule (per-scenario avg ≥ 4.0):** scenario_009 4.5→2.67; scenario_017 4.67→3.67

---

### Iteration 18 — 2026-06-16 — Winner: **BASELINE**

**Scores:** baseline 4.45 → challenger 4.1

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 5 | 4.58 ▼ -0.42 |
| personalization | 3.88 | 3.75 ▼ -0.13 |
| product_quality | 3.96 | 3.79 ▼ -0.17 |
| tone | 4.88 | 4.58 ▼ -0.30 |
| language_match | 4.83 | 4.46 ▼ -0.37 |
| completeness | 4.17 | 3.46 ▼ -0.71 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_002**: The agent abandons the user's explicit electronics intent without attempting to help, offering no products, no alternatives within electronics, and no value — severely failing the core purpose of a shopping assistant. *(dims: relevance: The agent immediately deflects from electronics without exploring what the user actually wants or offering any electronics options, personalization: Uses Ruwan's name once but ignores all other profile context (age, gender) in shaping the response, product_quality: No products were suggested at all — completely fails this dimension, completeness: Redirects away from the stated need rather than moving toward fulfilling it; the follow-up question is generic and avoids the core request)*
  - **scenario_015**: Sinhala script input — full Sinhala response required *(dims: product_quality: No products were suggested at all — the agent only asked a clarifying question without offering any initial options)*

**Outcome:** **Blocked by no-regression rule (per-scenario avg ≥ 4.0):** scenario_001 5→3.5; scenario_007 4.17→3.83; scenario_009 4.5→2.67; scenario_010 4.67→3.17; scenario_011 4.33→3.5; scenario_014 4.67→3.33; scenario_015 4→3.83; scenario_016 4→3.83

---

### Iteration 17 — 2026-06-16 — Winner: **BASELINE**

**Scores:** baseline 4.45 → challenger 4.24

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.96 | 4.79 ▼ -0.17 |
| personalization | 4 | 3.75 ▼ -0.25 |
| product_quality | 3.83 | 3.79 → |
| tone | 4.92 | 4.71 ▼ -0.21 |
| language_match | 4.79 | 4.67 ▼ -0.12 |
| completeness | 4.21 | 3.75 ▼ -0.46 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_002**: The agent immediately deflected from the user's direct electronics request without exploring the need or offering any relevant alternatives, suggesting completely off-topic product categories instead. *(dims: relevance: User asked specifically about electronics and the agent deflected entirely instead of addressing the request, product_quality: Suggested hampers, chocolates, and fragrances are not appropriate alternatives for a 45-year-old male looking for electronics, completeness: Did not move the conversation toward electronics or even explore what type of electronics the user wants before deflecting, personalization: Used the name Ruwan but did not leverage age or gender context to suggest anything relevant)*
  - **scenario_011**: The response skipped acknowledging the London-to-Colombo international gifting context entirely and offered no reassurance about delivery, which is the user's primary concern, while also jumping to a bundle pitch before understanding budget or preferences. *(dims: completeness: Never acknowledged the international sender context or reassured about overseas delivery — a critical gap for someone calling from London, completeness: Jumped straight to specific products without asking about budget or preferences, skipping an important discovery step, personalization: Used the name but didn't leverage any other context (age 27, female, sending to parents) to tailor the recommendation further)*
  - **scenario_012**: Multi-item cart: cake + flowers together *(dims: completeness: Jumped straight to specific products without asking for preferences (flavour, size, flower type, colour) — skips the cart-building conversation entirely, product_quality: Assumed specific products (chocolate cake 1kg, red roses 12 stems) without any input from the user about preferences, occasion recipient, or budget)*
  - **scenario_015**: The response asked a relevant clarifying question but offered zero product ideas, leaving the user with nothing concrete to consider while waiting to continue. *(dims: product_quality: No products were suggested at all — the response only asked a clarifying question without offering even a few initial options, language_match: 'suggest' is an English word used mid-sentence; a more natural Sinhala equivalent like 'යෝජනා කරන්නම්' would be better, completeness: While asking age is smart, the response could have offered a few broad categories (toys, clothing, sweets) to move forward while awaiting the answer)*

**Outcome:** **Blocked by no-regression rule (per-scenario avg ≥ 4.0):** scenario_004 4.33→3.67; scenario_007 4.17→3.83; scenario_009 4.5→3; scenario_010 4.5→3.17; scenario_012 4→3.5

---

### Iteration 16 — 2026-06-16 — Winner: **BASELINE**

**Scores:** baseline 4.44 → challenger 4.03

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.92 | 4.58 ▼ -0.34 |
| personalization | 3.96 | 3.58 ▼ -0.38 |
| product_quality | 3.92 | 3.63 ▼ -0.29 |
| tone | 4.88 | 4.38 ▼ -0.50 |
| language_match | 4.88 | 4.33 ▼ -0.55 |
| completeness | 4.13 | 3.67 ▼ -0.46 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_002**: The agent prematurely dismissed the user's electronics request without making any effort to find relevant products, then redirected to completely unrelated categories like chocolates and hampers for a 45-year-old man who came with clear purchase intent. *(dims: relevance: The user explicitly asked about electronics and the agent immediately deflected without attempting to help with electronics at all, product_quality: No electronics were suggested; Kapruka does carry some electronics/gadgets and the agent made no attempt to explore what's available, personalization: Used the name Ruwan but ignored the 45-year-old male context entirely — redirected to hampers and chocolates with no relevance to his profile, completeness: Pivoted away from the user's stated intent rather than moving toward helping them find electronics)*
  - **scenario_011**: The agent skipped the critical step of reassuring the London-based caller about international gifting capability and jumped prematurely to requesting a delivery address without asking about budget or preferences. *(dims: completeness: Jumped straight to asking for delivery address without acknowledging the international sender context, reassuring about overseas delivery capability, or asking about budget/preferences first — skipped several key conversational steps, personalization: Used the name but ignored the overseas context entirely — no acknowledgment that she's calling from London or that Kapruka specialises in exactly this kind of international gifting, relevance: Did not address the international sender situation at all, which is a central part of the user's message)*
  - **scenario_012**: Multi-item cart: cake + flowers together *(dims: product_quality: Agent jumped to specific products without asking preferences (flavour, size, flower type, colour) — assumes defaults without confirming, completeness: Skipped preference gathering entirely; should have asked cake and flower preferences before presenting specific options, missing a key step in building the cart properly)*
  - **scenario_015**: The agent asked a good clarifying question but offered zero product suggestions, leaving the user with nothing actionable — a good agent would balance the question with some initial gift ideas. *(dims: product_quality: No products were suggested at all — the response only asked a clarifying question without offering any initial ideas, completeness: While asking for age is smart, the agent could have offered a few options across age ranges to move the conversation forward more usefully)*

**Outcome:** **Blocked by no-regression rule (per-scenario avg ≥ 4.0):** scenario_007 4.17→3.33; scenario_009 4.5→2.83; scenario_010 4.67→3.33; scenario_012 4→3.83; scenario_016 4.67→3.33; scenario_017 4.67→3.5

---

### Iteration 15 — 2026-06-16 — Winner: **BASELINE**

**Scores:** baseline 4.45 → challenger 4.31

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.96 | 4.75 ▼ -0.21 |
| personalization | 4 | 3.88 ▼ -0.12 |
| product_quality | 3.88 | 3.75 ▼ -0.13 |
| tone | 4.96 | 4.83 ▼ -0.13 |
| language_match | 4.92 | 4.71 ▼ -0.21 |
| completeness | 4 | 3.92 ▼ -0.08 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_002**: The agent prematurely dismissed the electronics category without checking what is actually available and redirected to entirely irrelevant product categories, completely failing the user's stated intent. *(dims: relevance: User asked about electronics and the agent immediately deflected without attempting to explore what electronics Kapruka does carry, personalization: Used name once but ignored age/gender context entirely when suggesting alternatives — gourmet hampers and chocolates are not tailored to a 45-year-old male shopping for electronics, product_quality: Suggested completely off-category products (hampers, chocolates, fragrances) that have no connection to the user's expressed intent, completeness: Shut down the conversation instead of moving it forward — did not attempt to find any electronics available, nor probe what the user specifically needs)*
  - **scenario_011**: Caller in London, recipient in Colombo, Vesak next week *(dims: completeness: Jumped straight to specific products and a close without asking about budget or preferences, skipping key discovery questions that would help narrow down options for parents)*
  - **scenario_012**: Multi-item cart: cake + flowers together *(dims: completeness: The agent jumped straight to specific products without asking for preferences (flavour, size, flower type, colour) — skipping the cart-building discovery phase entirely, product_quality: Assumed specific products (chocolate cake 1kg, red rose bouquet) without asking Ishara's preferences, which may not match her needs or budget)*
  - **scenario_015**: The agent asked only about budget without suggesting any gift options or asking the daughter's age, leaving the user with no actionable help toward finding a gift. *(dims: product_quality: No products were suggested at all — the agent only asked about budget without offering any gift ideas, personalization: Agent used the name but missed the opportunity to ask the daughter's age, which is the most critical missing info for a gift recommendation, completeness: Asked only about budget but did not ask about the daughter's age or interests, which are more important gaps for gift selection)*

**Outcome:** **Blocked by no-regression rule (per-scenario avg ≥ 4.0):** scenario_009 4.5→2.67; scenario_010 4.67→3; scenario_011 4.33→3.5

---

### Iteration 14 — 2026-06-16 — Winner: **BASELINE**

**Scores:** baseline 4.38 → challenger 4.15

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.88 | 4.67 ▼ -0.21 |
| personalization | 3.92 | 3.79 ▼ -0.13 |
| product_quality | 3.92 | 3.71 ▼ -0.21 |
| tone | 4.88 | 4.58 ▼ -0.30 |
| language_match | 4.75 | 4.54 ▼ -0.21 |
| completeness | 3.96 | 3.63 ▼ -0.33 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_001**: The agent skips any clarifying question and immediately dumps three specific products with prices, which doesn't match the user's exploratory, casual intent and makes the interaction feel like a sales pitch rather than a helpful conversation. *(dims: completeness: No clarifying question asked — jumps straight to specific products without understanding what Sashika wants, missing the key conversational step, personalization: Name is used once but age/context isn't leveraged beyond that; feels like a generic pitch rather than a tailored suggestion, tone: The response reads like a product listing with enthusiasm punctuation rather than a natural friendly conversation — overly sales-y, language_match: The user opened casually ('hey I'm just looking around') but the agent immediately goes into promo mode without matching that exploratory, low-pressure vibe)*
  - **scenario_002**: The agent immediately dismisses the electronics category without attempting to surface what Kapruka does carry, leaving Ruwan with no actionable path to a purchase. *(dims: relevance: The agent deflects from electronics entirely rather than attempting to address the user's stated need, product_quality: No products were suggested whatsoever — the agent made no attempt to match electronics to Ruwan's profile, completeness: Instead of moving toward a purchase, the agent redirects away from the category without offering any concrete next step or alternative)*
  - **scenario_011**: Caller in London, recipient in Colombo, Vesak next week *(dims: completeness: Jumped straight to asking for delivery address without reassuring about international ordering capability, asking about budget, or exploring preferences — skips critical trust-building steps for an overseas sender)*
  - **scenario_012**: Multi-item cart: cake + flowers together *(dims: product_quality: Agent assumed specific products (Chocolate 1kg cake, Red Rose 12-stem bouquet) without asking for preferences — skipped discovery entirely, completeness: Jumped straight to checkout without asking about cake flavour, size, flower type or colour — missed the cart-building conversation step)*
  - **scenario_015**: Sinhala script input — full Sinhala response required *(dims: product_quality: No actual product suggestions were made — the response only asked clarifying questions without offering any initial gift ideas)*

**Outcome:** **Blocked by no-regression rule (per-scenario avg ≥ 4.0):** scenario_003 4.67→3.5; scenario_009 4.5→2.67; scenario_010 4.5→3; scenario_011 4.17→3.5; scenario_015 4.17→3.17; scenario_016 4→3.67; scenario_017 4.67→3.5

---

### Iteration 13 — 2026-06-16 — Winner: **BASELINE**

**Scores:** baseline 4.5 → challenger 4.12

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.92 | 4.58 ▼ -0.34 |
| personalization | 4 | 3.75 ▼ -0.25 |
| product_quality | 4.04 | 3.54 ▼ -0.50 |
| tone | 4.92 | 4.63 ▼ -0.29 |
| language_match | 4.88 | 4.58 ▼ -0.30 |
| completeness | 4.25 | 3.63 ▼ -0.62 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_002**: The agent falsely dismissed electronics as outside Kapruka's scope and redirected to a gift-shopping framing, completely failing to address the user's direct purchase intent. *(dims: relevance: Agent incorrectly claims electronics aren't Kapruka's strong suit and deflects entirely instead of addressing the user's direct product intent, product_quality: No electronics products were suggested or explored whatsoever, personalization: Used the name Ruwan but ignored age/gender context entirely; redirected to 'gift' framing which wasn't requested, completeness: Conversation was steered away from the user's stated need rather than toward it; failed to move toward any specific product or category)*
  - **scenario_011**: The agent skipped reassuring the London-based sender about Kapruka's international gifting capability and jumped prematurely to collecting the delivery address without asking about budget or preferences first. *(dims: completeness: The agent jumped straight to asking for delivery address without acknowledging the international sender context, reassuring about Kapruka's overseas gifting capability, or asking about budget — skipping important trust-building steps for a London caller, personalization: Used Nathasha's name but ignored the international sender context entirely — no mention that Kapruka specialises in sending from abroad, which is the core anxiety of this user, relevance: Did not address the international shipping aspect at all, which is the key concern for someone calling from London)*

**Outcome:** **Blocked by no-regression rule (per-scenario avg ≥ 4.0):** scenario_004 4.17→3.17; scenario_009 4.5→2.67; scenario_010 4.67→2.83; scenario_012 4.33→3.83; scenario_015 4→3.33; scenario_022_describe_book_context 4.67→1.67

---

### Iteration 12 — 2026-06-16 — Winner: **BASELINE**

**Scores:** baseline 4.46 → challenger 4.26

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.96 | 4.71 ▼ -0.25 |
| personalization | 3.96 | 3.71 ▼ -0.25 |
| product_quality | 3.88 | 3.83 → |
| tone | 4.92 | 4.83 ▼ -0.09 |
| language_match | 4.88 | 4.88 → |
| completeness | 4.17 | 3.58 ▼ -0.59 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_002**: The agent gave up on the user's clear electronics intent too quickly without attempting to offer any relevant alternatives or subcategories that Kapruka might stock, leaving Ruwan with no useful shopping direction. *(dims: relevance: The agent immediately deflected from electronics without attempting to explore any related categories Kapruka might carry, product_quality: No products were suggested or recommended whatsoever — completely failed to address the electronics request, completeness: Instead of moving toward a product or category, the agent redirected entirely away from the user's stated intent, personalization: Used the name but ignored the 45-year-old male context entirely in crafting a meaningful response)*
  - **scenario_004**: The response asks two questions in one sentence ('for yourself or someone special, and what's the occasion?'), which violates the key requirement of asking exactly one clarifying question at a time. *(dims: product_quality: No products were suggested, but this dimension evaluates appropriateness of any products shown — N/A here, scored low because no progress toward actual product discovery, personalization: Used the name but asked two questions in one ('for yourself or someone special, AND what's the occasion?') — violates the single-question rule from expected qualities)*

**Outcome:** **Blocked by no-regression rule (per-scenario avg ≥ 4.0):** scenario_007 4.17→3.83; scenario_009 4.5→2.67; scenario_010 4.5→3.17; scenario_011 4.33→3.5

---

### Iteration 11 — 2026-06-13 — Winner: **BASELINE**

**Scores:** baseline 4.45 → challenger 4.37

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.84 | 4.88 → |
| personalization | 3.88 | 3.88 → |
| product_quality | 3.96 | 3.84 ▼ -0.12 |
| tone | 4.84 | 4.84 → |
| language_match | 4.88 | 4.84 → |
| completeness | 4.28 | 3.92 ▼ -0.36 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_004**: The response bundles two distinct questions into one sentence ('for who' and 'what occasion'), violating the key quality criterion of asking exactly one clarifying question at a time. *(dims: product_quality: No products were suggested or referenced, which is expected given vagueness, but score reflects N/A context — however the question asked two things at once (who + occasion) violating the 'exactly one clarifying question' rule, personalization: Used name but asked two questions in one breath — 'for yourself or someone special, AND what's the occasion?' is two questions bundled together, completeness: Asking two questions at once may overwhelm and doesn't follow the single-question rule, reducing forward momentum)*

**What challenger targeted:**
  (not recorded)

**Outcome:** **Blocked by regression:** product_quality: 3.96 → 3.84 (-0.12); completeness: 4.28 → 3.92 (-0.36)

---

### Iteration 9 — 2026-06-13 — Winner: **BASELINE**

**Scores:** baseline 4.55 → challenger 4.49

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 5 | 4.92 ▼ -0.08 |
| personalization | 3.96 | 3.92 → |
| product_quality | 4.24 | 4.12 ▼ -0.12 |
| tone | 4.88 | 4.84 → |
| language_match | 4.72 | 4.88 ▲ +0.16 |
| completeness | 4.52 | 4.28 ▼ -0.24 |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_015**: Sinhala script input — full Sinhala response required *(dims: product_quality: No products were suggested at all — the response is purely a clarifying question with zero product exploration, language_match: Mixing in English phrases like 'occasion' and 'surprise gift' and 'just' may feel slightly unnatural for a fully Sinhala-script response, though it mirrors common Sri Lankan speech)*

**What challenger targeted:**
  (not recorded)

**Outcome:** **Blocked by regression:** product_quality: 4.24 → 4.12 (-0.12); completeness: 4.52 → 4.28 (-0.24)

---

### Iteration 7 — 2026-06-13 — Winner: **BASELINE**

**Scores:** baseline 4.56 → challenger 4.53

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.92 | 4.96 → |
| personalization | 4.16 | 3.96 ▼ -0.20 |
| product_quality | 4 | 4.12 ▲ +0.12 |
| tone | 4.96 | 4.88 ▼ -0.08 |
| language_match | 4.96 | 4.88 ▼ -0.08 |
| completeness | 4.36 | 4.36 → |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_015**: Sinhala script input — full Sinhala response required *(dims: product_quality: No products were suggested yet — the response only asked a clarifying question without offering any initial ideas or examples to help the user visualize options)*
  - **scenario_021_autobiography_relevance**: The agent mentions 'A Game of Thrones' in the autobiography recommendation context — even with 'aside', this introduces a fiction title inappropriately and fails the core task of filtering out non-autobiographies. *(dims: product_quality: 'A Game of Thrones' is a fiction novel, not an autobiography — mentioning it in the context of autobiographies is a critical error even though it was partially distanced with 'aside', relevance: The awkward phrasing 'A Game of Thrones aside' still introduces a fiction title into an autobiography recommendation, confusing the response, personalization: The agent uses 'he likes autobiographies' from the user's message but Roshan is the one asking — unclear pronoun handling, and age/gender context not leveraged, completeness: The response doesn't clarify why A Game of Thrones was mentioned or properly exclude it, leaving the user potentially confused)*

**What challenger targeted:**
  (not recorded)

**Outcome:** **Blocked by regression:** personalization: 4.16 → 3.96 (-0.20)

---

### Iteration 5 — 2026-06-13 — Winner: **BASELINE**

**Scores:** baseline 4.4 → challenger 4.41

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.76 | 4.84 ▲ +0.08 |
| personalization | 3.96 | 3.92 → |
| product_quality | 4 | 3.88 ▼ -0.12 |
| tone | 4.8 | 4.88 ▲ +0.08 |
| language_match | 4.76 | 4.88 ▲ +0.12 |
| completeness | 4.12 | 4.08 → |

**Baseline failed scenarios (what needed fixing):**
  - **scenario_007**: The response skips any clarifying question and immediately offers generic options, missing the crucial discovery step needed to give truly useful recommendations for a couple's anniversary. *(dims: completeness: Jumps straight to options without asking a single clarifying question (budget, parents' interests, age) — misses the discovery step entirely, product_quality: Photo frame is a single-person-leaning gift; no couple experience, dinner, or home item suggested; options feel generic rather than anniversary-specific, personalization: Uses name but ignores that Kasun is 23 — could acknowledge the relatable struggle of gift-hunting for parents at that age)*

**What challenger targeted:**
  (not recorded)

**Outcome:** **Blocked by regression:** product_quality: 4 → 3.88 (-0.12)

---

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
| 21 | 2026-06-16 | 4.42 | 4.22 | BASELINE | No-regression rule: scenario_003(4.67→3.33), scenario_007(4.17→3.67), scenario_0 |
| 20 | 2026-06-16 | 4.39 | 4.27 | BASELINE | product_quality: 3.83→4 |
| 19 | 2026-06-16 | 4.39 | 4.28 | BASELINE | product_quality: 3.88→4 |
| 18 | 2026-06-16 | 4.45 | 4.1 | BASELINE | No-regression rule: scenario_001(5→3.5), scenario_007(4.17→3.83), scenario_009(4 |
| 17 | 2026-06-16 | 4.45 | 4.24 | BASELINE | No-regression rule: scenario_004(4.33→3.67), scenario_007(4.17→3.83), scenario_0 |
| 16 | 2026-06-16 | 4.44 | 4.03 | BASELINE | No-regression rule: scenario_007(4.17→3.33), scenario_009(4.5→2.83), scenario_01 |
| 15 | 2026-06-16 | 4.45 | 4.31 | BASELINE | No-regression rule: scenario_009(4.5→2.67), scenario_010(4.67→3), scenario_011(4 |
| 14 | 2026-06-16 | 4.38 | 4.15 | BASELINE | No-regression rule: scenario_003(4.67→3.5), scenario_009(4.5→2.67), scenario_010 |
| 13 | 2026-06-16 | 4.5 | 4.12 | BASELINE | No-regression rule: scenario_004(4.17→3.17), scenario_009(4.5→2.67), scenario_01 |
| 12 | 2026-06-16 | 4.46 | 4.26 | BASELINE | No-regression rule: scenario_007(4.17→3.83), scenario_009(4.5→2.67), scenario_01 |
| 11 | 2026-06-13 | 4.45 | 4.37 | BASELINE | product_quality: 3.96 → 3.84 (-0.12) |
| 9 | 2026-06-13 | 4.55 | 4.49 | BASELINE | language_match: 4.72 → 4.88 (+0.16) |
| 7 | 2026-06-13 | 4.56 | 4.53 | BASELINE | product_quality: 4 → 4.12 (+0.12) |
| 5 | 2026-06-13 | 4.4 | 4.41 | BASELINE | language_match: 4.76 → 4.88 (+0.12) |
| 4 | 2026-06-10 | 4.19 | 4.5 | CHALLENGER | relevance: 4.75 → 5 (+0.25); personalization: 3.7 → 3.95 (+0.25) |
| 3 | 2026-06-10 | 4.12 | 4.29 | CHALLENGER | relevance: 4.55 → 4.8 (+0.25); tone: 4.7 → 4.9 (+0.20) |
| 2 | 2026-06-10 | 4.07 | 4.3 | BASELINE | relevance: 4.45 → 4.85 (+0.40); personalization: 3.6 → 3.75 (+0.15) |
| 1 | 2026-06-10 | 4.02 | 4.14 | BASELINE | challenger regressed product_quality (-0.20) despite improving personalization (+0.35), completeness (+0.40) |

## Weakest Dimensions Over Time
<!-- populated automatically -->
- **Run 21**: product_quality, personalization, completeness
- **Run 20**: product_quality, personalization, completeness
- **Run 19**: personalization, product_quality, completeness
- **Run 18**: personalization, product_quality, completeness
- **Run 17**: product_quality, personalization, completeness
- **Run 16**: product_quality, personalization, completeness
- **Run 15**: product_quality, personalization, completeness
- **Run 14**: personalization, product_quality, completeness
- **Run 13**: personalization, product_quality, completeness
- **Run 12**: product_quality, personalization, completeness- **Run 11**: personalization, product_quality, completeness
- **Run 9**: personalization, product_quality, completeness
- **Run 7**: product_quality, personalization, completeness
- **Run 5**: personalization, product_quality, completeness
- **Run 4**: product_quality, personalization, completeness
- **Run 3**: product_quality, completeness, personalization
- **Run 2**: product_quality, personalization, completeness

- **Run 1**: product_quality (3.45), completeness (3.45), personalization (3.55)

## LOOP STALLED — iteration 5 (2026-06-16) — 5 consecutive rejections before loop completed
