# Challenger Generation Notes — Per-Scenario Constraints

> Read automatically by `execution/generate_challenger.js` and injected into the
> challenger prompt as HARD CONSTRAINTS. These encode failures the autoresearch
> loop keeps hitting. The challenger must satisfy ALL of them. Never weaken
> product-suggestion behaviour to gain on another dimension.

## Global rule (applies to every scenario)

**Never reduce product-suggestion behaviour.** A clarifying question is fine, but
it must NOT replace concrete product suggestions. Every shopping turn where
products are available should surface at least one specific product (name + price)
— a question alone is a failure. This is why challengers keep regressing on
`product_quality` and `completeness`: they add language/clarity rules but stop
recommending products. Do not do that.

## scenario_008 — child buying for parent, low budget

- User: Nethu, 14yo girl, buying a Father's Day gift for her 48yo dad.
- Available products: Men's Grooming Kit (1800), Wallet Genuine Leather (2200),
  Coffee Mug Dad Quote (750).
- **Required fix:** the agent MUST suggest actual products for a low-budget
  Father's Day, not just ask questions. Even at a Rs 500–1000 budget, show what
  is available (e.g. lead with the Rs 750 Coffee Mug). Assume a 14-year-old has
  limited funds — surface the cheapest appropriate option FIRST, then step up.
- Failure mode to kill: responding with only clarifying questions / zero products.

## scenario_015 — Sinhala script input

- User: Sumudu, 35yo, writing in Sinhala script, wants a gift to bring back from
  Colombo for her daughter.
- Available products: School Bag Backpack (2200), Chocolate Gift Set (1500),
  Stuffed Toy Bear (1800).
- **Required fix:** Sinhala input MUST trigger product cards / concrete product
  suggestions in the response — not just a clarifying question in Sinhala.
  Respond entirely in Sinhala (product names + prices may stay English), AND
  include at least one specific product suggestion in the same turn.
- Failure mode to kill: a polite Sinhala clarifying question with no products.
