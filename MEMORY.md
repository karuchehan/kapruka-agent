# Kapruka Agent — Session Memory Log

> Append after every commit/push. Log exact steps taken, exact mistakes made, and what was learned. This is the ground truth of what happened.

---

## Session 001 — 2026-06-09

### What We Did
- Read and digested all planning directives: `project_overview.md`, `agent_concept.md`, `tech_stack.md`, `ui_design.md`, `system_prompt.md`, `onboarding_flow.md`, `scoring_strategy.md`, `autoresearch_loop.md`, `deployment.md`
- Confirmed Anthropic API key is available
- Established session rules (see Rules section below)

### Gaps Identified
- No code exists yet — `index.html`, `style.css`, `app.js`, `api/chat.js` all need to be written
- Model ID in `deployment.md` references `claude-sonnet-4-20250514` — correct current ID is `claude-sonnet-4-6`
- MCP integration syntax in Anthropic SDK needs verification before building `api/chat.js`
- Directory structure in `CLAUDE.md` references `/directives/` but markdown files live directly in project root

### Mistakes / Lessons
- None yet — this is the orientation session

### Next Steps
- Verify Kapruka MCP server tools and schema
- Verify current Anthropic SDK MCP integration syntax
- Build in order: `api/chat.js` → `index.html` → `style.css` → `app.js`

---

## Session 002 — 2026-06-09 (Planning Session)

### What We Did
- Organized repo: created `directives/`, `execution/`, `api/`, `.tmp/` folders
- Moved all 9 planning markdowns into `directives/`
- Created `.gitignore`, `.env.example`, `execution/test_scenarios.json` (14 scenarios pre-loaded)
- Created `MEMORY.md` (this file) in project root
- Updated `CLAUDE.md` with Hard Rules section (API key confirmation + memory logging)
- Saved feedback memories to Claude auto-memory system
- Researched Kapruka MCP server — confirmed 7 tools (see below)
- Researched Anthropic SDK MCP integration syntax
- Created full 8-phase build plan at `.claude/plans/glistening-puzzling-spindle.md`
- Remote control attempt failed: disabled by org policy

### Kapruka MCP Tools Confirmed
| Tool | Purpose |
|---|---|
| `kapruka_search_products` | Search by keyword, category, price range |
| `kapruka_get_product` | Full product details by ID |
| `kapruka_list_categories` | Top-level categories |
| `kapruka_list_delivery_cities` | Delivery location search |
| `kapruka_check_delivery` | Delivery feasibility + cost |
| `kapruka_create_order` | Guest checkout → pay link (60-min price lock) |
| `kapruka_track_order` | Order status by order number |

Rate limits: 60 req/min per IP, 30 orders/hour per IP. No auth needed.

### Build Plan (8 Phases)
1. **Phase 0** — Verify Anthropic SDK `mcp_servers` syntax from docs (no API call — just reading)
2. **Phase 1** — `api/chat.js`: serverless backend, Anthropic + MCP, returns `{ message, products, checkoutUrl }`
3. **Phase 2** — `index.html`: structure only (onboarding screen, chat screen, cart panel, voice toggle)
4. **Phase 3** — `style.css`: dark premium UI, Kapruka red accent, product cards, GSAP-ready
5. **Phase 4** — `app.js`: state management, onboarding flow, send/receive messages, product cards, cart, voice (Web Speech API), GSAP animations
6. **Phase 5** — Local test via `vercel dev`
7. **Phase 6** — Git + GitHub + Vercel deploy, get live URL
8. **Phase 7** — `execution/run_autoresearch.js`: test runner against 14 scenarios, score responses, improve system prompt
9. **Phase 8** — Polish, hit all 5 bonus points, submission

### Key Technical Decisions Made
- **Stack**: vanilla HTML/CSS/JS + single `/api/chat.js` Vercel serverless function — no frameworks
- **Model**: `claude-sonnet-4-6` (not `claude-sonnet-4-20250514` — that ID is outdated)
- **MCP approach**: `messages.create()` with `mcp_servers` beta param + manual agentic loop fallback
- **Product data extraction**: Claude outputs `[PRODUCTS]{...}[/PRODUCTS]` block; backend parses it; frontend renders cards
- **State**: stateless backend — frontend sends full message history each request
- **Voice**: Web Speech API SpeechSynthesis, enabled by default, toggleable, persisted in localStorage
- **Onboarding**: 3 hardcoded exchanges (name/age/gender) before any API call

### Gaps / Unknowns
- Anthropic SDK `mcp_servers` parameter exact syntax not yet verified — must check docs before writing `api/chat.js`
- Whether `betas: ["mcp-client-2025-04-04"]` handles full agentic loop automatically or requires manual tool_use handling
- GitHub repo not yet created
- Vercel project not yet linked
- `.env` with `ANTHROPIC_API_KEY` not yet created (user must confirm before any API call)

### Mistakes / Lessons
- `CLAUDE.md` file structure section referenced `/directives/` subfolder but files were in root — fixed during org step

### Next Steps (When New Session Starts)
1. Read this MEMORY.md for full context
2. Read `CLAUDE.md` for hard rules
3. Phase 0: verify SDK MCP syntax (no API call needed)
4. Phase 1: write `api/chat.js`
5. Then UI phases in order

