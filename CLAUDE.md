# Kapruka Shopping Agent — Claude Code Instructions

> This file is the master initialization file. Read this first before doing anything.

## What We Are Building

A shopping agent for Kapruka (Sri Lanka's largest e-commerce platform) built for the Kapruka Agent Challenge 2026. The agent is a full-screen, voice-enabled, visually rich chat UI that connects to the Kapruka MCP server and lets users shop end-to-end — from discovery to checkout.

Prize: Apple M4 Mac Mini. Deadline: 30 June 2026. Judged by the Kapruka tech team.

## The 3-Layer Architecture (DOE Framework)

**Layer 1 — Directive (What to do)**
- SOPs written in Markdown, stored in `/directives/`
- Natural language instructions defining goals, inputs, tools, outputs, edge cases

**Layer 2 — Orchestration (You — Claude)**
- Read directives, call execution tools in the right order
- Handle errors, ask for clarification, update directives with learnings
- You are the glue between intent and execution
- Do NOT do things manually — read the directive and run the appropriate script

**Layer 3 — Execution (How it gets done)**
- Scripts stored in `/execution/`
- Deterministic, reliable, testable
- Handle API calls, test runners, file operations

## Self-Annealing Loop

When something breaks:
1. Read the error and stack trace
2. Fix the script and test it
3. Update the directive with what you learned
4. Re-run and confirm
5. System is now stronger

## Stack (migrated to Next.js + React — 2026-06-11)

**Reason:** Vanilla HTML/CSS/JS caused recurring layout bugs with product card carousels and DOM reflow. React's component model isolates these permanently.

## File Structure

```
kapruka-agent/
├── CLAUDE.md                        ← You are here
├── app/
│   ├── layout.tsx                   ← Root layout (fonts, metadata)
│   ├── page.tsx                     ← Entry: onboarding → chat
│   ├── globals.css                  ← All styling (CSS variables, components)
│   └── api/chat/route.ts            ← API route (port of api/chat.js)
├── components/                      ← React components
├── hooks/                           ← useChat, useCart, useVoiceOutput, useVoiceInput
├── lib/types.ts                     ← Shared TypeScript interfaces
├── directives/                      ← Markdown prompts (UNCHANGED)
├── execution/                       ← Visual autoresearch loop (UNCHANGED)
└── .env.local                       ← API keys (never commit)
```

## Key Constraints

- Deadline is 30 June 2026 — approximately 3 weeks from start
- Solo builder
- Must be live on a public URL when submitted
- Judges open the URL and use it immediately — it must just work
- Stack: Next.js 15 + React 19 + TypeScript + GSAP (@gsap/react)
- Old files (index.html, app.js, style.css, api/chat.js) are legacy — do not edit them

## Operating Principles

1. Check `/directives/` before writing any code
2. Self-anneal when things break — fix, test, update directive
3. Components go in `/components/`, hooks in `/hooks/`, styles in `app/globals.css`
4. Every decision should serve the judging rubric (see `scoring_strategy.md`)
5. When in doubt, prioritize feel and visuals over clever backend logic
6. **Brand assets** live under `public/brand/` — `logos/` (logo SVGs), `icons/` (UI icons), `animations/` (animation-specific assets). Any new asset the user uploads goes into the correct subfolder. Reference in code as `/brand/<subfolder>/<file>` (e.g. `/brand/logos/letterU-cropped.svg`). Never drop loose assets at the `public/` root.

## MANDATORY SELF-VERIFICATION RULE

After EVERY change to `globals.css`, any layout component, or any `overflow`/`scroll`-related property — run ALL 4 checks before reporting back. Do not ask the user to test. YOU verify first.

**Check 1 — TypeScript**
```
npx tsc --noEmit
```
Must be TS CLEAN. Fix all errors before continuing.

**Check 2 — No `overflow: hidden` on scroll ancestors**
```
grep -rn "overflow: hidden" app/ components/ --include="*.css" --include="*.tsx" --include="*.ts"
```
For every result: confirm it is NOT on `#chat-screen`, `#messages-container`, or any ancestor of the messages list. If it is — remove it before stopping.

**Check 3 — No `overflow-x: hidden` on scroll ancestors**
```
grep -rn "overflow-x: hidden" app/ components/ --include="*.css" --include="*.tsx" --include="*.ts"
```
Same rule — must not exist on any messages ancestor.

**Check 4 — Vertical scroll intact**
```
grep -n "overflow-y" app/globals.css
```
Confirm `#messages-container` has `overflow-y: auto` or `overflow-y: scroll` — NOT `hidden`, NOT `clip`.

**Only report a fix as complete after all 4 checks pass.**
Never report "TS clean" as the final verification for layout changes. All 4 must pass.

---

## Hard Rules

### API Key Confirmation
**NEVER make any Anthropic API call without explicit confirmation from the user first.**
- Ask before every test run, autoresearch loop, or live API call
- One approval does not mean standing approval — confirm each time
- This includes any code path that touches `ANTHROPIC_API_KEY`

### Session Memory Logging
**After every git commit and push, append a session entry to `MEMORY.md` in the project root.**
- Format: `## Session NNN — YYYY-MM-DD`
- Sections: What We Did / Gaps Identified / Mistakes & Lessons / Next Steps
- Be exact — file names, error messages, decisions made
- This is non-negotiable — never skip it
