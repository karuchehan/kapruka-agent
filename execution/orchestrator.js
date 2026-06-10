#!/usr/bin/env node
/**
 * orchestrator.js — One command, one full autoresearch iteration.
 *
 * Usage: node execution/orchestrator.js
 *
 * Steps:
 *   1. Run tests on current baseline
 *   2. If all pass with avg ≥ 4.5 → print excellent, exit
 *   3. Generate challenger targeting failures
 *   4. Compare baseline vs challenger, promote winner
 *   5. Print iteration summary
 */

import fs   from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { runTests }           from "./run_tests.js";
import { generateChallenger } from "./generate_challenger.js";
import { compareAndPromote }  from "./compare_and_promote.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

function getRunNumber() {
  const resourcesPath = path.join(__dirname, "resources.md");
  if (!fs.existsSync(resourcesPath)) return 1;
  const content = fs.readFileSync(resourcesPath, "utf8");
  return (content.match(/\| \d+ \| /g) || []).length + 1;
}

async function main() {
  const startTime = Date.now();
  const runNo     = getRunNumber();

  console.log(`\n  ╔══════════════════════════════════════════════════════╗`);
  console.log(`  ║  AUTORESEARCH LOOP — ITERATION ${String(runNo).padEnd(22)}║`);
  console.log(`  ╚══════════════════════════════════════════════════════╝\n`);

  // ── Step 1: Run tests on current baseline ──────────────────────────────────
  console.log("  STEP 1: Testing current baseline\n");
  let baselineData;
  try {
    baselineData = await runTests();
  } catch (err) {
    console.error(`  Baseline test run failed: ${err.message}`);
    process.exit(1);
  }

  const baselineScore = baselineData.overall_average ?? 0;

  // ── Step 2: Check if already excellent ───────────────────────────────────
  const EXCELLENT_THRESHOLD = 4.5;
  if (baselineScore >= EXCELLENT_THRESHOLD && baselineData.failed_count === 0) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  ════════════════════════════════════════════════════`);
    console.log(`  SYSTEM PROMPT IS EXCELLENT — no changes needed`);
    console.log(`  Average score: ${baselineScore} (threshold: ${EXCELLENT_THRESHOLD})`);
    console.log(`  All ${baselineData.total} scenarios passed`);
    console.log(`  Time: ${elapsed}s`);
    console.log(`  ════════════════════════════════════════════════════\n`);
    process.exit(0);
  }

  // ── Step 3: Generate challenger ───────────────────────────────────────────
  console.log("  STEP 2: Generating challenger\n");
  try {
    await generateChallenger();
  } catch (err) {
    console.error(`  Challenger generation failed: ${err.message}`);
    process.exit(1);
  }

  // ── Step 4: Compare and promote ───────────────────────────────────────────
  console.log("  STEP 3: Comparing baseline vs challenger\n");
  let compareResult;
  try {
    compareResult = await compareAndPromote();
  } catch (err) {
    console.error(`  Comparison failed: ${err.message}`);
    process.exit(1);
  }

  // ── Step 5: Iteration summary ─────────────────────────────────────────────
  const elapsed = Date.now() - startTime;
  const mins    = Math.floor(elapsed / 60000);
  const secs    = Math.round((elapsed % 60000) / 1000);

  const newScore     = compareResult.winner === "CHALLENGER"
    ? compareResult.challengerAvg
    : compareResult.baselineAvg;
  const scenariosFailing = compareResult.winner === "CHALLENGER"
    ? (baselineData.failed_count - compareResult.improvements.length)
    : baselineData.failed_count;

  const nextFocus = baselineData.weakest_dimensions?.slice(0, 2).join(", ") || "general quality";

  console.log(`\n  ╔══════════════════════════════════════════════════════╗`);
  console.log(`  ║  ITERATION COMPLETE                                  ║`);
  console.log(`  ╚══════════════════════════════════════════════════════╝`);
  console.log(`  Run #:                ${runNo}`);
  console.log(`  Baseline score:       ${baselineScore}`);
  console.log(`  Result:               ${compareResult.winner === "CHALLENGER" ? "CHALLENGER PROMOTED" : "BASELINE HOLDS"}`);
  console.log(`  New baseline score:   ${newScore}`);
  console.log(`  Scenarios failing:    ${Math.max(0, scenariosFailing)}`);
  console.log(`  Next focus areas:     ${nextFocus}`);
  console.log(`  Time:                 ${mins}m ${secs}s`);
  console.log();
}

main().catch(err => { console.error(err); process.exit(1); });
