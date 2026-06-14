# Kapruka Agent — Full Direction Update & Implementation Plan

Read `index.html` (or the Next.js equivalent entry), `app.js` / `useChat.ts`, `style.css`, and `directives/system_prompt.md` fully before touching anything.

---

## Critical Context: What the Judges Actually Want

We received the official confirmation email from the Kapruka challenge team. It contains a direct signal about what wins. Read this carefully — it changes some priorities.

**Their exact words:**
> "The agents that win won't feel like a search box wearing a chat costume — they'll feel human, surprising, and genuinely helpful."

**The example they gave as the gold standard:**
> User: "I broke up with my girlfriend… I need to send some flowers."
> Agent: "Aiyo! 💔 Okay — here's the plan. I'll get the flowers to you, and you hand-deliver them to her. Trust me, that lands better than a courier. Shall I add a note card too?"

This tells us exactly what they are scoring on personality: read the emotional situation, have an opinion, give advice, add local Sri Lankan flavour, then handle the shopping. Not just product search + add to cart.

**The other critical line from the email:**
> "The majority of orders are people shopping for themselves, not sending gifts. Build for that reality: the everyday shopper buying for their own needs is your main user, with gifting as one important mode among many."

This means the current agent is too gifting-focused. It needs to be equally natural for someone saying "I need a new pair of earphones" or "add rice and dhal to my cart" as it is for someone sending a birthday gift.

---

## Current State (Already Fixed — Do Not Touch)

- Duplicate carousel fix: responseId guard in place, TS CLEAN
- Emotional language extraction: agent ignores venting, extracts shopping intent
- Tanglish: triggers on any Sri Lankan word in an otherwise-English message
- Sinhala: fully working — agent detects and responds in Sinhala script
- React 18 Strict Mode + GSAP: all gsap.from → gsap.fromTo + killTweensOf
- Timeout chain: MCP 6s, Claude 15s, client abort 22s
- Onboarding age validation: rejects non-numeric input

---

## Part 1 — System Prompt Overhaul

This is the highest priority change. The system prompt needs to reflect the new direction.

### 1A — Rebalance the agent's identity

The agent is currently framed around gifting. Rewrite the opening identity section to reflect this:

```
You are Karu — a warm, witty, genuinely helpful Sri Lankan shopping assistant for Kapruka, Sri Lanka's largest online platform.

Most people come to you for everyday shopping: electronics, groceries, fashion, home essentials, personal items. Some come to send gifts. You treat both equally naturally.

You read the room. If someone is stressed, you acknowledge it briefly and help. If someone is excited, match that energy. If someone says "I broke up with my girlfriend and need flowers", you say "Aiyo 💔 okay here's what we do..." and have an opinion on how to make it land.

You are NOT a search box. You are a knowledgeable friend who happens to know everything on Kapruka and can get it delivered anywhere in Sri Lanka.
```

### 1B — Everyday shopping mode

Add a section explicitly covering non-gifting flows:

```
EVERYDAY SHOPPING MODE

When a user is shopping for themselves (no mention of recipient, gift, or occasion):
- Do not ask "who is this for?" — they told you, it's for them
- Do not frame products as gifts
- Treat it like helping a friend find something they need
- Be opinionated: "The JBL ones are better value, trust me" is better than listing specs
- For groceries/essentials: be efficient, confirm quantity, move fast
- For electronics: ask one clarifying question max (budget or specific use case), then show cards
- For fashion/clothing: ask style preference or occasion in one line, then show cards

Examples of correct everyday shopping responses:
- "I need earphones under 5000" → "Okay, wireless or wired? Just that one thing and I'll pull the best options." → show cards
- "Add milk and bread to cart" → add both, confirm, ask if they need anything else
- "I want a good blender" → "For smoothies or heavy-duty cooking? Either way I've got you." → show cards after one answer
```

### 1C — Personality and opinion

Add this section:

```
PERSONALITY RULES

You are allowed — encouraged — to have opinions:
- "Honestly the chocolate hamper is the safer bet here"
- "For a 43-year-old who likes whisky, skip the chocolates — get him the premium tea set instead, it's more memorable"
- "That's actually a great price for what you're getting"

You read emotional context and respond to it briefly before shopping:
- Breakup: "Aiyo 💔 okay let's fix this..."
- Birthday stress: "Don't panic, we have time..."
- Lost and unsure: "No stress, tell me one thing about them and I'll handle the rest"

You never lecture. You never repeat yourself. You never say "Great choice!" or "Certainly!" — those are banned phrases.

Banned phrases (never use these):
- "Great choice!"
- "Certainly!"
- "Of course!"
- "I'd be happy to help"
- "As an AI assistant"
- Any variation of "I understand your frustration"
```

### 1D — Keep the VISUAL FIRST RULE

This must stay in the prompt:

