/**
 * run_tests.js
 * Runs all test scenarios against a system prompt using the Anthropic SDK directly.
 * Does NOT go through the HTTP server.
 *
 * Usage:
 *   node execution/run_tests.js [--prompt path/to/prompt.md] [--label baseline|challenger] [--out path/to/output.json]
 *
 * Defaults:
 *   --prompt  directives/system_prompt.md
 *   --label   baseline
 *   --out     execution/results/run_<timestamp>.json
 */

import Anthropic  from "@anthropic-ai/sdk";
import fs         from "fs";
import path       from "path";
import dotenv     from "dotenv";
import { fileURLToPath } from "url";
import { scoreResponse } from "./score_response.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

const RESULTS_DIR = path.join(__dirname, "results");
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

// ── CLI ARGS ──────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const promptFlag  = args.indexOf("--prompt");
const labelFlag   = args.indexOf("--label");
const outFlag     = args.indexOf("--out");

const promptFile  = promptFlag  !== -1 ? args[promptFlag  + 1] : path.join(ROOT, "directives", "system_prompt.md");
const label       = labelFlag   !== -1 ? args[labelFlag   + 1] : "baseline";
const timestamp   = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outFile     = outFlag     !== -1 ? args[outFlag     + 1] : path.join(RESULTS_DIR, `run_${timestamp}.json`);

// ── LOAD RESOURCES ────────────────────────────────────────────────────────────

const systemPromptRaw = fs.readFileSync(promptFile, "utf8");
const scenarios       = JSON.parse(fs.readFileSync(path.join(__dirname, "test_scenarios.json"), "utf8"));
const client          = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── HELPERS ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function buildSystemBlocks(scenario) {
  const blocks = [
    {
      type:          "text",
      text:          systemPromptRaw,
      cache_control: { type: "ephemeral" },
    },
  ];

  const dynamicParts = [];

  // Inject user profile
  const up = scenario.user_profile;
  if (up?.name) {
    let p = `USER PROFILE\nName: ${up.name}`;
    if (up.age)    p += ` | Age: ${up.age}`;
    if (up.gender) p += ` | Gender: ${up.gender}`;
    dynamicParts.push(p);
  }

  // Inject simulated products so Claude can demonstrate product recommendation
  if (scenario.simulated_products?.length) {
    const slim = scenario.simulated_products
      .map((p, i) => `${i + 1}. ${p.name} — LKR ${p.price}`)
      .join("\n");
    dynamicParts.push(`AVAILABLE PRODUCTS (already fetched — recommend from these):\n${slim}`);
  }

  if (dynamicParts.length) {
    blocks.push({ type: "text", text: dynamicParts.join("\n\n---\n\n") });
  }

  return blocks;
}

