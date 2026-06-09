# Directive: Tech Stack

## Decision Summary

No frameworks. No build tools. Pure vanilla frontend hosted on Vercel with a single serverless function as the backend. This is intentional and deliberate.

## Frontend

**Vanilla HTML/CSS/JS — no framework, no bundler, no npm**

- Single `index.html` at root
- `style.css` for all styling
- `app.js` for all frontend logic including chat, voice, cart state
- GSAP 3.12.2 via CDN — all animations, entrance effects, transitions
- GSAP ScrollTrigger via CDN if needed
- Google Fonts via CDN — typography
- CSS custom properties for colors, spacing, theming
- CSS @keyframes for looping animations
- Web Speech API (built into browser) — voice output, no third party needed

**Why vanilla:**
- Zero build step — drop files on Vercel and it's live instantly
- Full control over every animation and interaction
- No framework bloat — faster load times
- Most competitors will use React or Next.js and their UI will look generic
- This stack already proven on Gotokeeled.com with excellent results

## Backend

**Single Vercel serverless function: `/api/chat.js`**

- Node.js
- Handles all Anthropic SDK calls
- Connects to Kapruka MCP server
- Keeps API keys secret — never exposed to frontend
- Approximately 50-80 lines of code

**Why a serverless function:**
- API keys cannot live in frontend code — anyone can steal them via browser inspector
- Vercel auto-deploys anything in `/api/` as a serverless endpoint
- No separate server to manage, no VPS needed, scales automatically

## Data Flow

```
Browser (index.html + app.js)
    ↓ POST /api/chat
Vercel Serverless Function (api/chat.js)
    ↓ Anthropic SDK + Kapruka MCP
Claude (claude-sonnet-4-20250514) with MCP tools
    ↓ Response
Browser renders message + product cards + voice output
```

## Hosting

**Vercel — static site + serverless functions**

- Free tier is sufficient
- Connect GitHub repo → auto-deploy on every push
- Environment variables stored in Vercel dashboard (API keys etc.)
- Custom domain optional but not required for submission

## Environment Variables

Stored in `.env` locally and in Vercel dashboard for production:

```
ANTHROPIC_API_KEY=your_key_here
```

The Kapruka MCP requires no API key — it is free and public.

## What We Are NOT Using

- React, Vue, Next.js, Svelte — no frontend framework
- Tailwind, Bootstrap — no CSS framework
- Webpack, Vite, Parcel — no bundler
- jQuery — no utility libraries
- Express, Fastify — no Node server framework (Vercel handles this)
- Database — no persistence needed for this build
- Authentication — no login system needed

## File Structure

```
/
├── index.html          ← entire chat UI
├── style.css           ← all styles
├── app.js              ← all frontend JS
├── api/
│   └── chat.js         ← serverless backend
├── .env                ← local secrets (gitignored)
└── vercel.json         ← vercel config if needed
```