```
VISUAL FIRST RULE

Never mention a product name or category in text without showing its card.
If you suggest a category → search it immediately → show cards.
If you name a product → show its card.
Text-only responses are only acceptable for: onboarding questions, address collection, gift message collection, checkout confirmation, and pure emotional responses with no product mention.
```

### 1E — Keep DELIVERY HARD RULE

Never assume Colombo or any city. Always say "once we confirm your location" until the user tells you their city.

---

## Part 2 — Four Pending Bug Fixes

These were written earlier and have not been applied yet. Apply all four now.

### BUG 1 — Agent assumes Colombo delivery without asking

In `directives/system_prompt.md`, find the delivery section. Replace with:

```
DELIVERY — ABSOLUTE HARD RULE

NEVER mention a specific delivery city unless the user has explicitly stated that city in THIS conversation.
When showing products: "delivers in 1–2 days once we confirm your location"
Exception: if the user has already told you their city earlier in this conversation, use it.
This rule overrides everything else.
```

### BUG 2 — Agent shows text instead of cards when mentioning products

Already covered by VISUAL FIRST RULE above. Confirm it is in the prompt and is the first section the agent reads.

### BUG 3 — Previous product card rows collapse when new message arrives

In `style.css`:
- Carousel wrapper: add `min-height: 400px` and `flex-shrink: 0`
- Individual card: add `flex-shrink: 0`
- Card image container: `height: 220px`, `min-height: 220px`, `flex-shrink: 0`

### BUG 4 — Cards trapped in internal scroll, page scroll breaks

In `style.css`, find all carousel/card container overflow rules:
- Carousel: `overflow-x: auto`, `overflow-y: visible`, `scroll-snap-type: x mandatory`
- Messages container: `overflow-y: auto`, `overflow-x: visible` — never `overflow-x: hidden`
- Each card: `min-width: 220px`, `max-width: 220px`, `flex-shrink: 0`, `scroll-snap-align: start`

---

## Part 3 — New Features to Implement

Implement these in order. Each one is independent.

### FEATURE 1 — Delivery Feasibility Card (implement first — quickest win)

**What:** When the MCP delivery quote tool is called, render a visual card instead of just text.

**Signal from Claude:** After calling the delivery quote tool, Claude appends this JSON to its response (stripped before display):
```json
{"__delivery": {"destination": "Colombo 07", "available": true, "date": "2026-06-14", "method": "Standard", "cost": 350}}
```

**UI:** A compact dark card inside the chat:
- Row 1: 📍 Sending to: [destination]
- Row 2: ✅ Estimated delivery: [date] (or ❌ Not available)
- Row 3: 🚚 [method] — Rs [cost]
- GSAP: slides up from below the message, power2.out

**System prompt addition:**
```
DELIVERY CARD SIGNAL
After every delivery quote tool call, append this exact JSON at the end of your response (after all text):
{"__delivery": {"destination": "[city user stated]", "available": [true/false], "date": "[human readable date]", "method": "[Standard/Express]", "cost": [number]}}
```

**Parser:** `parseSignals(text)` in the frontend strips `{"__delivery": ...}` from visible text and triggers `renderDeliveryCard(data)`.

---

### FEATURE 2 — Gift Card Generator

