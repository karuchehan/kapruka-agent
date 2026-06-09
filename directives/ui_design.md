# Directive: UI Design

## Design Philosophy

The UI has to feel like the future of shopping — not like another chatbot widget. Full-screen, immersive, visually alive. The judges open this and immediately feel the difference from every other entry.

The reference point is Gotokeeled.com — hand-crafted vanilla CSS with GSAP animations. That same level of craft applies here.

## Layout

- Full screen — no sidebars, no headers taking up space, the chat IS the page
- Chat takes up the full viewport
- Product cards render inline inside the chat — not in a separate panel
- Persistent cart indicator in the corner — slides in smoothly when items are added
- Voice toggle button — subtle, always accessible

## Visual Style

- Dark background — premium, immersive feel
- Rich typography — Google Fonts (decide on pairing during build)
- CSS custom properties for all colors and spacing — easy to theme
- Subtle background texture or animated grid — like the wave grid on Gotokeeled
- Product images are large and prominent — not thumbnails

## Animations (GSAP via CDN)

All animations use GSAP. Import via CDN:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
```

Key animations to implement:
- **Message entrance** — each message animates in (fade + slight upward movement)
- **Product cards animate in** — staggered entrance as the agent "finds" products
- **Cart slide-in** — smooth side panel when cart updates
- **Typing indicator** — animated dots while agent is thinking
- **Onboarding entrance** — the very first screen makes an impression
- **Voice indicator** — subtle pulse animation when agent is speaking

## Product Cards

This is where visual richness score is won. Each product card must show:
- Large product image
- Product name
- Price (clear and prominent)
- "Add to cart" button
- Delivery availability indicator

Cards appear in a horizontal scroll carousel when multiple products are shown. Single products appear as a larger featured card.

Card entrance: staggered GSAP animation — cards slide up one by one as they load.

## Chat Bubbles

- User messages: right-aligned, distinct color
- Agent messages: left-aligned, with a subtle agent avatar/indicator
- Timestamps optional — keep it clean
- Smooth scroll to latest message on every new message

## Cart UI

- Persistent cart icon in top-right corner showing item count
- Clicking opens a slide-in panel from the right
- Shows all items with images, quantities, prices
- Total at the bottom
- "Proceed to checkout" button generates the Kapruka pay link

## Voice UI

- Small microphone/speaker icon — always visible
- When agent is speaking: subtle animated pulse around the icon
- Toggle to mute voice — state persists in localStorage
- Use Web Speech API SpeechSynthesis — no third party, no cost

## Onboarding Screen

The first thing a user sees. Must make an impression:
- Clean, centered layout
- Agent introduces itself warmly
- Collects name, age, gender conversationally — three short exchanges
- Smooth transition into the main chat after onboarding complete
- Onboarding data stored in memory for the session

## Mobile Responsiveness

Must work on mobile — judges may test on phone:
- Touch-friendly tap targets
- Chat input fixed to bottom of screen
- Product cards scroll horizontally with touch
- Font sizes readable on small screens

## Color Palette (Starting Point — Refine During Build)

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #141414;
  --bg-card: #1a1a1a;
  --accent: #e63329; /* Kapruka red */
  --accent-soft: rgba(230, 51, 41, 0.15);
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --border: rgba(255, 255, 255, 0.08);
}
```

The red accent is pulled from Kapruka's brand — this immediately signals the connection to Kapruka visually.

## What To Avoid

- No generic chat bubble styles that look like WhatsApp or ChatGPT
- No white background — it looks cheap and generic
- No small product thumbnails — images must be large
- No cluttered UI — every element earns its place
- No loading spinners — use skeleton screens or animated placeholders instead
