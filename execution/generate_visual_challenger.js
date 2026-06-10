/**
 * generate_visual_challenger.js
 * Reads visual_resources.md + current style.css, uses Claude to generate a
 * targeted CSS change for ONE visual area. Saves to visual_challengers/challenger_[timestamp].css
 *
 * Usage: node execution/generate_visual_challenger.js
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getIterationCount() {
  const resourcesPath = path.join(__dirname, "visual_resources.md");
  if (!fs.existsSync(resourcesPath)) return 0;
  const content = fs.readFileSync(resourcesPath, "utf8");
  return (content.match(/\| \d+ \|/g) || []).length;
}

export async function generateVisualChallenger() {
  const resourcesPath = path.join(__dirname, "visual_resources.md");
  const cssPath = path.join(ROOT, "style.css");
  const areasPath = path.join(__dirname, "visual_test_areas.json");
  const challengersDir = path.join(__dirname, "visual_challengers");

  if (!fs.existsSync(challengersDir)) fs.mkdirSync(challengersDir, { recursive: true });

  const currentCSS = fs.readFileSync(cssPath, "utf8");
  const visualAreas = JSON.parse(fs.readFileSync(areasPath, "utf8"));
  const visualResourcesContent = fs.existsSync(resourcesPath)
    ? fs.readFileSync(resourcesPath, "utf8")
    : "No prior learnings yet.";

  const iterNum = getIterationCount() + 1;

  console.log(`\n  ╔══════════════════════════════════════════════════════╗`);
  console.log(`  ║  VISUAL AUTORESEARCH — ITERATION ${String(iterNum).padEnd(20)}║`);
  console.log(`  ╚══════════════════════════════════════════════════════╝\n`);
  console.log("  Generating visual challenger...\n");

  const prompt = `You are an expert UI designer improving a Sri Lankan shopping agent UI.

CURRENT STYLE.CSS:
${currentCSS}

VISUAL AREAS AVAILABLE TO IMPROVE:
${JSON.stringify(visualAreas, null, 2)}

PREVIOUS FEEDBACK FROM HUMAN JUDGE:
${visualResourcesContent}

Your task:
- Pick ONE visual area that has the most room for improvement based on the feedback
- If there is no prior feedback, pick the area with the most impactful hypothesis
- Generate a specific, surgical CSS change targeting only that area
- The change must be a complete CSS block that can be appended to style.css to override the relevant rules
- Do NOT redesign everything — one focused improvement only
- The change must stay within style.css only — no HTML or JS changes
- State your hypothesis: why will this be better?

Respond in this exact JSON format (no markdown, no code fences, just the raw JSON):
{
  "area": "area_id",
  "hypothesis": "one sentence — why this will be better",
  "css_override": "the complete CSS to append — use specific selectors to override existing rules"
}`;

  let parsed;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Strip markdown fences if present
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error(`  Failed to generate or parse challenger: ${err.message}`);
    process.exit(1);
  }

  const { area, hypothesis, css_override } = parsed;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const challengerPath = path.join(challengersDir, `challenger_${timestamp}.css`);

  const header = `/* Visual Challenger — ${timestamp}
 * Area:       ${area}
 * Hypothesis: ${hypothesis}
 * Apply with: node execution/apply_visual_challenger.js
 */\n\n`;

  fs.writeFileSync(challengerPath, header + css_override);

  const areaObj = visualAreas.find((a) => a.id === area);
  const areaName = areaObj ? areaObj.name : area;

  console.log(`  Area targeted:  ${areaName} (${area})`);
  console.log(`  Hypothesis:     ${hypothesis}`);
  console.log(`  Saved →         execution/visual_challengers/challenger_${timestamp}.css\n`);

  return { challengerPath, area, hypothesis, timestamp };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateVisualChallenger().catch((err) => { console.error(err); process.exit(1); });
}
