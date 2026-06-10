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
