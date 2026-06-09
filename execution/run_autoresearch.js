#!/usr/bin/env node
/**
 * Kapruka Agent — Autoresearch Loop
 *
 * Usage:
 *   node execution/run_autoresearch.js
 *   node execution/run_autoresearch.js --url https://your-vercel-url.vercel.app
 *   node execution/run_autoresearch.js --scenario delivery_sunday
 *
 * Reads:  execution/test_scenarios.json
 * Writes: execution/results/run_<timestamp>.json
 *
 * Scoring rubric (1–5 each):
 *   relevance       — addressed the user's actual request
 *   personalization — used name/age/gender context
 *   product_quality — suggested appropriate products
 *   tone            — warm and natural, not robotic
 *   language_match  — matched user's language (English/Tanglish/Sinhala)
 *   completeness    — moved toward checkout
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

// ── CONFIG ────────────────────────────────────────────────────────────────────

const DEFAULT_URL = "http://localhost:3000";

const args     = process.argv.slice(2);
const urlFlag  = args.indexOf("--url");
const BASE_URL = urlFlag !== -1 ? args[urlFlag + 1] : (process.env.AGENT_URL || DEFAULT_URL);

const scenarioFlag    = args.indexOf("--scenario");
const ONLY_SCENARIO   = scenarioFlag !== -1 ? args[scenarioFlag + 1] : null;

const SCENARIOS_FILE  = path.join(__dirname, "test_scenarios.json");
const RESULTS_DIR     = path.join(__dirname, "results");
const SYSTEM_PROMPT   = path.join(ROOT, "directives", "system_prompt.md");

const DIMENSIONS = ["relevance", "personalization", "product_quality", "tone", "language_match", "completeness"];
const FAIL_THRESHOLD = 3;
const DELAY_MS = 1200;   // throttle between calls

// ── HELPERS ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fmt(n) {
  return n.toFixed(2);
}

function bar(score, max = 5, width = 20) {
  const filled = Math.round((score / max) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

// ── CALL THE AGENT ────────────────────────────────────────────────────────────

async function callAgent(scenario) {
  // Build message history from scenario + prepend onboarding context
  const profile = scenario.user_profile || {};
  const onboardingHistory = [];

  if (profile.name) {
    onboardingHistory.push(
      { role: "assistant", content: "Hey! Just a few quick things so I can give you better recommendations. What's your name?" },
      { role: "user",      content: profile.name },
      { role: "assistant", content: `Nice to meet you, ${profile.name}! How old are you?` },
      { role: "user",      content: String(profile.age || "unknown") },
      { role: "assistant", content: "And are you male or female?" },
      { role: "user",      content: profile.gender || "prefer not to say" },
      { role: "assistant", content: `Perfect! So what are we shopping for today, ${profile.name}?` }
    );
  }

  const messages = [...onboardingHistory, ...scenario.messages];

  const res = await fetch(`${BASE_URL}/api/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      userProfile:      profile,
      recipientProfile: scenario.recipient_profile || {},
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

// ── SCORE A RESPONSE ──────────────────────────────────────────────────────────

function scoreResponse(scenario, response) {
  const text    = (response.message || "").toLowerCase();
  const profile = scenario.user_profile || {};
  const input   = scenario.messages[scenario.messages.length - 1].content.toLowerCase();
  const scores  = {};

  // relevance — did it address the request?
  const hasProducts   = response.products && response.products.length > 0;
  const mentionsShop  = text.includes("product") || text.includes("gift") || text.includes("send")
                     || text.includes("cake") || text.includes("flower") || text.includes("chocolate")
                     || text.includes("rs.") || text.includes("rupee") || hasProducts;
  scores.relevance = mentionsShop ? (hasProducts ? 5 : 3) : 2;

  // personalization — used name or demographic context
  const usesName = profile.name && text.includes(profile.name.toLowerCase());
  const genderAware = checkGenderAwareness(profile.gender, text);
  scores.personalization = usesName ? (genderAware ? 5 : 4) : (genderAware ? 3 : 2);

  // product_quality — returned real products
  scores.product_quality = hasProducts
    ? (response.products.every((p) => p.name && p.price) ? 5 : 3)
    : (text.includes("sorry") || text.includes("unfortunately") ? 2 : 1);

  // tone — not robotic
  const robotic = text.includes("i am an ai") || text.includes("as an assistant")
               || text.includes("i cannot") || text.includes("i'm unable");
  const warm    = text.includes("!") || usesName || text.includes("love") || text.includes("perfect");
  scores.tone = robotic ? 1 : (warm ? 5 : 3);

  // language_match — tanglish/sinhala detection
  const isTanglish = /machan|la\b|aiyo|putha|malli|akka|aney|neh\b/i.test(input);
  const isSinhala  = /[඀-෿]/.test(input);
  if (isSinhala) {
    scores.language_match = /[඀-෿]/.test(response.message || "") ? 5 : 1;
  } else if (isTanglish) {
    const tanglishReply = /machan|la\b|aiyo|putha|malli|akka|aney|neh\b/i.test(response.message || "");
    scores.language_match = tanglishReply ? 5 : 3;
  } else {
    scores.language_match = 5;
  }

  // completeness — moves toward checkout
  const hasAction = hasProducts || text.includes("add") || text.includes("cart")
                 || text.includes("checkout") || text.includes("order") || text.includes("deliver")
                 || response.checkoutUrl;
  scores.completeness = hasAction ? 5 : (text.length > 80 ? 3 : 2);

  const avg = DIMENSIONS.reduce((s, d) => s + scores[d], 0) / DIMENSIONS.length;
  const failures = DIMENSIONS.filter((d) => scores[d] < FAIL_THRESHOLD);

  return { scores, avg, failures };
}

function checkGenderAwareness(gender, text) {
  if (!gender) return false;
  if (gender === "female") {
    return text.includes("fashion") || text.includes("cosmetic") || text.includes("jewel")
        || text.includes("handbag") || text.includes("she") || text.includes("her");
  }
  if (gender === "male") {
    return text.includes("electronic") || text.includes("gadget") || text.includes("grooming")
        || text.includes("watch") || text.includes("he ") || text.includes("him");
  }
  return false;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   Kapruka Agent — Autoresearch Loop       ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`Target: ${BASE_URL}/api/chat`);
  if (ONLY_SCENARIO) console.log(`Filter: ${ONLY_SCENARIO}`);
  console.log();

  const { scenarios } = JSON.parse(fs.readFileSync(SCENARIOS_FILE, "utf8"));
  const filtered = ONLY_SCENARIO
    ? scenarios.filter((s) => s.id === ONLY_SCENARIO)
    : scenarios;

  if (!filtered.length) {
    console.error(`No scenarios matched "${ONLY_SCENARIO}"`);
    process.exit(1);
  }

  const runResults = [];
  let totalPassed = 0, totalFailed = 0, totalWeak = 0;

  for (const scenario of filtered) {
    process.stdout.write(`  [${scenario.id}] ... `);

    let response, scoring, error;

    try {
      response = await callAgent(scenario);
      scoring  = scoreResponse(scenario, response);

      const status = scoring.failures.length === 0
        ? "PASS" : scoring.avg >= FAIL_THRESHOLD ? "WEAK" : "FAIL";

      if (status === "PASS")      { totalPassed++; process.stdout.write(`✓  avg ${fmt(scoring.avg)}\n`); }
      else if (status === "WEAK") { totalWeak++;   process.stdout.write(`⚠  avg ${fmt(scoring.avg)} — weak: ${scoring.failures.join(", ")}\n`); }
      else                        { totalFailed++;  process.stdout.write(`✗  avg ${fmt(scoring.avg)} — failed: ${scoring.failures.join(", ")}\n`); }

      runResults.push({ scenario: scenario.id, category: scenario.category, status, scoring, response, error: null });

    } catch (err) {
      totalFailed++;
      error = err.message;
      process.stdout.write(`✗  ERROR: ${error}\n`);
      runResults.push({ scenario: scenario.id, category: scenario.category, status: "ERROR", scoring: null, response: null, error });
    }

    if (filtered.indexOf(scenario) < filtered.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────

  console.log("\n─────────────────────────────────────────────");
  console.log(`  PASS ${totalPassed}  WEAK ${totalWeak}  FAIL ${totalFailed}  TOTAL ${filtered.length}`);
  console.log("─────────────────────────────────────────────\n");

  // Dimension averages
  const dimTotals = Object.fromEntries(DIMENSIONS.map((d) => [d, 0]));
  const scoredCount = runResults.filter((r) => r.scoring).length;

  if (scoredCount > 0) {
    for (const r of runResults.filter((r) => r.scoring)) {
      for (const d of DIMENSIONS) dimTotals[d] += r.scoring.scores[d];
    }
    console.log("  Dimension averages:");
    for (const d of DIMENSIONS) {
      const avg = dimTotals[d] / scoredCount;
      console.log(`    ${d.padEnd(20)} ${bar(avg)} ${fmt(avg)}`);
    }
    console.log();
  }

  // What needs fixing
  const failures = runResults.filter((r) => r.status === "FAIL" || r.status === "ERROR" || r.status === "WEAK");
  if (failures.length > 0) {
    console.log("  Scenarios to improve:");
    for (const r of failures) {
      if (r.status === "ERROR") {
        console.log(`    ✗ ${r.scenario}: ${r.error}`);
      } else {
        console.log(`    ${r.status === "FAIL" ? "✗" : "⚠"} ${r.scenario} — fix: ${r.scoring.failures.join(", ")}`);
      }
    }
    console.log();
  }

  // ── SAVE RESULTS ─────────────────────────────────────────────────────────

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const outFile = path.join(RESULTS_DIR, `run_${timestamp()}.json`);

  const output = {
    runAt:    new Date().toISOString(),
    baseUrl:  BASE_URL,
    summary:  { total: filtered.length, passed: totalPassed, weak: totalWeak, failed: totalFailed },
    dimAvgs:  Object.fromEntries(DIMENSIONS.map((d) => [d, scoredCount ? fmt(dimTotals[d] / scoredCount) : null])),
    results:  runResults,
  };

  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log(`  Results saved → ${path.relative(ROOT, outFile)}\n`);

  if (totalFailed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\nFatal:", err.message);
  process.exit(1);
});