---

## Session 003 — 2026-06-09 (Build Session)

### What We Did
- **Phase 0** — Verified MCP SDK syntax from TypeScript skill docs. Key finding: use `client.beta.messages.create()` with `betas: ["mcp-client-2025-11-20"]` and `mcp_servers: [{type:"url", name:"kapruka", url:"https://mcp.kapruka.com/mcp"}]`. Beta header was `mcp-client-2025-04-04` in the plan — corrected to `mcp-client-2025-11-20`. Anthropic API handles MCP tool execution server-side; no manual agentic loop needed.
- **Phase 1** — `api/chat.js` written. Reads system prompt from `directives/system_prompt.md`, injects user/recipient profile, calls `client.beta.messages.create()` with MCP server, parses `[PRODUCTS]{...}[/PRODUCTS]` and `[CHECKOUT_URL]...[/CHECKOUT_URL]` blocks, returns `{message, products, checkoutUrl}`.
- **package.json** — Created with `"type":"module"` and `@anthropic-ai/sdk` dep. `npm install` ran successfully.
- **Phase 2** — `index.html` written. Sections: `#onboarding-screen`, `#chat-screen` (header + `#messages-container` + `#input-area`), `#cart-overlay`, `#cart-panel`. GSAP CDN included.
- **Phase 3** — `style.css` written. CSS custom properties, dark premium palette, animated dot grid background, product carousels, skeleton loading, cart panel, mobile-first responsive.
- **Phase 4** — `app.js` written. Animated canvas background (dot grid wave), onboarding state machine (3 steps), chat send/receive, skeleton + typing indicator, product card carousel rendering, voice (Web Speech API), cart add/remove/total, GSAP animations throughout.
- **vercel.json** — Created minimal rewrite config for `/api/*` routing.
- **Phase 7** — `execution/run_autoresearch.js` written. Loads 14 scenarios, calls `/api/chat` for each, scores on 6 dimensions (relevance/personalization/product_quality/tone/language_match/completeness), outputs pass/weak/fail summary + dimension bar chart + saves JSON to `execution/results/`.
- **git init** + initial commit `33ad70a` — 22 files, 3146 insertions.

### Key Technical Decisions Made This Session
- MCP beta header: `mcp-client-2025-11-20` (not `mcp-client-2025-04-04` as originally planned)
- No manual agentic loop — Anthropic handles MCP server-side
- Canvas background: procedural dot grid with sine wave animation, no external lib needed
- Autoresearch scoring: heuristic (no extra API call for scoring) — keyword + structure analysis

### Gaps / What Still Needs Doing
- `.env` file not created — needs `ANTHROPIC_API_KEY` from user
- Phase 5 (local test via `vercel dev`) blocked until API key added
- GitHub repo not created yet — no remote set
- Vercel deployment not done yet
- Autoresearch not run yet — needs live endpoint

### Mistakes / Lessons
- No mistakes this session — clean build from plan

### Next Steps
1. User provides `ANTHROPIC_API_KEY` → create `.env`
2. `npm install -g vercel` if not installed → `vercel dev`
3. Manual test: onboarding → chat → products → cart → voice → mobile
4. Fix any bugs found
5. `git remote add origin <github-url>` → push
6. Deploy to Vercel, add env var in dashboard
7. `node execution/run_autoresearch.js --url <vercel-url>`
8. Fix weak scenarios in `directives/system_prompt.md`

---

## Session 004 — 2026-06-09 (Stabilisation Session)

### What We Did
- **Architecture shift**: Moved from Claude+MCP (slow, unreliable) to Python-first pipeline.
  - Python script `execution/tools/kapruka_mcp.py` calls MCP directly, returns structured JSON
  - Python always returns top-4 products — Claude never determines the products array
  - Claude gets slim product list (name + price only, no image URLs) to keep tokens low
  - Claude only writes 1–2 warm sentences; hard cap via server-side sentence truncation
- **Multi-turn context**: `buildSearchQuery()` now scans last 3 user messages, deduplicates keywords
- **Fallback search**: If composite query returns <2 products, retry with last-message keywords only
- **Price normalisation**: MCP returns `price: {amount: 5330, currency: "LKR"}` (object not number) — `normaliseProduct()` now handles both shapes
- **System prompt rewrite** (`directives/system_prompt.md` v2.0): removed "You have access to MCP tools" (false since Python handles this), moved output rules first, hard 2-sentence limit
- **CLI test harness** (`execution/quick_test.js`): 5 tests, all 5 green after fixes
- **dev-server.js** added: replaces `vercel dev` (had recursive invocation error in this environment). Serves static files + proxies `/api/chat`. Port 3002.
- Committed `e423a1d` → pushed to `karuchehan/kapruka-agent`

### Bugs Fixed This Session
| Bug | Root Cause | Fix |
|---|---|---|
| Claude writing 400+ chars | Prompt alone insufficient | Server-side `truncateToSentences(2)` post-processes every response |
| Product count < 2 sometimes | Composite query too specific | Fallback search with last-message-only keywords |
| Product integrity: id/name/price missing | MCP `price` field is `{amount,currency}` object | `normaliseProduct()` unwraps price object |
| Multi-turn: "sports" + "football" not combining | extractKeywords only scanned last 1 message | `buildSearchQuery()` scans last 3, deduplicates |

