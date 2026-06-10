/**
 * generate_challenger.js
 * Reads latest test results + resources.md, uses Claude to generate an improved system prompt.
 * Saves to execution/challenger_system_prompt.md
 *
 * Usage: node execution/generate_challenger.js
 */

import Anthropic  from "@anthropic-ai/sdk";
import fs         from "fs";
import path       from "path";
import dotenv     from "dotenv";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function latestResultFile() {
  const resultsDir = path.join(__dirname, "results");
  if (!fs.existsSync(resultsDir)) return null;
  const files = fs.readdirSync(resultsDir)
    .filter(f => f.startsWith("baseline_") && f.endsWith(".json"))
    .sort()
    .reverse();
  return files.length ? path.join(resultsDir, files[0]) : null;
}

export async function generateChallenger() {
  const currentPromptPath    = path.join(ROOT, "directives", "system_prompt.md");
  const challengerOutputPath = path.join(__dirname, "challenger_system_prompt.md");
  const resourcesPath        = path.join(__dirname, "resources.md");

  const currentPrompt  = fs.readFileSync(currentPromptPath, "utf8");
  const resourcesContent = fs.existsSync(resourcesPath)
    ? fs.readFileSync(resourcesPath, "utf8")
    : "No prior learnings yet.";

  const resultFile = latestResultFile();
  if (!resultFile) {
    console.error("  No baseline results file found. Run run_tests.js first.");
    process.exit(1);
  }

  const results        = JSON.parse(fs.readFileSync(resultFile, "utf8"));
  const failedScenarios = (results.results || [])
    .filter(r => !r.skipped && r.what_was_wrong)
    .map(r => `- [${r.scenario_id}] ${r.description}\n  Problem: ${r.what_was_wrong}\n  Failed dims: ${r.failures?.join(", ") || "none listed"}`)
    .join("\n");

  const weakestDimensions = (results.weakest_dimensions || []).join(", ");
  const overallAverage    = results.overall_average ?? "unknown";

  console.log(`\n  Generating challenger targeting: ${weakestDimensions || "general improvement"}`);
  console.log(`  Current average: ${overallAverage}\n`);

  const challengerPrompt = `You are an expert prompt engineer. Your job is to improve the system prompt for a Sri Lankan shopping agent called the Kapruka Assistant.

CURRENT SYSTEM PROMPT:
${currentPrompt}

CURRENT TEST SCORE: ${overallAverage}/5

WHAT FAILED IN THE LATEST TEST RUN:
${failedScenarios || "No specific failures — general quality improvement needed."}

WEAKEST DIMENSIONS: ${weakestDimensions || "none identified"}

LEARNINGS FROM PREVIOUS ITERATIONS:
${resourcesContent}

Your task:
- Make TARGETED improvements only — do not rewrite sections that are working well
- Focus on fixing the failed dimensions: ${weakestDimensions}
- Pay special attention to:
  1. LANGUAGE MATCHING: If the user writes Tanglish (mixed Sinhala/English), respond in Tanglish. If Sinhala script, respond in Sinhala. Never use formal English when the user is casual.
  2. RELEVANCE: "planting" means gardening/plants — NOT planners, planning books, or office supplies. Interpret words by their natural meaning.
  3. CULTURAL CONTEXT: Sri Lankan cultural awareness (Vesak, relationships, occasions)
  4. QUESTION QUALITY: One focused question, not multiple. Ask for the ONE thing that most narrows down options.
- Do not change the agent's core personality
- Do not make the prompt longer for the sake of it — precision beats length
- At the very end of the system prompt, add this block:
  <!-- CHANGES IN THIS VERSION:
  - [dimension changed]: what you changed and why
  -->

Return ONLY the improved system prompt text, nothing else. Do not include any preamble or explanation.`;

  try {
    const response = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 4096,
      messages:   [{ role: "user", content: challengerPrompt }],
    });

    const challengerText = response.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();

    fs.writeFileSync(challengerOutputPath, challengerText);

    // Extract and print the changes comment
    const changesMatch = challengerText.match(/<!--\s*CHANGES IN THIS VERSION:([\s\S]*?)-->/);
    if (changesMatch) {
      console.log("  Changes in challenger:");
      changesMatch[1].trim().split("\n").forEach(line => console.log(`    ${line.trim()}`));
    } else {
      console.log("  Challenger generated (no changes block found)");
    }

    console.log(`\n  Challenger saved → execution/challenger_system_prompt.md\n`);
    return challengerOutputPath;

  } catch (err) {
    console.error(`  Challenger generation failed: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateChallenger().catch(err => { console.error(err); process.exit(1); });
}
