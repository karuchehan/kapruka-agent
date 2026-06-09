# Directive: Deployment

## Platform

Vercel — free tier, static site + serverless functions. Zero config needed for this stack.

## How Vercel Works With This Project

- Everything in the root (`index.html`, `style.css`, `app.js`) is served as static files
- Anything in `/api/` is automatically deployed as a serverless Node.js function
- Environment variables (API keys) are set in the Vercel dashboard — never in code
- Every push to the main GitHub branch auto-deploys

## Setup Steps

1. Push the project to a GitHub repository
2. Go to vercel.com → New Project → Import the GitHub repo
3. No build settings needed — Vercel detects static site automatically
4. Add environment variable in Vercel dashboard: `ANTHROPIC_API_KEY`
5. Deploy — get a public URL instantly

## Environment Variables

Local development — create a `.env` file at root (gitignored):
```
ANTHROPIC_API_KEY=your_key_here
```

Production — add in Vercel dashboard under Project Settings → Environment Variables.

The Kapruka MCP endpoint (`https://mcp.kapruka.com/mcp`) needs no API key.

## Local Development

Since there is no build step, local development is simple:

Option 1 — Vercel CLI (recommended):
```bash
npm i -g vercel
vercel dev
```
This runs both the static files and the serverless function locally with the `.env` file loaded automatically.

Option 2 — Any static server:
```bash
npx serve .
```
Note: serverless function won't work with this — use Vercel CLI for full local testing.

## The Serverless Function: `/api/chat.js`

```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, userProfile } = req.body;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: buildSystemPrompt(userProfile),
      messages: messages,
      // MCP server connection
      // Note: check current Anthropic SDK docs for MCP integration syntax
    });

    res.status(200).json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

The exact MCP integration syntax should be verified against the current Anthropic SDK documentation before building — this may have been updated.

## Vercel Configuration

Create `vercel.json` at root only if needed for custom routing. For this project it likely is not needed since the structure is straightforward.

## Pre-Submission Checklist

Before submitting the demo link:

- [ ] Live URL opens and loads in under 3 seconds
- [ ] Onboarding flow works end-to-end
- [ ] Product search returns real Kapruka results
- [ ] Product images display correctly
- [ ] Cart adds and updates correctly
- [ ] Checkout generates a real Kapruka pay link
- [ ] Voice output works in Chrome
- [ ] Works on mobile (test on actual phone)
- [ ] Sinhala input gets a Sinhala response
- [ ] Tanglish input gets a Tanglish response
- [ ] Delivery date constraint is handled
- [ ] Gift message is collected and passed through
- [ ] No console errors in production
- [ ] URL stays live and does not go to sleep (Vercel stays up — no cold start issues for static)

## Important

The judges open the URL and use it immediately with no instructions. It must just work. The onboarding must be self-explanatory. There should be no broken states, no error messages visible to the user, no loading that hangs.