### Quick Test Results (all 5/5 green)
1. single-word search → PASS
2. natural language gift request → PASS
3. multi-turn context: sports → football → PASS
4. product integrity (id + name + price) → PASS
5. no error field on valid request → PASS

### Next Steps
1. Open browser for visual verification: onboarding → product search → product cards visible
2. Run autoresearch loop (`execution/run_autoresearch.js`) — needs API key approval
3. Deploy to Vercel

---

## Session 005 — 2026-06-10 (Autoresearch Loop)

### What We Did
- Identified root cause of "planting → planners" bug: Kapruka MCP search returns irrelevant results for some keywords. No fix possible without better category metadata — documented.
- Fixed critical system prompt bug: MODE A said "Do NOT list products in text — they appear as cards automatically." This caused Claude to write teasers with no product names. Fixed to: name products by their actual name and price in the response text.
- Built complete 7-file autoresearch loop (Karpathy-style):
  - `execution/test_scenarios.json` — 20 scenarios covering all edge cases
  - `execution/score_response.js` — second Claude call as judge (6 dimensions, 1-5 strict scoring)
  - `execution/run_tests.js` — SDK-direct test runner, injects simulated products per scenario
  - `execution/generate_challenger.js` — reads failures + resources.md, generates targeted improved prompt
  - `execution/compare_and_promote.js` — promotes challenger only if higher avg AND no regressions
  - `execution/resources.md` — auto-updated learnings log
  - `execution/orchestrator.js` — one command, full iteration
- Fixed bug in generate_challenger.js: looked for `baseline_*` files but initial run saves as `run_*`
- Ran full Iteration 1: baseline 4.02, challenger 4.14 → **BASELINE HOLDS** (challenger regressed product_quality 3.45→3.25 despite improving personalization +0.35, completeness +0.40)
- Committed `9056d6f` → pushed to karuchehan/kapruka-agent

### Autoresearch Iteration 1 Results
| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.55 | 4.65 ✓ |
| personalization | 3.55 | 3.90 ✓ |
| product_quality | 3.45 | 3.25 ✗ REGRESSION |
| tone | — | — |
| language_match | — | — |
| completeness | 3.45 | 3.85 ✓ |

### Remaining Failure Patterns (from results)
1. **Tanglish (scenarios 014, 016)**: Agent responds in formal English when user writes in casual Sri Lankan mixed style. Both baseline and challenger fail this consistently. `language_match` is a persistent weak dimension.
2. **Delivery scenarios (009, 010)**: Agent either overpromises same-day delivery or fails to ask for the delivery city before confirming.
3. **product_quality (3.25–3.45)**: Still weakest dimension — simulated products sometimes not matched to user need.

### Mistakes / Lessons
- `MODE A: "Do NOT list products"` was the biggest UX bug — caused all the "showing nothing" complaints
- Challenger promotion requires ZERO regressions — even one dimension drop kills promotion. This is correct behaviour but means incremental gains are harder.
- The test runner run prefix (`run_*`) vs compare prefix (`baseline_*`) mismatch — fixed.

### Next Steps
1. Run `node execution/orchestrator.js` again targeting Tanglish + delivery scenarios
2. Manually strengthen Tanglish rules in system prompt before next iteration
3. Deploy to Vercel

---

## Session 006 — 2026-06-10 (Autoresearch Iteration 2)

### What We Did
- Ran full autoresearch iteration 2: baseline 4.11 (initial) → 4.07 (comparison run), challenger 4.30
- **BASELINE HOLDS** — challenger regressed product_quality 3.55→3.40 despite massive gains in completeness (+0.55), relevance (+0.40), language_match (+0.25)
- Committed iteration 2 results (execution/results/, execution/resources.md)

### Autoresearch Iteration 2 Results
| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.45 | 4.85 ▲ |
| personalization | 3.60 | 3.75 ▲ |
| product_quality | 3.55 | 3.40 ▼ REGRESSION |
| tone | 4.60 | 4.75 ▲ |
| language_match | 4.65 | 4.90 ▲ |
| completeness | 3.60 | 4.15 ▲ |

### Remaining Failures (4 scenarios)
1. **scenario_005**: Rushes to products for gifting without asking occasion/budget/preferences
2. **scenario_007**: Shows products immediately despite "I have no idea what to get"
3. **scenario_009**: Asks for city (correct rule working) but response cold — ignores Sunday urgency, no warmth
4. **scenario_010**: Avoids answering Kandy same-day feasibility, deflects to sub-area clarification

### Second-Layer Patterns (new this iteration)
- **Delivery responses are correct but cold** — the DELIVERY rule made Claude ask for city but the judge penalizes abruptness. Fix: acknowledge urgency warmly, THEN ask for city.
- **Budget overflow** — scenario_003 still suggests combos over stated budget (Rs. 400 → Rs. 6,800 combo suggested)
- **Single-question rule violated** — challenger asked two questions in one sentence (scenario_004)
- **Structural tension (2 iterations in a row)** — qualification rules improve completeness but always hurt product_quality. Root cause: rules apply to all searches, not just gifting. Next iteration must scope to GIFTING ONLY.

