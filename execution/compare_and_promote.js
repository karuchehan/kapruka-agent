/**
 * compare_and_promote.js
 * Runs both baseline and challenger against all scenarios, compares, promotes the winner.
 *
 * Usage: node execution/compare_and_promote.js
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runTests } from "./run_tests.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

const BASELINE_PATH    = path.join(ROOT, "directives", "system_prompt.md");
const CHALLENGER_PATH  = path.join(__dirname, "challenger_system_prompt.md");
const RESOURCES_PATH   = path.join(__dirname, "resources.md");
const RESULTS_DIR      = path.join(__dirname, "results");

if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function appendToResources(entry) {
  if (!fs.existsSync(RESOURCES_PATH)) {
    fs.writeFileSync(RESOURCES_PATH, `# Autoresearch Learnings Log

> This file is automatically updated by the autoresearch loop. Do not edit manually.

## What Works (Confirmed Improvements)
<!-- populated automatically -->

## What Does Not Work (Tried And Discarded)
<!-- populated automatically -->

## Iteration History

| Run | Date | Baseline | Challenger | Winner | Key Changes |
|---|---|---|---|---|---|

## Weakest Dimensions Over Time
<!-- populated automatically -->
`);
  }

  let content = fs.readFileSync(RESOURCES_PATH, "utf8");

  // ── Dimension score table ─────────────────────────────────────────────────
  const allDims = [...new Set([
    ...Object.keys(entry.baselineDims || {}),
    ...Object.keys(entry.challengerDims || {}),
  ])];
  const dimTableRows = allDims.map(d => {
    const b   = entry.baselineDims?.[d]   ?? "—";
    const c   = entry.challengerDims?.[d] ?? "—";
    const diff = (typeof b === "number" && typeof c === "number")
      ? (c - b >= 0.05 ? ` ▲ +${(c - b).toFixed(2)}` : c - b <= -0.05 ? ` ▼ ${(c - b).toFixed(2)}` : " →")
      : "";
    return `| ${d} | ${b} | ${c}${diff} |`;
  }).join("\n");

  // ── Failed scenarios list ─────────────────────────────────────────────────
  const failedList = (entry.failedScenarios || [])
    .map(f => `  - **${f.id}**: ${f.what_was_wrong || f.description} *(dims: ${(f.failures || []).join(", ") || "n/a"})*`)
    .join("\n");

  // ── Challenger changes ────────────────────────────────────────────────────
  const changesBlock = entry.challengerChanges
    ? entry.challengerChanges.split("\n").map(l => `  ${l}`).join("\n")
    : "  (not recorded)";

  // ── Regression reason ─────────────────────────────────────────────────────
  const regressionNote = entry.regressions?.length
    ? `**Blocked by regression:** ${entry.regressions.join("; ")}`
    : entry.winner === "CHALLENGER"
    ? "No regressions — challenger promoted."
    : "Challenger did not exceed baseline average.";

  // ── Full detail block ─────────────────────────────────────────────────────
  const detail = `
### Iteration ${entry.run} — ${entry.date} — Winner: **${entry.winner}**

**Scores:** baseline ${entry.baselineScore} → challenger ${entry.challengerScore}

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
${dimTableRows}

**Baseline failed scenarios (what needed fixing):**
${failedList || "  (none — all passed)"}

**What challenger targeted:**
${changesBlock}

**Outcome:** ${regressionNote}

---
`;

  // Insert under the right section
  if (entry.winner === "CHALLENGER") {
    content = content.replace(
      "## What Works (Confirmed Improvements)\n<!-- populated automatically -->",
      `## What Works (Confirmed Improvements)\n<!-- populated automatically -->${detail}`
    );
  } else {
    content = content.replace(
      "## What Does Not Work (Tried And Discarded)\n<!-- populated automatically -->",
      `## What Does Not Work (Tried And Discarded)\n<!-- populated automatically -->${detail}`
    );
  }

  // ── Iteration history table row ───────────────────────────────────────────
  const tableRow = `| ${entry.run} | ${entry.date} | ${entry.baselineScore} | ${entry.challengerScore} | ${entry.winner} | ${entry.keyChanges} |`;
  content = content.replace(
    /(\| Run \| Date \|.*\|.*\n\|---.*\n)/,
    `$1${tableRow}\n`
  );

  // ── Weakest dimensions tracker ────────────────────────────────────────────
  const weakLine = `- **Run ${entry.run}**: ${(entry.weakestDims || []).join(", ") || "n/a"}`;
  content = content.replace(
    "## Weakest Dimensions Over Time\n<!-- populated automatically -->",
    `## Weakest Dimensions Over Time\n<!-- populated automatically -->\n${weakLine}`
  );

  fs.writeFileSync(RESOURCES_PATH, content);
}

function getRunNumber() {
  if (!fs.existsSync(RESOURCES_PATH)) return 1;
  const content = fs.readFileSync(RESOURCES_PATH, "utf8");
  const rows    = (content.match(/\| \d+ \| /g) || []);
  return rows.length + 1;
}

export async function compareAndPromote() {
  if (!fs.existsSync(CHALLENGER_PATH)) {
    console.error("  No challenger found at execution/challenger_system_prompt.md");
    process.exit(1);
  }

  const ts    = timestamp();
  const runNo = getRunNumber();

  const baselineText    = fs.readFileSync(BASELINE_PATH,   "utf8");
  const challengerText  = fs.readFileSync(CHALLENGER_PATH, "utf8");

  const scenarios = JSON.parse(
    fs.readFileSync(path.join(__dirname, "test_scenarios.json"), "utf8")
  );

  // Run baseline
  console.log("  ── Running BASELINE ────────────────────────────────────────");
  const baselineOut  = path.join(RESULTS_DIR, `baseline_${ts}.json`);
  const baselineData = await runTests(scenarios, baselineText, "baseline");
  fs.writeFileSync(baselineOut, JSON.stringify(baselineData, null, 2));

  // Run challenger
  console.log("  ── Running CHALLENGER ──────────────────────────────────────");
  const challengerOut  = path.join(RESULTS_DIR, `challenger_${ts}.json`);
  const challengerData = await runTests(scenarios, challengerText, "challenger");
  fs.writeFileSync(challengerOut, JSON.stringify(challengerData, null, 2));

  // ── Compare ────────────────────────────────────────────────────────────────
  const bAvg = baselineData.overall_average   ?? 0;
  const cAvg = challengerData.overall_average ?? 0;

  const bDims = baselineData.dimension_averages   || {};
  const cDims = challengerData.dimension_averages || {};

  const improvements = [];
  const regressions  = [];

  for (const dim of Object.keys(bDims)) {
    const diff = (cDims[dim] ?? 0) - (bDims[dim] ?? 0);
    if (diff > 0.1)  improvements.push(`${dim}: ${bDims[dim]} → ${cDims[dim]} (+${diff.toFixed(2)})`);
    if (diff < -0.1) regressions.push(`${dim}: ${bDims[dim]} → ${cDims[dim]} (${diff.toFixed(2)})`);
  }

  // Determine winner: challenger wins only if better overall AND no significant regressions
  const challengerWins = cAvg > bAvg && regressions.length === 0;
  const winner = challengerWins ? "CHALLENGER" : "BASELINE";

  console.log(`\n  ═══════════════════════════════════════════════════════`);
  console.log(`  COMPARISON RESULT — Run #${runNo}`);
  console.log(`  ═══════════════════════════════════════════════════════`);
  console.log(`  Baseline average:   ${bAvg}`);
  console.log(`  Challenger average: ${cAvg}`);
  console.log(`  Winner:             ${winner}`);

  if (improvements.length) {
    console.log(`\n  Improvements:`);
    improvements.forEach(i => console.log(`    + ${i}`));
  }
  if (regressions.length) {
    console.log(`\n  Regressions:`);
    regressions.forEach(r => console.log(`    - ${r}`));
  }

  // ── Promote or discard ────────────────────────────────────────────────────
  if (challengerWins) {
    fs.copyFileSync(CHALLENGER_PATH, BASELINE_PATH);
    fs.unlinkSync(CHALLENGER_PATH);
    console.log(`\n  CHALLENGER PROMOTED TO BASELINE`);
  } else {
    if (fs.existsSync(CHALLENGER_PATH)) fs.unlinkSync(CHALLENGER_PATH);
    console.log(`\n  BASELINE HOLDS — challenger discarded`);
  }

  // ── Extract challenger changes comment ───────────────────────────────────
  let challengerChanges = "(not recorded)";
  try {
    const cText = fs.readFileSync(CHALLENGER_PATH, "utf8");
    const m = cText.match(/<!--\s*CHANGES IN THIS VERSION:([\s\S]*?)-->/);
    if (m) challengerChanges = m[1].trim();
  } catch (_) { /* challenger already deleted if baseline won */ }

  // ── Collect baseline failed scenarios ────────────────────────────────────
  const failedScenarios = (baselineData.results || [])
    .filter(r => !r.skipped && r.scores && Object.values(r.scores).some(v => v < 3))
    .map(r => ({ id: r.scenario_id, what_was_wrong: r.what_was_wrong, failures: r.failures, description: r.description }));

  // ── Update resources ──────────────────────────────────────────────────────
  try {
    appendToResources({
      run:               runNo,
      date:              new Date().toISOString().slice(0, 10),
      baselineScore:     bAvg,
      challengerScore:   cAvg,
      baselineDims:      bDims,
      challengerDims:    cDims,
      winner,
      improvements,
      regressions,
      keyChanges:        improvements.slice(0, 2).join("; ") || regressions.slice(0, 1).join("; ") || "no significant changes",
      challengerChanges,
      failedScenarios,
      weakestDims:       baselineData.weakest_dimensions || [],
    });
  } catch (err) {
    console.error(`  [warn] Could not update resources.md: ${err.message}`);
  }

  return { winner, baselineAvg: bAvg, challengerAvg: cAvg, improvements, regressions, runNo };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  compareAndPromote().catch(err => { console.error(err); process.exit(1); });
}