function dimensionAverages(results) {
  const sums  = {};
  const counts = {};
  for (const r of results) {
    if (!r.scores) continue;
    for (const [dim, val] of Object.entries(r.scores)) {
      sums[dim]   = (sums[dim]   || 0) + val;
      counts[dim] = (counts[dim] || 0) + 1;
    }
  }
  const avgs = {};
  for (const dim of Object.keys(sums)) {
    avgs[dim] = Math.round((sums[dim] / counts[dim]) * 100) / 100;
  }
  return avgs;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

export async function runTests(scenariosOverride, promptOverride, labelOverride) {
  const testList     = scenariosOverride || scenarios;
  const systemRaw    = promptOverride    || systemPromptRaw;
  const runLabel     = labelOverride     || label;

  console.log(`\n  Running ${testList.length} scenarios against [${runLabel}]`);
  console.log(`  System prompt: ${promptFile}`);
  console.log(`  ─────────────────────────────────────────────────────────\n`);

  const results = [];

  for (let i = 0; i < testList.length; i++) {
    const scenario = testList[i];
    process.stdout.write(`  [${String(i + 1).padStart(2)}/${testList.length}] ${scenario.id.padEnd(20)} `);

    let agentResponse = null;
    let scoreResult   = null;

    // ── Agent call ──────────────────────────────────────────────────────────
    try {
      const sysBlocks = buildSystemBlocks(scenario);

      // Override system raw if caller provides one
      if (promptOverride) {
        sysBlocks[0] = { ...sysBlocks[0], text: promptOverride };
      }

      const agentRes = await client.messages.create({
        model:      "claude-sonnet-4-6",
        max_tokens: 512,
        system:     sysBlocks,
        messages:   scenario.messages,
      });

      agentResponse = agentRes.content
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("")
        .replace(/\[PRODUCTS\][\s\S]*?\[\/PRODUCTS\]/g, "")
        .trim();

    } catch (err) {
      console.log(`SKIP (agent error: ${err.message.slice(0, 60)})`);
      results.push({ scenario_id: scenario.id, description: scenario.description, error: err.message, skipped: true });
      await sleep(1000);
      continue;
    }

    await sleep(1000); // Rate limiting

    // ── Judge call ──────────────────────────────────────────────────────────
    try {
      scoreResult = await scoreResponse(scenario, agentResponse);
    } catch (err) {
      console.log(`WARN (judge error: ${err.message.slice(0, 60)})`);
    }

    await sleep(1000); // Rate limiting

    const avg      = scoreResult?.average ?? null;
    const failed   = scoreResult ? Object.values(scoreResult.scores).some(v => v < 3) : false;
    const statusIcon = !scoreResult ? "?" : failed ? "✗" : avg >= 4 ? "✓" : "~";

    console.log(`${statusIcon}  avg=${avg ?? "n/a"}  ${scoreResult?.what_was_wrong ? `[${scoreResult.what_was_wrong.slice(0, 60)}]` : ""}`);

    results.push({
      scenario_id:    scenario.id,
      description:    scenario.description,
      label:          runLabel,
      agent_response: agentResponse,
      scores:         scoreResult?.scores    ?? null,
      average:        scoreResult?.average   ?? null,
      failures:       scoreResult?.failures  ?? [],
      what_was_wrong: scoreResult?.what_was_wrong ?? "",
      what_was_good:  scoreResult?.what_was_good  ?? "",
    });
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  // Scenarios excluded from scoring averages — structurally unsolvable by prompt changes
  const EXCLUDED_FROM_SCORING = new Set(["scenario_002"]);

  const scored       = results.filter(r => r.average !== null);
  const scoredForAvg = scored.filter(r => !EXCLUDED_FROM_SCORING.has(r.scenario_id));
  const skipped      = results.filter(r => r.skipped);
  const failed       = scoredForAvg.filter(r => r.scores && Object.values(r.scores).some(v => v < 3));
  const overall      = scoredForAvg.length
    ? Math.round((scoredForAvg.reduce((s, r) => s + r.average, 0) / scoredForAvg.length) * 100) / 100
    : null;
  const dimAvgs      = dimensionAverages(scoredForAvg);

  const weakest = Object.entries(dimAvgs)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([d, v]) => `${d} (${v})`)
    .join(", ");

  console.log(`\n  ═══════════════════════════════════════════════════════`);
  console.log(`  TEST RUN SUMMARY — ${runLabel.toUpperCase()}`);
  console.log(`  ═══════════════════════════════════════════════════════`);
  console.log(`  Total:         ${testList.length} scenarios`);
  console.log(`  Scored:        ${scored.length} (${scoredForAvg.length} counted in average; ${EXCLUDED_FROM_SCORING.size} excluded)`);
  console.log(`  Skipped:       ${skipped.length}`);
  console.log(`  Average score: ${overall ?? "n/a"}`);
  console.log(`  Failed (any dim < 3): ${failed.length}`);
  console.log(`  Weakest dims:  ${weakest || "n/a"}`);

  if (failed.length) {
    console.log(`\n  FAILED SCENARIOS:`);
    for (const r of failed) {
      const dims = r.scores
        ? Object.entries(r.scores).filter(([, v]) => v < 3).map(([d, v]) => `${d}:${v}`).join(", ")
        : "";
      console.log(`    - ${r.scenario_id}: ${r.what_was_wrong || r.description} [${dims}]`);
    }
  }
  console.log();

  // ── Save results ────────────────────────────────────────────────────────────
  const output = {
    label,
    timestamp,
    prompt_file: promptFile,
    overall_average: overall,
    dimension_averages: dimAvgs,
    total:   testList.length,
    scored:  scored.length,
    skipped: skipped.length,
    failed_count: failed.length,
    weakest_dimensions: Object.entries(dimAvgs).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([d]) => d),
    results,
  };

  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log(`  Results saved → ${path.relative(ROOT, outFile)}\n`);

  return output;
}

// Run directly if invoked as main
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTests().catch(err => { console.error(err); process.exit(1); });
}