### Mistakes / Lessons
- "Do not repeat" confirmed: adding MORE qualification rules to fix gifting scenarios breaks self-shopping scenarios — Claude becomes too cautious
- Challenger changes were too broad this iteration (applied gifting qualification rules globally)
- product_quality regression pattern: 2 iterations in a row blocked at the same wall

### Next Steps (Iteration 3)
1. Manually patch system_prompt.md before generating challenger:
   - Delivery section: add warmth instruction ("acknowledge urgency first, then ask for city")
   - Add BUDGET HARD RULE scoped to gifting only
   - Scope all qualification rules to "IF gifting context detected" — not all searches
2. Run iteration 3: `node execution/orchestrator.js`
3. Target: break product_quality regression pattern

---

## Session 007 — 2026-06-10 (Autoresearch Iteration 3 — First Promotion)

### What We Did
- Applied v4.0 manual patches to system_prompt.md before running iteration 3
- Kicked off iteration 3: **CHALLENGER PROMOTED** (first promotion after 2 blocked iterations)
- Committed all results and MEMORY.md

### Autoresearch Iteration 3 Results
| Dimension | Baseline | Challenger |
|---|---|---|
| relevance | 4.55 | 4.80 ▲ |
| personalization | 3.70 | 3.75 → |
| product_quality | 3.45 | 3.45 → (NO REGRESSION) |
| tone | 4.70 | 4.90 ▲ |
| language_match | 4.70 | 4.85 ▲ |
| completeness | 3.60 | 4.00 ▲ |

**Winner: CHALLENGER (4.29 vs 4.12 baseline)**

### What The Challenger Fixed
- **scenario_004** ✓: Now correctly asks one warm clarifying question (who/occasion) instead of dumping random products
- **scenario_007** ✓: Now asks discovery question for "I have no idea" gifting signals before showing products
- **scenario_015** ✓: Sinhala script input now handled properly (language_match improved)
- Added VAGUE REQUESTS section: ambiguous requests with no context → ask ONE question before showing products
- Added GIFTING WITH NO IDEA sub-section: uncertainty signals → ask before showing
- Added age/gender demographic mapping (explicit: 45yo male → home audio/TV/laptop, NOT fitness trackers)
- Rewired SAME-DAY DELIVERY rule: honest answer about Kandy feasibility BEFORE sub-area questions

### What The Manual Patches Unlocked
The v4.0 patches (MODE B scoped to GIFTING ONLY, delivery warmth, budget rule) gave the loop a clean foundation. The loop then correctly identified that scenario_004/007 needed a VAGUE REQUESTS section and rewired the delivery rule without triggering product_quality regression. The structural tension was resolved by scoping.

### Remaining Failures (4 scenarios in new v5 baseline)
1. **scenario_005**: Still rushes to products for gifting without qualifying occasion/preferences (completeness)
2. **scenario_009**: Delivery warmth not quite calibrated — still not acknowledging Sunday feasibility properly
3. **scenario_010**: Kandy same-day now too abrupt — correct to say not available but not mentioning which categories (flowers/cakes) might have faster options
4. **scenario_011**: London caller, Colombo recipient, Vesak — persistent failure (completeness), unknown exact cause

### Next Steps (Iteration 4)
1. Run iteration 4 immediately: `node execution/orchestrator.js`
2. Loop now has clean baseline — let it target product_quality + personalization
3. Scenario_011 needs investigation: read the specific failure reason more carefully

---

## Session 008 — 2026-06-10 (Task 1: Scroll Fix)

### What We Did
- Read all 5 required files: `index.html`, `app.js`, `style.css`, `directives/ui_design.md`, `directives/system_prompt.md`
- Diagnosed scroll cutoff bug in `style.css`: `#messages-container` had `padding: 24px 20px 120px` but Chrome/Safari ignore `padding-bottom` on flex containers with `overflow-y: auto` — the padding exists in CSS but the browser clips it when calculating scrollable area
- **Fix applied**: Replaced `padding: 24px 20px 120px` with `padding: 24px 20px 0` + added `#messages-container::after { content: ''; display: block; min-height: 120px; flex-shrink: 0; }` — the `::after` behaves as a real flex item so scrollHeight counts it correctly
- Mobile override added: `#messages-container::after { min-height: 140px; }` inside `@media (max-width: 600px)`
- Confirmed JS already correct: `scrollToBottom()` uses double rAF + `$msgs.scrollTop = $msgs.scrollHeight`. `addProductCards()` already calls `scrollToBottom()` after append.
- Committed `931e329` → pushed to `karuchehan/kapruka-agent`

### Gaps Identified
- Visual verification (vercel dev + browser) cannot be done from CLI — user should verify the fix manually per the 6 checks in the task spec
- Tasks 2 (Kapruka reskin) and 3 (visual autoresearch loop) still pending

### Mistakes / Lessons
- The flex overflow padding-bottom bug: CSS `padding-bottom` on a `display: flex; overflow-y: auto` container is silently clipped in Chrome/Safari. The `::after` pseudo-element fix is the correct cross-browser workaround.

### Next Steps
1. User verify scroll fix: `vercel dev`, ask for birthday gifts, confirm cards visible, test at 375px width
2. Start Task 2: Kapruka UI reskin

---

## Session 009 — 2026-06-10 (Task 2: Kapruka UI Reskin)