**What:** After add-to-cart on a product that seems like a gift (recipient mentioned, occasion mentioned, or user confirms it's a gift), agent offers to write a personalised message card.

**Signal from Claude:**
```json
{"__giftcard": {"to": "Amma", "from": "Chehan", "message": "Wishing you a wonderful birthday..."}}
```

**UI:** A styled card component in the chat:
- Parchment-warm background (`#fdf6e3`), dark text
- Recipient name at top in a handwriting font (Caveat or Kalam — load via Google Fonts CDN)
- Message body in a `contenteditable` div — user can edit inline
- "Include with order" button below
- GSAP: 3D rotateY from 90deg to 0deg on appear

**Behaviour:**
- Edited message updates cart state `giftMessage` field
- At checkout, gift message passed to MCP order creation call
- Only triggers for gifting context — not for self-shopping

**System prompt addition:**
```
GIFT CARD SIGNAL
When the user adds a product to cart AND there is a named recipient or occasion in the conversation, append this JSON at the end of your response:
{"__giftcard": {"to": "[recipient name or 'them']", "from": "[user's name from onboarding]", "message": "[warm 2-sentence message matching the occasion and relationship]"}}
Only trigger once per cart session, not on every add.
```

---

### FEATURE 3 — Occasion Countdown Timer

**What:** When the user mentions a specific date or named occasion, show a live countdown pill.

**Signal from Claude:**
```json
{"__occasion": {"label": "Birthday", "date": "2026-06-14"}}
```

**UI:** Small pill near the top of chat — `🎂 Birthday in 2 days, 14 hours`. Ticks every second via `setInterval`. GSAP slides it down from the header on appear. Only one active at a time — replace if a new one is detected.

**System prompt addition:**
```
OCCASION SIGNAL
When the user mentions a specific date or named occasion (birthday, anniversary, Vesak, Christmas, etc.), resolve it to an absolute date and append:
{"__occasion": {"label": "[occasion name]", "date": "[YYYY-MM-DD]"}}
Today's date is [inject current date here at runtime]. Resolve relative dates like "day after tomorrow" to absolute dates.
Only emit this once per occasion mention, not repeatedly.
```

**Frontend:** Inject today's date into the system prompt at request time in `api/chat/route.ts` — replace a `[TODAY]` placeholder with `new Date().toISOString().split('T')[0]`.

---

### FEATURE 4 — Category Mood Board

**What:** When the user says they don't know what they want or asks what's available, show a visual grid of Kapruka's categories before searching.

**Signal from Claude:**
```json
{"__categories": true}
```

**UI:** 3×3 or 4×3 grid of category cards inside the chat. Each card: emoji + label. Categories: Cakes 🎂, Flowers 💐, Chocolates 🍫, Clothing 👗, Electronics 📱, Grocery 🛒, Hampers 🎁, Jewellery 💍, Cosmetics 💄, Home & Living 🏠, Toys 🧸, Books 📚. Clicking a card calls `sendMessage("Show me " + category)` programmatically. GSAP: stagger in from opacity 0, total under 400ms.

**System prompt addition:**
```
CATEGORY BOARD SIGNAL
When the user expresses uncertainty about what to buy, has no specific product or category in mind, or asks "what do you have" / "show me options", append:
{"__categories": true}
Then follow up with a one-line invitation to tap a category.
```

---

### FEATURE 5 — Shareable Order Summary Card

**What:** At checkout confirmation, render a styled summary card the user could screenshot.

**Signal from Claude:**
```json
{"__summary": {"recipient": "Amma", "items": [{"name": "...", "price": 1200, "image": "..."}], "total": 4550, "deliveryDate": "June 14", "message": "Happy Birthday..."}}
```

**UI:** Full-width card, warm dark gradient, white text. Recipient name at top. Product thumbnails in a horizontal row (scroll if more than 3). Total, delivery date, gift message preview if present. Kapruka logo bottom right at low opacity. GSAP: rises from below with power2.out, scale 0.95 → 1.

---

## Part 4 — Signal Parser Architecture

All features above depend on a single `parseSignals(text)` function. Build this first and test it before wiring up individual features.

```typescript
interface Signals {
  delivery?: { destination: string; available: boolean; date: string; method: string; cost: number };
  giftcard?: { to: string; from: string; message: string };
  occasion?: { label: string; date: string };
  categories?: boolean;
  summary?: { recipient: string; items: any[]; total: number; deliveryDate: string; message?: string };
}

function parseSignals(text: string): { cleanText: string; signals: Signals } {
  const signals: Signals = {};
  let cleanText = text;

  const signalPattern = /\{\"__(delivery|giftcard|occasion|categories|summary)\"[\s\S]*?\}(?=\s*$|\s*\{)/g;
  // Extract all JSON blocks starting with __
  // Strip them from cleanText
  // Parse each one into signals object
  // Return both

  return { cleanText, signals };
}
```

Call this in the frontend after every assistant message. Pass `cleanText` to the message bubble renderer. Pass `signals` to the appropriate card renderers.

---

## Part 5 — Self-Shopping Flows to Test

After all changes, test these specific flows that the judges will likely run:

1. **Everyday self-shopping:** "I need earphones under Rs 5000" → agent asks wireless/wired → shows cards → no gifting framing
2. **Grocery run:** "I want to buy rice, coconut oil and green tea" → agent adds all three, confirms, asks if there's anything else
3. **Emotional gifting:** "I broke up with my girlfriend, need flowers" → agent responds with personality + local flavour → shows flowers → offers note card
4. **Sinhala self-shopping:** "මට ගෙදරට ෆ්‍රිජ් එකක් ගන්න ඕනෙ" → agent responds in Sinhala → shows refrigerators
5. **Tanglish gifting:** "Machang I need something nice for my amma la, her birthday is tomorrow" → Tanglish response → occasion countdown appears → gift card offered after add to cart
6. **Delivery check:** User states city → agent calls delivery quote → delivery feasibility card renders
7. **Category discovery:** "I don't know what to get" → category mood board appears

---

## After All Changes

Run `npx tsc --noEmit` — must be TS CLEAN.

Run the full verification sequence:
1. All 7 test flows above pass
2. No Colombo assumed unprompted
3. Product cards appear whenever a product/category is mentioned
4. Previous card rows stay full height when new messages arrive
5. Page scrolls vertically, card rows scroll horizontally, independently
6. parseSignals strips all JSON signals from visible chat text
7. Delivery card renders when delivery quote is called
8. Occasion pill appears and counts down when date is mentioned
9. Gift card renders after add-to-cart in a gifting context
10. Category board appears on discovery intent

Commit message: `feat: self-shopping mode, personality overhaul, signal parser, delivery/gift/occasion/category features`

Push to Vercel after commit. Test the live URL — not just localhost.
