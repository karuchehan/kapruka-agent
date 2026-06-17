#!/usr/bin/env node
/**
 * orchestrator.js — Autonomous 10-iteration autoresearch loop (Karpathy-style)
 *
 * Usage:
 *   node execution/orchestrator.js --dry-run   # score baseline + challenger, print table, no promotion
 *   node execution/orchestrator.js             # run all 10 iterations autonomously
 *
 * Loop logic per iteration:
 *   1. Read current baseline from directives/system_prompt.md
 *   2. Score baseline across all scenarios
 *   3. Generate challenger (targeting weakest scenarios from baseline run)
 *   4. Score challenger across all scenarios
 *   5. No-regression check: if ANY scenario with baseline avg >= 4.0 drops below 4.0 in challenger → reject
 *   6. If passes no-regression AND challenger avg > baseline avg → promote; overwrite system_prompt.md
 *   7. Append to resources.md: scores, dimensions, outcome, learnings
 *   8. Repeat. Exit early if 5 consecutive rejections (stall).
 *
 * Termination:
 *   - 10 iterations reached, OR
 *   - 5 consecutive rejections → "Loop stalled" logged, early exit, OR
 *   - overall avg >= TARGET_SCORE
 */

import fs   from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { runTests }           from "./run_tests.js";
import { generateChallenger } from "./generate_challenger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

// Disable generate_challenger's internal product/completeness regression guard.
// The orchestrator owns ALL regression logic via the per-scenario average check below.
process.env.CHALLENGER_VALIDATE = "0";

const MAX_ITERATIONS   = 10;
const STALL_LIMIT      = 5;
const REGRESSION_GUARD = 4.0;  // scenario avg must not fall below this if baseline was at or above it
const TARGET_SCORE     = 4.6;  // stop early if reached

// Scenarios excluded from overall average and no-regression checks.
// These have structural gaps (Kapruka doesn't stock the category) that no prompt change can fix.
const EXCLUDED_SCENARIOS = new Set(["scenario_002"]);

const BASELINE_PATH   = path.join(ROOT, "directives", "system_prompt.md");
const CHALLENGER_PATH = path.join(__dirname, "challenger_system_prompt.md");
const RESOURCES_PATH  = path.join(__dirname, "resources.md");

// ── Run-number helper ──────────────────────────────────────────────────────────
// Uses date-anchored pattern to match only Iteration History rows, not dimension rows.
function getNextRunNumber() {
  if (!fs.existsSync(RESOURCES_PATH)) return 1;
  const content = fs.readFileSync(RESOURCES_PATH, "utf8");
  const matches = content.match(/\| (\d+) \| \d{4}-\d{2}-\d{2} \| /g) || [];
  const maxRun  = matches.reduce((max, m) => {
    const hit = m.match(/\| (\d+) \| /);
    const n   = hit ? parseInt(hit[1], 10) : 0;
    return Math.max(max, n);
  }, 0);
  return maxRun + 1;
}

// ── Per-scenario no-regression check ──────────────────────────────────────────
// Returns regressions: scenarios where baseline avg >= REGRESSION_GUARD
//                       AND challenger avg < REGRESSION_GUARD
function checkPerScenarioRegression(baselineData, challengerData) {
  const baselineMap = Object.fromEntries(
    (baselineData.results || [])
      .filter(r => typeof r.average === "number")
      .map(r => [r.scenario_id, r.average])
  );

  const regressions = [];
  for (const r of (challengerData.results || [])) {
    if (typeof r.average !== "number") continue;
    if (EXCLUDED_SCENARIOS.has(r.scenario_id)) continue;
    const bAvg = baselineMap[r.scenario_id];
    if (typeof bAvg !== "number") continue;
    if (bAvg >= REGRESSION_GUARD && r.average < REGRESSION_GUARD) {
      regressions.push({
        id:         r.scenario_id,
        baseline:   Math.round(bAvg * 100) / 100,
        challenger: Math.round(r.average * 100) / 100,
        delta:      Math.round((r.average - bAvg) * 100) / 100,
      });
    }
  }
  return regressions;
}