### What We Did
- Fetched kapruka.com for brand reference — confirmed red accent, light site background (our dark theme is intentional departure)
- Applied 20 targeted changes across `style.css` and `app.js`

**CSS changes (`style.css`):**
- Warmer dark palette: `--bg-primary: #0d0a0a`, `--bg-secondary: #141010`, `--bg-card: #1c1717`, `--bg-input: #231c1c`
- Brand name `.brand-name` → `color: var(--accent)` (red wordmark instead of white)
- Message bubbles: padding `14px 18px`, radius `18px` with flat corner on conversation side
- User bubbles: full solid red background + white text (was ghost/translucent)
- Product card `.product-card:hover`: box-shadow `0 8px 28px rgba(0,0,0,0.35)` (removed CSS transform — GSAP handles it)
- Product card name: `font-weight: 600` (was 500)
- "Add to Cart" button: full red fill with white text (was ghost outline)
- Typing dots: CSS `dot-bounce` animation removed, changed color to `--accent`, added `transform-origin: center bottom` for GSAP
- Input inner radius: `radius-md` (14px) instead of `radius-lg` (20px) — less pill-shaped
- Mic button: accent red border + icon by default (was gray)
- Cart panel: removed CSS `transition` — GSAP handles animation

**JS changes (`app.js`):**
- Init: `gsap.from(document.body, { opacity: 0, duration: 0.5 })` — page load fade
- `showTyping()`: GSAP `scaleY: 1.7, stagger: 0.15` bounce on red dots (3 dots created programmatically)
- `removeTyping()`: `gsap.killTweensOf(el.querySelectorAll("span"))` before DOM removal
- `addProductCards()`: mouseenter/mouseleave GSAP `y: -4` hover lift on every card
- Product card stagger: `y: 16, stagger: 0.07, duration: 0.4` (tighter than before)
- `addMessage()`: entrance `y: 12, duration: 0.3` (was `y: 16, 0.4`) — snappier
- `openCart()`: `gsap.fromTo($cartPanel, { x: '100%' }, { x: '0%', duration: 0.35, ease: 'power3.out' })`
- `closeCart()`: `gsap.to($cartPanel, { x: '100%', 0.3s power3.in, onComplete: remove class })`

- Verified all 20 changes with automated node check — all pass
- Committed `562ee3a` → pushed to `karuchehan/kapruka-agent`

### Gaps / Visual Verification Needed
- Visual check still needed: `vercel dev`, onboarding screenshot, product cards, mobile viewport, GSAP animations firing
- Cart animation: GSAP now drives open/close — confirm CSS class `#cart-panel.open` no longer has conflicting CSS transform

### Mistakes / Lessons
- `#cart-panel.open { transform: translateX(0) }` was in CSS — removed when switching to GSAP. If left in, CSS would fight GSAP inline styles.
- Typing dots: had to create spans programmatically (not innerHTML) to get array reference for GSAP tween.

### Next Steps
1. Visual verify Task 2 before using in production
2. Start Task 3: Visual Autoresearch Loop (5 files to build)

---

## Session 010 — 2026-06-10 (Task 3: Visual Autoresearch Loop)

### What We Did
- Built full visual autoresearch loop — human is judge, loop improves CSS

**Files created:**
- `execution/visual_test_areas.json` — 8 areas with id/name/description/current_approach/hypothesis
- `execution/visual_resources.md` — living log: approved/rejected sections + iteration history table
- `execution/visual_challengers/` — directory for challenger CSS files and backup
- `execution/generate_visual_challenger.js` — Claude call → JSON {area, hypothesis, css_override} → saves challenger_[timestamp].css
- `execution/apply_visual_challenger.js` — finds latest challenger, backs up style.css → baseline_backup.css, appends challenger CSS
- `execution/visual_decision.js` — accepts `win` or `lose`, promotes or reverts, logs to visual_resources.md
- `execution/visual_orchestrator.js` — master script: generate + apply, then exit with review instructions

**Architecture decisions:**
- Loop ONLY touches style.css — never app.js, index.html, or directives
- Always creates baseline_backup.css before applying challenger — no data loss possible
- visual_resources.md grows over iterations — feed back into each challenger generation
- REJECTED entries include a "Reason: <!-- Add note -->" prompt so human notes survive

**All syntax checks passed. Committed `7994781` → pushed to `karuchehan/kapruka-agent`**

### How To Run The Visual Loop
```bash
node execution/visual_orchestrator.js   # generates + applies challenger
vercel dev                               # open browser to review
node execution/visual_decision.js win   # OR: node execution/visual_decision.js lose
# Repeat
```

### Gaps / Verification Needed
- generate_visual_challenger.js makes an Anthropic API call — must confirm with user before running
- Loop not run yet — first iteration is when user kicks it off

### Mistakes / Lessons
- Need to handle case where Claude returns JSON wrapped in markdown fences — added strip logic in generate_visual_challenger.js
- Table row regex in visual_decision.js targets `| # | ... |` header then `| --- |` separator — must match exactly what's in visual_resources.md initial structure

### Next Steps
1. User visual-verify Tasks 1 and 2 in browser (vercel dev)
2. When ready, run visual loop: `node execution/visual_orchestrator.js` (confirm API call first)
3. Run 10-15 visual iterations over coming days

