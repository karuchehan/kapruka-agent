/**
 * generate_challenger.js
 * Reads latest test results + resources.md + challenger_notes.md, uses Claude to
 * generate an improved system prompt. Saves to execution/challenger_system_prompt.md
 *
 * Hard constraint (from challenger_notes.md): a challenger may NEVER reduce
 * product-suggestion behaviour. After generating, the challenger is scored against
 * the baseline per-scenario. If it scores lower on product_quality OR completeness
 * on ANY scenario, it is regenerated (with the regression fed back in) before it is
 * allowed through to comparison — up to CHALLENGER_MAX_REGEN attempts.
 *
 * Usage: node execution/generate_challenger.js
 *
 * Env:
 *   CHALLENGER_VALIDATE=0   disable the regeneration guard (generate once, no scoring — no extra API calls)
 *   CHALLENGER_MAX_REGEN=N  max regeneration attempts before giving up (default 3)
 */

import Anthropic  from "@anthropic-ai/sdk";
import fs         from "fs";
import path       from "path";
import dotenv     from "dotenv";
import { fileURLToPath } from "url";
import { runTests } from "./run_tests.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Dimensions that must never regress on any scenario.
const PROTECTED_DIMENSIONS = ["product_quality", "completeness"];

function latestResultFile() {
  const resultsDir = path.join(__dirname, "results");
  if (!fs.existsSync(resultsDir)) return null;
  // Accept baseline_* first, fall back to any run_* file
  const files = fs.readdirSync(resultsDir)
    .filter(f => f.endsWith(".json") && !f.startsWith("challenger_"))
    .sort()
    .reverse();
  return files.length ? path.join(resultsDir, files[0]) : null;
}

/**
 * Compare challenger vs baseline per-scenario on the protected dimensions.
 * Returns an array of human-readable regression strings (empty = no regression).
 * A regression is ANY strict drop (challenger < baseline) on a protected dimension
 * for a scenario present in both runs.
 */
function productRegressions(baselineData, challengerData) {
  const baselineScores = Object.fromEntries(
    (baselineData.results || [])
      .filter(r => r.scores)
      .map(r => [r.scenario_id, r.scores])
  );

  const regressions = [];
  for (const r of (challengerData.results || [])) {
    const b = baselineScores[r.scenario_id];
    const c = r.scores;
    if (!b || !c) continue;
    for (const dim of PROTECTED_DIMENSIONS) {
      const bv = b[dim];
      const cv = c[dim];
      if (typeof bv === "number" && typeof cv === "number" && cv < bv) {
        regressions.push(`${r.scenario_id} ${dim}: ${bv} → ${cv} (${(cv - bv).toFixed(2)})`);
      }
    }
  }
  return regressions;
}

function buildChallengerPrompt({ currentPrompt, overallAverage, failedScenarios, weakestDimensions, resourcesContent, notesContent, regressionFeedback }) {
  const regressionBlock = regressionFeedback
    ? `\nPREVIOUS ATTEMPT WAS REJECTED — it reduced product-suggestion quality on these scenarios:\n${regressionFeedback}\nYou MUST keep concrete product suggestions on those scenarios while still improving. Do NOT drop products to gain elsewhere.\n`
    : "";

  return `You are an expert prompt engineer. Your job is to improve the system prompt for a Sri Lankan shopping agent called the Kapruka Assistant.

CURRENT SYSTEM PROMPT:
${currentPrompt}

CURRENT TEST SCORE: ${overallAverage}/5

WHAT FAILED IN THE LATEST TEST RUN:
${failedScenarios || "No specific failures — general quality improvement needed."}

WEAKEST DIMENSIONS: ${weakestDimensions || "none identified"}

LEARNINGS FROM PREVIOUS ITERATIONS:
${resourcesContent}

HARD CONSTRAINTS (per-scenario — these are non-negotiable):
${notesContent}
${regressionBlock}
Your task:
- Make TARGETED improvements only — do not rewrite sections that are working well
- Focus on fixing the failed dimensions: ${weakestDimensions}
- NEVER reduce product-suggestion behaviour. A clarifying question must not replace
  concrete product suggestions. Every shopping turn with products available must
  surface at least one specific product (name + price). This is the #1 reason past
  challengers were rejected — do not repeat it.
- Pay special attention to:
  1. LANGUAGE MATCHING: If the user writes Tanglish (mixed Sinhala/English), respond in Tanglish. If Sinhala script, respond in Sinhala. Never use formal English when the user is casual. BUT still suggest products in the same turn.
  2. RELEVANCE: "planting" means gardening/plants — NOT planners, planning books, or office supplies. Interpret words by their natural meaning.
  3. CULTURAL CONTEXT: Sri Lankan cultural awareness (Vesak, relationships, occasions)
  4. QUESTION QUALITY: One focused question, not multiple. Ask for the ONE thing that most narrows down options — AND still show at least one product.
- Do not change the agent's core personality
- Do not make the prompt longer for the sake of it — precision beats length
- At the very end of the system prompt, add this block:
  <!-- CHANGES IN THIS VERSION:
  - [dimension changed]: what you changed and why
  -->

Return ONLY the improved system prompt text, nothing else. Do not include any preamble or explanation.`;
}

