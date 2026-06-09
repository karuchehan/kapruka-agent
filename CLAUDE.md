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

## File Structure

```
kapruka-agent/
├── CLAUDE.md                        ← You are here
├── directives/
│   ├── project_overview.md          ← Full project context
│   ├── tech_stack.md                ← Stack decisions and reasoning
│   ├── agent_concept.md             ← What the agent is and how it behaves
│   ├── ui_design.md                 ← Visual design and UX requirements
│   ├── onboarding_flow.md           ← User onboarding logic
│   ├── scoring_strategy.md          ← How to maximize the judging rubric
│   ├── autoresearch_loop.md         ← Autonomous prompt testing and improvement
│   └── deployment.md                ← Vercel deployment instructions
├── execution/
│   └── (scripts go here as we build)
├── api/
│   └── chat.js                      ← Vercel serverless function
├── index.html                       ← Main chat UI
├── style.css                        ← All styling
├── app.js                           ← Frontend logic
└── .env                             ← API keys (never commit)
```

## Key Constraints

- Deadline is 30 June 2026 — approximately 3 weeks from start
- Solo builder
- Must be live on a public URL when submitted
- Judges open the URL and use it immediately — it must just work
- No React, no Next.js, no build tools — pure vanilla HTML/CSS/JS
- One Vercel serverless function for the backend

## Operating Principles

1. Check `/directives/` before writing any code
2. Self-anneal when things break — fix, test, update directive
3. Keep the frontend vanilla — no frameworks, no npm on the frontend
4. Every decision should serve the judging rubric (see `scoring_strategy.md`)
5. When in doubt, prioritize feel and visuals over clever backend logic

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