---

## Session 011 — 2026-06-10 (Scroll Anchor Fix — Two Bugs)

### What We Did
Screenshots showed two clear bugs: (1) product cards clipped with only top edge visible, (2) massive blank gap between last message and input bar.

**Root cause analysis:**
1. Cards clipped: `scrollToBottom()` fired immediately after `appendChild` — DOM hadn't computed card heights yet
2. Blank gap: `#messages-container::after { min-height: 120px }` was too tall, and scroll targeted `scrollHeight` (wrong anchor)

**Fix applied (`index.html`, `style.css`, `app.js`):**
- Added `<div id="scroll-anchor"></div>` as last DOM child of `#messages-container`
- Removed `#messages-container::after` entirely (was the source of the blank gap)
- Added `#scroll-anchor { height: 20px; flex-shrink: 0; }` — minimal spacer
- `updateScrollPadding()`: measures `$inputArea.offsetHeight + 20` and sets `$msgs.style.paddingBottom` as inline style (bypasses the flex overflow CSS padding-bottom browser bug). Called at init, `transitionToChat()`, and `window.resize`.
- `scrollToBottom()` now: `setTimeout(fn, 100)` → `$anchor.scrollIntoView({ behavior: 'smooth', block: 'end' })`. 100ms delay gives DOM time to fully compute card layout.
- All `$msgs.appendChild(x)` replaced with `$msgs.insertBefore(x, $anchor)` — ensures anchor stays last after every content insert.

**16/16 automated checks passed. Committed `32156e8` → pushed.**

### Key lesson
The `::after` pseudo-element approach fixed the browser CSS padding-bottom bug but introduced a hard-coded large gap. The correct fix is: (1) JS-measured padding-bottom (bypasses the bug, right size), (2) scroll anchor with scrollIntoView rather than scrollHeight, (3) 100ms delay for layout to settle.

### Next Steps
1. Verify in browser: `vercel dev` — product cards fully visible, gap small and clean, no overlap
2. Test at 375px mobile width
3. Then visual autoresearch loop when ready

---

## Session 012 — 2026-06-12 (Next.js Migration + Carousel Height Collapse Fix)

### What We Did
- Committed full Next.js 15 + React 19 + TypeScript migration (30 files, 3658 insertions)
- Fixed carousel thin-strip bug (root cause identified and fixed)
- Pushed to `karuchehan/kapruka-agent` — commit `24abd1c`

### Carousel Thin-Strip Bug — Root Cause

**CSS spec (Flexbox §4.5):** When a flex item has `overflow` other than `visible` in the main axis direction, `min-height: auto` resolves to `0` (not the content height). `.products-carousel { overflow-y: hidden }` was in a column-flex parent (`#messages-container`). With default `flex-shrink: 1`, the flex algorithm could collapse the carousel to near-zero height. `overflow-y: hidden` then clipped the 380px cards to that collapsed strip.

Bug only manifested late in conversations (multiple carousels + many message bubbles) — enough total flex content to exceed container height and trigger shrinking.

### Fixes Applied

| File | Change |
|---|---|
| `app/globals.css` | Added `flex-shrink: 0` to `.products-carousel` — blocks flex algorithm from shrinking it |
| `app/globals.css` | Reverted `html,body { overflow: clip }` → `overflow: hidden` — `clip` on root element has unpredictable BFC effects; y-transform horizontal-shift root cause was already gone |
| `components/ProductCarousel.tsx` | Removed `y: 16` from GSAP fromTo — pure opacity, no transform (matches MessageBubble fix from prior session) |

### All 4 CLAUDE.md Checks — PASS
1. TS CLEAN — no errors
2. `overflow: hidden` — only on `html,body` (root) + 3 leaf nodes (text-clamp, skeleton card, cart item ellipsis)
3. `overflow-x: hidden` — none
4. `#messages-container { overflow-y: auto }` — confirmed

### Mistakes / Lessons
- `overflow-y: hidden` on a flex item silently zeros out `min-height: auto` per CSS spec — this is a non-obvious spec behavior that causes catastrophic height collapse when parent flex shrinking occurs
- `overflow: clip` on `html` is a newer CSS value — reverted to `overflow: hidden` since it's more predictable on the root element and the original reason for using `clip` (horizontal shift from y-transforms) was already resolved

### Next Steps
1. Visual verify carousel fix in browser — product cards should be full 380px height, horizontally scrollable
2. Add `.env.local` and `.next/` to `.gitignore` (currently untracked, not committed — good, but should be explicit)
3. Deploy to Vercel

---

## Session 013 — 2026-06-12 (Relevancy: Budget + Junk Filtering)

### What We Did
- `.gitignore`: added `.env.local`, `.next/`, `tsconfig.tsbuildinfo` — commit `3b13383`
- Fixed product relevancy (budget overflow + vendor-listing junk) — commit `e506894`

### Critical Architecture Insight
**Product cards are chosen by `route.ts`, NOT by Claude.** The route does `products = result.results.slice(0,4)` and ships that array to the frontend; Claude only writes the text. A system-prompt-only relevancy fix is therefore INEFFECTIVE for the rendered cards — an over-budget or vendor-listing card still renders because the code put it there. Relevancy MUST be enforced in code. (This was the root reason the prior budget/junk bugs persisted despite prompt rules.)

