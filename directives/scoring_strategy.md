# Directive: Scoring Strategy

## The Rubric

| Criteria | Points | Our Strategy |
|---|---|---|
| Experience & polish | 30 | GSAP animations, dark premium UI, smooth interactions |
| Visual richness | 20 | Large product images, carousels, cards, never a wall of text |
| Personality | 15 | Warm voice, uses user's name, speaks their language |
| Usefulness | 15 | Onboarding personalizes everything, gifting intelligence |
| End-to-end completeness | 15 | Full flow: discovery → cart → delivery → checkout |
| Creativity | 5 | Voice output, auto-improving prompt loop, demographic personalization |

**Total: 100 points**

## Bonus Points Strategy

These are explicitly called out by the judges. Hit all of them.

**Multi-item cart (easy)**
- User can say "add the cake and the flowers"
- Cart persists across the conversation
- Cart UI shows all items with running total

**Delivery date constraints (medium)**
- User says "needs to arrive before Sunday" or "by Vesak"
- Agent uses MCP delivery quote tool to check feasibility
- Filters out options that cannot meet the deadline
- Confirms delivery date before checkout

**Gift messaging (easy)**
- At checkout, agent asks "Would you like to include a message?"
- Free text, passed through to the order
- Displayed on a card with the delivery

**Tanglish conversation (easy)**
- Claude handles this natively — no special code needed
- Just instruct in system prompt to match the user's language style
- If user writes in Tanglish, respond in Tanglish

**Sinhala language support (hard — but worth it)**
- Explicitly called out by judges as something almost no one will attempt
- Claude supports Sinhala
- Detect if user writes in Sinhala script, respond in Sinhala
- System prompt instructs: match the language the user is writing in
- Even partial Sinhala support will stand out

## Where 50 Points Are Won Or Lost

Experience & polish (30) + Visual richness (20) = 50 points on how it looks and feels.

This means the visual build is more important than any backend cleverness. A beautifully animated, responsive, product-rich UI that feels alive will outscore a technically impressive but visually mediocre agent every time.

**Specific things that move the polish score:**
- GSAP entrance animations on every message and product card
- Smooth cart slide-in when items are added
- Voice output that makes the agent feel alive
- Product images that are large, clear, and attractive
- Consistent visual language throughout
- No layout shifts, no janky transitions, no broken states
- Mobile works perfectly

## Submission Notes

When writing the submission, explicitly mention:
1. Voice-enabled via Web Speech API
2. Demographic onboarding for personalization
3. First-party data value for Kapruka's business intelligence
4. Sinhala and Tanglish support
5. Autonomous prompt refinement loop (autoresearch methodology)
6. Full end-to-end flow including gift messaging and delivery date constraints

The submission should tell a story — not just list features. Show that you understand Kapruka's business and built something that serves their customers AND their business interests.