async function generateOnce(promptText, outputPath) {
  const response = await client.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 4096,
    messages:   [{ role: "user", content: promptText }],
  });

  const challengerText = response.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("")
    .trim();

  fs.writeFileSync(outputPath, challengerText);

  const changesMatch = challengerText.match(/<!--\s*CHANGES IN THIS VERSION:([\s\S]*?)-->/);
  if (changesMatch) {
    console.log("  Changes in challenger:");
    changesMatch[1].trim().split("\n").forEach(line => console.log(`    ${line.trim()}`));
  } else {
    console.log("  Challenger generated (no changes block found)");
  }

  return challengerText;
}

export async function generateChallenger() {
  const currentPromptPath    = path.join(ROOT, "directives", "system_prompt.md");
  const challengerOutputPath = path.join(__dirname, "challenger_system_prompt.md");
  const resourcesPath        = path.join(__dirname, "resources.md");
  const notesPath            = path.join(__dirname, "challenger_notes.md");

  const currentPrompt  = fs.readFileSync(currentPromptPath, "utf8");
  const resourcesContent = fs.existsSync(resourcesPath)
    ? fs.readFileSync(resourcesPath, "utf8")
    : "No prior learnings yet.";
  const notesContent = fs.existsSync(notesPath)
    ? fs.readFileSync(notesPath, "utf8")
    : "No per-scenario notes. Still: never reduce product-suggestion behaviour.";

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

  const validate     = process.env.CHALLENGER_VALIDATE !== "0";
  const maxRegen     = Math.max(1, parseInt(process.env.CHALLENGER_MAX_REGEN || "3", 10));
  const scenarios    = JSON.parse(fs.readFileSync(path.join(__dirname, "test_scenarios.json"), "utf8"));

  let baselineData       = null;   // scored once, reused across regeneration attempts
  let regressionFeedback = null;

  for (let attempt = 1; attempt <= maxRegen; attempt++) {
    if (validate && attempt > 1) {
      console.log(`\n  Regenerating challenger (attempt ${attempt}/${maxRegen}) — previous attempt regressed product/completeness.`);
    }

    const promptText = buildChallengerPrompt({
      currentPrompt, overallAverage, failedScenarios, weakestDimensions,
      resourcesContent, notesContent, regressionFeedback,
    });

    let challengerText;
    try {
      challengerText = await generateOnce(promptText, challengerOutputPath);
    } catch (err) {
      console.error(`  Challenger generation failed: ${err.message}`);
      process.exit(1);
    }

    // No-validation mode: emit once, no scoring, no extra API calls.
    if (!validate) {
      console.log(`\n  Challenger saved (validation disabled) → execution/challenger_system_prompt.md\n`);
      return challengerOutputPath;
    }

    // Score baseline once, then this challenger, and check the protected dimensions.
    try {
      if (!baselineData) {
        console.log(`\n  Scoring baseline for per-scenario regression guard...`);
        baselineData = await runTests(scenarios, currentPrompt, "baseline-guard");
      }
      console.log(`\n  Scoring challenger (attempt ${attempt}) for per-scenario regression guard...`);
      const challengerData = await runTests(scenarios, challengerText, "challenger-guard");

      const regressions = productRegressions(baselineData, challengerData);
      if (regressions.length === 0) {
        console.log(`\n  Challenger passes the guard — no product_quality/completeness regression on any scenario.`);
        console.log(`  Challenger saved → execution/challenger_system_prompt.md\n`);
        return challengerOutputPath;
      }

      console.warn(`\n  Challenger REJECTED — product/completeness regressions on ${regressions.length} scenario-dimension(s):`);
      regressions.forEach(r => console.warn(`    - ${r}`));
      regressionFeedback = regressions.map(r => `  - ${r}`).join("\n");
    } catch (err) {
      // Scoring failed (e.g. API/credit error). Do not silently ship an unguarded
      // challenger — surface it and keep the last generated file for inspection.
      console.error(`\n  Regression guard could not score the challenger: ${err.message}`);
      console.error(`  Challenger left at execution/challenger_system_prompt.md but was NOT validated.`);
      return challengerOutputPath;
    }
  }

  console.warn(`\n  Max regeneration attempts (${maxRegen}) reached — last challenger still regresses a protected dimension.`);
  console.warn(`  Keeping the last attempt at execution/challenger_system_prompt.md; comparison will likely keep the baseline.\n`);
  return challengerOutputPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateChallenger().catch(err => { console.error(err); process.exit(1); });
}