### Fixes Applied
| File | Change |
|---|---|
| `lib/productFilter.ts` (new) | `extractBudget` (parses "under Rs 2000", "budget is 2,000", "around Rs. 500"; scans newest user msg first; applies whole conversation), `isVendorName` (company markers: Pvt/Ltd/Enterprises/Traders/Distributors/Holdings/Importers/Exporters + suffix-only Electronics/Trading/Stores/Mart/Emporium/Agencies), `isJunkProduct` (no-image OR price≤0 OR vendor-name), `filterProducts` (junk then over-budget) |
| `app/api/chat/route.ts` | Imports + applies `filterProducts<Product>(...)` to MCP results BEFORE slicing to 4, for both primary and fallback search. `budget = extractBudget(messages)` computed once per request. |
| `directives/system_prompt.md` | Added BUDGET HARD RULE (never show over-budget; if nothing fits → "Nothing on Kapruka fits that budget for [category] right now" + one follow-up) and PRODUCT QUALITY FILTER (skip vendor/shop listings). Governs Claude's WORDS to match the code filter. |
| `execution/test_relevancy.mjs` (new) | Deterministic test vs LIVE MCP — no Anthropic call, zero API cost. Mirrors the pure filter fns. |

### Test Results — 16/16 PASS (no Anthropic call)
- `extractBudget`: "under Rs 2000"→2000, "below 2,000"→2000, "around Rs. 500"→500, none→null ✓
- `isVendorName`: "Dinapala Electronics"→vendor, "ABC Traders (Pvt) Ltd"→vendor, "Sigma Distributors"→vendor; real long product names→not vendor; "Marketing Management Book"→not vendor (no false positive) ✓
- Scenario "earphones under Rs 2000": 6 of 8 raw results were over budget → dropped; 2 remain, both ≤ Rs 2000 ✓
- Scenario "portable scales": no junk in this run (all imaged + priced) ✓
- Scenario "earphones under Rs 1" (impossible): 0 cards → Claude must say so, not show junk ✓

### Decisions Made (user)
- Vendor junk: chose **vendor-name keyword filter** (over price-outlier or prompt-only)
- Live agent text test: **push code now, validate Claude wording later via autoresearch** (no Anthropic call this session — honored API-key confirmation rule)

### Known Gaps / Lessons
- Vendor detection is keyword-based — unlisted vendor patterns (a shop name with no company marker + a normal-looking price) can still slip through. Autoresearch loop with the new relevancy/budget scoring dimension should surface + tune these.
- Removed bare "marketing" from vendor markers — would false-positive on "Marketing" book titles; company names with Marketing are already caught by Pvt/Ltd.
- `filterProducts<Product>(...)` needs explicit `<Product>` generic — `result.results` is `any` (JSON.parse), so without it the generic defaults to the bare `FilterableProduct` shape and tsc errors on missing `id`/`url`.

### Next Steps
1. Run prompt autoresearch loop — add a 7th scoring dimension: **budget compliance** (every shown product ≤ stated budget) alongside relevancy. Confirm Anthropic API call before running.
2. Minor visual: card sizes inconsistent between carousel rows (row 1 cards larger than row 2) — investigate `.product-card` / image aspect ratio. Low priority.
3. Deploy to Vercel.
4. Process `kapruka_direction_prompt.md` (user will drop it in — main session).

---

## Session 014 — 2026-06-12 (Currency-Token Leak in Search Query)

### The Bug (reported)
"headphones exist on Kapruka under Rs 20,000 (verified, 321 results) but the agent returns gift vouchers instead."

### Diagnosis (live MCP, no Anthropic call — `execution/diag_headphones.mjs`)
**Root cause: currency token `"rs"` leaked into the MCP search query.**
- For "I want headphones under Rs 20000", `buildSearchQuery` produced **`"headphones rs"`** — `"20000"` dropped by `/^\d+$/`, `"under"` is a stopword, but `"rs"` was NOT in STOP so it survived.
- MCP search `"headphones rs"` → **1 junk result** (kids RGB headphone).
- MCP search clean `"headphones"` → **6 real headphones** (Sony WH-1000XM5, Armaggeddon Rs.11850, Anker Rs.13000, Sony WH-CH720N Rs.31900, Ugreen stand Rs.6220, Baseus Rs.23280); 3 under Rs 20000.
- **Budget filter was innocent** — on clean query it correctly kept 3 ≤20000, dropped the Rs.913000/31900/23280 ones.