// ── Score comparison table ─────────────────────────────────────────────────────
function printScoreTable(baselineData, challengerData, regressions) {
  const cMap   = Object.fromEntries(
    (challengerData.results || [])
      .filter(r => typeof r.average === "number")
      .map(r => [r.scenario_id, r.average])
  );
  const regSet = new Set((regressions || []).map(r => r.id));

  const SEP = "  ├─────────────────────────┼──────────┼──────────┼──────────┼────────┤";

  console.log("  ┌─────────────────────────┬──────────┬──────────┬──────────┬────────┐");
  console.log("  │ Scenario                │ Baseline │Challenger│  Delta   │ Status │");
  console.log(SEP);

  let sumB = 0, sumC = 0, n = 0;

  for (const r of (baselineData.results || [])) {
    if (typeof r.average !== "number") continue;
    const isExcluded = EXCLUDED_SCENARIOS.has(r.scenario_id);
    const cAvg  = typeof cMap[r.scenario_id] === "number" ? cMap[r.scenario_id] : null;
    const delta = cAvg !== null ? cAvg - r.average : null;

    const dStr  = isExcluded ? " (excl)".padStart(7) :
                  delta !== null
                    ? (delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)).padStart(7)
                    : "   n/a ".padStart(7);

    const flag  = isExcluded ? " EXCL " :
                  regSet.has(r.scenario_id) ? " ⚠ REG" :
                  delta === null             ? "  ----" :
                  delta >  0.05              ? " ▲ UP " :
                  delta < -0.05              ? " ▼ DWN" : "   =  ";

    const id    = r.scenario_id.padEnd(23);
    const bStr  = r.average.toFixed(2).padStart(7);
    const cStr  = cAvg !== null ? cAvg.toFixed(2).padStart(7) : "    n/a";

    console.log(`  │ ${id} │ ${bStr}  │ ${cStr}  │ ${dStr}  │${flag} │`);

    if (!isExcluded) {
      sumB += r.average;
      if (cAvg !== null) sumC += cAvg;
      n++;
    }
  }

  console.log(SEP);
  if (n > 0) {
    const avgB  = (sumB / n).toFixed(2).padStart(7);
    const avgC  = (sumC / n).toFixed(2).padStart(7);
    const avgD  = (sumC - sumB) / n;
    const avgDs = (avgD >= 0 ? `+${avgD.toFixed(2)}` : avgD.toFixed(2)).padStart(7);
    console.log(`  │ OVERALL                  │ ${avgB}  │ ${avgC}  │ ${avgDs}  │        │`);
  }
  console.log("  └─────────────────────────┴──────────┴──────────┴──────────┴────────┘");
  console.log();
}

// ── resources.md update ────────────────────────────────────────────────────────
function appendToResources(entry) {
  if (!fs.existsSync(RESOURCES_PATH)) return;
  let content = fs.readFileSync(RESOURCES_PATH, "utf8");

  // Dimension score table
  const allDims = [...new Set([
    ...Object.keys(entry.baselineDims || {}),
    ...Object.keys(entry.challengerDims || {}),
  ])];
  const dimRows = allDims.map(d => {
    const b    = entry.baselineDims?.[d]   ?? "—";
    const c    = entry.challengerDims?.[d] ?? "—";
    const diff = (typeof b === "number" && typeof c === "number")
      ? (c - b >= 0.05 ? ` ▲ +${(c-b).toFixed(2)}` : c - b <= -0.05 ? ` ▼ ${(c-b).toFixed(2)}` : " →")
      : "";
    return `| ${d} | ${b} | ${c}${diff} |`;
  }).join("\n");

  // Failed scenario list
  const failedList = (entry.failedScenarios || [])
    .map(f => `  - **${f.id}**: ${f.what_was_wrong || f.description} *(dims: ${(f.failures || []).join(", ") || "n/a"})*`)
    .join("\n") || "  (none — all passed)";

  // Outcome note
  const regressionNote = entry.regressions?.length
    ? `**Blocked by no-regression rule (per-scenario avg ≥ 4.0):** ${entry.regressions.map(r => `${r.id} ${r.baseline}→${r.challenger}`).join("; ")}`
    : entry.winner === "CHALLENGER"
    ? "No regressions — challenger promoted."
    : `Challenger avg ${entry.challengerScore} did not exceed baseline ${entry.baselineScore}.`;

  const detail = `
### Iteration ${entry.run} — ${entry.date} — Winner: **${entry.winner}**

**Scores:** baseline ${entry.baselineScore} → challenger ${entry.challengerScore}

**Dimension breakdown:**

| Dimension | Baseline | Challenger |
|---|---|---|
${dimRows}

**Baseline failed scenarios (what needed fixing):**
${failedList}

**Outcome:** ${regressionNote}

---
`;

  // Insert at top of correct section (newest first)
  const workSection   = "## What Works (Confirmed Improvements)\n<!-- populated automatically -->";
  const rejectSection = "## What Does Not Work (Tried And Discarded)\n<!-- populated automatically -->";
  const section       = entry.winner === "CHALLENGER" ? workSection : rejectSection;

  if (content.includes(section)) {
    content = content.replace(section, `${section}${detail}`);
  } else {
    content += detail;
  }

  // Iteration history table row (insert at top of table body)
  const tableRow = `| ${entry.run} | ${entry.date} | ${entry.baselineScore} | ${entry.challengerScore} | ${entry.winner} | ${entry.keyChanges} |`;
  content = content.replace(
    /(\| Run \| Date \|.*\|\n\|---.*\|\n)/,
    `$1${tableRow}\n`
  );

  // Weakest dimensions tracker (insert at top)
  const weakLine  = `- **Run ${entry.run}**: ${(entry.weakestDims || []).join(", ") || "n/a"}`;
  const weakAnchor = "## Weakest Dimensions Over Time\n<!-- populated automatically -->";
  if (content.includes(weakAnchor)) {
    content = content.replace(weakAnchor, `${weakAnchor}\n${weakLine}`);
  }

  fs.writeFileSync(RESOURCES_PATH, content);
}

