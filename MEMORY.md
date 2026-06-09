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