### Fix (commit `c089d70`)
- `route.ts` STOP set: added `rs`, `lkr`, `rupees`, `rupee`, `budget`, `price`, `priced`, `cost`, `costs`.
- After fix: `buildSearchQuery("...headphones under Rs 20000")` → `"headphones"`, budget 20000 → 3 valid products.
- `execution/diag_headphones.mjs`: live-MCP diagnostic with a **regression guard** (`exit 1` if query isn't clean `"headphones"`).

### Lessons
- Keyword extraction must strip currency/unit tokens, not just digits. `/^\d+$/` removes "20000" but the unit word "rs"/"lkr" rides along and silently destroys MCP relevance.
- General pattern: any budget/price phrasing ("Rs", "LKR", "rupees", "budget") is metadata, never a product keyword. Extracted into budget logic, never into the search string.
- Always check the ACTUAL query string sent to MCP before blaming the filter — the filter was correct; the query was poisoned upstream.

### Next Steps
1. Same as Session 013 next-steps (autoresearch w/ budget dimension, card-size visual, Vercel deploy, kapruka_direction_prompt.md).

---

## Session 015 — 2026-06-12 (Duplicate Cards + Conversation-Quality Bugs: Code vs Prompt Split)

### What We Did
**Task 1 — conversation-wide card dedupe (`hooks/useChat.ts`).**
- responseId guard only prevented dupes WITHIN one response. Same product reappeared across message rows.
- Added `shownProductIds` ref (Set), filter carousel products against it, record survivors, reset in `initWithOnboarding`.
- Critical: filtering + Set mutation done OUTSIDE the `setChatItems` updater — updaters run twice under React Strict Mode; mutating the ref inside would filter the 2nd pass against an already-populated set and DROP the whole carousel.

**Task 2 — added scenarios 21/22/23 to `execution/test_scenarios.json`** (autobiography relevance, describe-book-from-context, no-unprompted-category-switch). Ran baseline only (~46 sonnet calls, user-approved): avg 4.51, all 3 NEW scenarios PASSED (4.83/4.67/4.33). Only failure: scenario_015 Sinhala (product_quality:2).

**Conclusion: autoresearch was the WRONG tool.** The reported bugs are code-layer, not prompt. `run_tests.js` is SDK-direct with curated injected products — it never calls live MCP, so it can't reproduce retrieval bugs. Running the full loop would have tuned Sinhala, not the book bugs.

### Diagnosis (no API — read `route.ts` + `productFilter.ts`)
- **Cards bypass the model entirely** (`route.ts` returns `products` separately; comment at search site says cards come from this array, not Claude). No prompt change can fix card relevance.
- **Fiction for "autobiographies":** `filterProducts` only dropped junk/budget — zero relevance/type matching. MCP fuzzy results flowed straight to cards.
- **Deflection + price flip:** `detectIntent` treated nearly every non-ack message as a NEW search. "what is that book about?" → re-search "book" → fresh random books injected, model pivots; same title resurfaced with a different ranked variant/price. Root = over-eager re-searching.

### Fixes (commit `720d090`) — 3 fixes, one commit, TS clean after each
- **Fix 1** `detectIntent`: follow-up patterns (`what is/tell me more/how much ... that/it/this`) + short(<6w)+pronoun+no-new-keyword → `type:"none"`, no re-search. Highest leverage — kills source of dupes, deflection, price flip.
- **Fix 2** `productFilter.ts`: relevance gate after junk/budget — keep products whose name/category shares a stemmed query token; skip gate (return pre-gate) if <2 survive. Added light `stem()` (strip trailing ies/es/s/y) so "autobiographies"~"autobiography".
- **Fix 3** `route.ts` + `useChat.ts`: client sends `lastShownProducts` (most recent carousel); API injects "LAST SHOWN PRODUCTS" block so Claude answers follow-ups about shown items without re-searching.
- Deterministic test (`tsx`, no API): relevance gate + follow-up regex — 13/14, the 1 "fail" was a wrong test expectation (gate correctly skips at <2 survivors), not a code bug.

### Gaps Identified
- **Fix 2 depends on MCP returning a category field.** `normaliseProduct` now reads `category`/`category_name`/`type`, but if MCP omits it AND titles lack the genre word (real autobiographies don't contain "autobiography"), the gate drops to <2 and falls back — fiction still shows. NOT yet verified against live MCP what category field (if any) `kapruka_search_products` returns.
- **End-to-end behavior NOT yet verified** — the 3 acceptance tests ("autobiographies" → only autobiographies; "what is that book about?" → describes, no re-search; price consistent across messages) hit `/api/chat` = Anthropic call. Deferred pending explicit API approval.
- Price flip has a second-order path: if a follow-up DOES re-search (not caught by Fix 1), no per-id session cache exists. Fix 1 removes the common trigger but not a hard guarantee.

### Mistakes & Lessons
- Don't reach for the autoresearch loop on a bug you can't reproduce in its harness. The harness tests prompt-quality-given-products, not retrieval. Verify the failing layer before picking the tool.
- When a UI artifact (cards) is produced by deterministic code and NOT the model, prompt tuning is structurally incapable of fixing it — trace the data path first.
- React Strict Mode: never mutate a ref/external state inside a setState updater. Compute side effects outside the updater.

### Next Steps
1. **Get API approval** to run the 3 end-to-end acceptance tests against `/api/chat` (live MCP + sonnet).
2. **Confirm MCP category field** — inspect a live `kapruka_search_products` result to see if `category`/`type` is populated; if not, Fix 2 needs a different signal (or accept it only helps literal-noun queries).
3. Consider per-id product cache for the session as a hard guarantee against price flips.
4. Scenarios 21/22/23 remain useful as REGRESSION GUARDS once the loop is run again with a budget/relevance dimension.
5. Carry-over from Session 014: autoresearch w/ budget dimension, card-size visual, Vercel deploy, `kapruka_direction_prompt.md`.

---