// ── One iteration ──────────────────────────────────────────────────────────────
async function runIteration(label) {
  // Always read baseline from disk — avoids stale module-level cache after promotion
  const baselineText = fs.readFileSync(BASELINE_PATH, "utf8");

  console.log(`\n  [${label}] Step 1 — Scoring baseline`);
  const baselineData = await runTests(null, baselineText, "baseline");
  const weakDims     = baselineData.weakest_dimensions?.join(", ") || "general";

  console.log(`\n  [${label}] Step 2 — Generating challenger (targeting: ${weakDims})`);
  await generateChallenger();

  if (!fs.existsSync(CHALLENGER_PATH)) {
    throw new Error("Challenger file missing after generation");
  }

  console.log(`\n  [${label}] Step 3 — Scoring challenger`);
  const challengerText = fs.readFileSync(CHALLENGER_PATH, "utf8");
  const challengerData = await runTests(null, challengerText, "challenger");

  // Use overall_average from run_tests (already excludes EXCLUDED_SCENARIOS via scoredForAvg)
  const bAvg = baselineData.overall_average   ?? 0;
  const cAvg = challengerData.overall_average ?? 0;

  // No-regression check
  const regressions = checkPerScenarioRegression(baselineData, challengerData);

  // Winner determination
  let winner, rejectReason;
  if (regressions.length > 0) {
    winner       = "BASELINE";
    rejectReason = `No-regression rule: ${regressions.map(r => `${r.id}(${r.baseline}→${r.challenger})`).join(", ")}`;
  } else if (cAvg > bAvg) {
    winner       = "CHALLENGER";
    rejectReason = null;
  } else {
    winner       = "BASELINE";
    rejectReason = `Challenger avg ${cAvg.toFixed(2)} ≤ baseline ${bAvg.toFixed(2)}`;
  }

  return { winner, bAvg, cAvg, regressions, rejectReason, baselineData, challengerData };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log(`\n  ╔═══════════════════════════════════════════════════════╗`);
  if (isDryRun) {
    console.log(`  ║  AUTORESEARCH — DRY RUN (iteration 1, no promotion)   ║`);
  } else {
    console.log(`  ║  AUTORESEARCH LOOP — ${MAX_ITERATIONS} iterations, fully autonomous    ║`);
  }
  console.log(`  ╚═══════════════════════════════════════════════════════╝\n`);

  // ── Dry run ─────────────────────────────────────────────────────────────────
  if (isDryRun) {
    const result = await runIteration("DRY RUN");

    console.log("\n  ── Score Table: Baseline vs Challenger (all scenarios) ────────────");
    printScoreTable(result.baselineData, result.challengerData, result.regressions);

    const verdict = result.winner === "CHALLENGER"
      ? `✓  Would PROMOTE: avg ${result.bAvg.toFixed(2)} → ${result.cAvg.toFixed(2)}`
      : `✗  Would REJECT: ${result.rejectReason}`;
    console.log(`  ${verdict}`);

    if (result.regressions.length) {
      console.log(`\n  Regressions (per-scenario avg dropped below ${REGRESSION_GUARD}):`);
      result.regressions.forEach(r =>
        console.log(`    - ${r.id}: ${r.baseline} → ${r.challenger} (${r.delta})`)
      );
    }

    console.log(`\n  Challenger preserved: execution/challenger_system_prompt.md`);
    console.log(`  resources.md NOT updated. directives/system_prompt.md NOT modified.`);
    console.log(`\n  To run the full ${MAX_ITERATIONS}-iteration loop (after confirming):`);
    console.log(`    node execution/orchestrator.js\n`);
    return;
  }

  // ── Full autonomous loop ─────────────────────────────────────────────────────
  const startRun  = getNextRunNumber();
  let consecutiveRejections = 0;
  const loopStart = Date.now();

  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    const runNo     = startRun + iter - 1;
    const iterStart = Date.now();

    console.log(`\n  ${"═".repeat(58)}`);
    console.log(`  ITERATION ${iter} / ${MAX_ITERATIONS}  (history run #${runNo})`);
    console.log(`  ${"═".repeat(58)}`);

    let result;
    try {
      result = await runIteration(`iter ${iter}`);
    } catch (err) {
      console.error(`  Iteration ${iter} error: ${err.message}`);
      consecutiveRejections++;
      if (consecutiveRejections >= STALL_LIMIT) break;
      continue;
    }

    // Print score table
    console.log("\n  Score Table:");
    printScoreTable(result.baselineData, result.challengerData, result.regressions);

    // Promote or discard
    if (result.winner === "CHALLENGER") {
      fs.copyFileSync(CHALLENGER_PATH, BASELINE_PATH);
      console.log(`  ✓  CHALLENGER PROMOTED → directives/system_prompt.md`);
      console.log(`     ${result.bAvg.toFixed(2)} → ${result.cAvg.toFixed(2)}`);
      consecutiveRejections = 0;
    } else {
      console.log(`  ✗  BASELINE HOLDS — ${result.rejectReason}`);
      consecutiveRejections++;
    }

    // Cleanup challenger file
    if (fs.existsSync(CHALLENGER_PATH)) fs.unlinkSync(CHALLENGER_PATH);

    // Build summary fields for resources.md
    const bDims          = result.baselineData.dimension_averages  || {};
    const cDims          = result.challengerData.dimension_averages || {};
    const failedScenarios = (result.baselineData.results || [])
      .filter(r => !r.skipped && r.scores && Object.values(r.scores).some(v => v < 3))
      .map(r => ({ id: r.scenario_id, what_was_wrong: r.what_was_wrong, failures: r.failures, description: r.description }));
    const improvements   = Object.keys(bDims)
      .filter(d => (cDims[d] ?? 0) - (bDims[d] ?? 0) > 0.1)
      .map(d => `${d}: ${bDims[d]}→${cDims[d]}`);

    try {
      appendToResources({
        run:             runNo,
        date:            new Date().toISOString().slice(0, 10),
        baselineScore:   result.bAvg,
        challengerScore: result.cAvg,
        baselineDims:    bDims,
        challengerDims:  cDims,
        winner:          result.winner,
        regressions:     result.regressions,
        failedScenarios,
        keyChanges:      improvements.slice(0, 2).join("; ") || result.rejectReason?.slice(0, 80) || "n/a",
        weakestDims:     result.baselineData.weakest_dimensions || [],
      });
      console.log("  resources.md updated.");
    } catch (err) {
      console.error(`  [warn] resources.md update failed: ${err.message}`);
    }

    // Stall check
    if (consecutiveRejections >= STALL_LIMIT) {
      const stallMsg = `\n## LOOP STALLED — iteration ${iter} (${new Date().toISOString().slice(0, 10)}) — ${STALL_LIMIT} consecutive rejections before loop completed\n`;
      try { fs.appendFileSync(RESOURCES_PATH, stallMsg); } catch (_) {}
      console.log(`\n  LOOP STALLED — ${STALL_LIMIT} consecutive rejections. Exiting early at iteration ${iter}.`);
      break;
    }

    // Target check
    const currentScore = result.winner === "CHALLENGER" ? result.cAvg : result.bAvg;
    if (currentScore >= TARGET_SCORE) {
      console.log(`\n  TARGET REACHED — score ${currentScore.toFixed(2)} ≥ ${TARGET_SCORE}. Stopping.`);
      break;
    }

    const iterSecs = Math.round((Date.now() - iterStart) / 1000);
    console.log(`\n  Iteration ${iter} complete — ${Math.floor(iterSecs / 60)}m ${iterSecs % 60}s`);
  }

  const totalSecs = Math.round((Date.now() - loopStart) / 1000);
  console.log(`\n  ${"═".repeat(58)}`);
  console.log(`  AUTORESEARCH LOOP COMPLETE — ${Math.floor(totalSecs / 60)}m ${totalSecs % 60}s`);
  console.log(`  ${"═".repeat(58)}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
