/**
 * visual_decision.js
 * Records the human's judgement on the latest visual challenger.
 *
 * Usage:
 *   node execution/visual_decision.js win
 *   node execution/visual_decision.js lose
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const decision = process.argv[2]?.toLowerCase();

if (!decision || !["win", "lose"].includes(decision)) {
  console.error("  Usage: node execution/visual_decision.js win");
  console.error("         node execution/visual_decision.js lose");
  process.exit(1);
}

const challengersDir = path.join(__dirname, "visual_challengers");
const cssPath = path.join(ROOT, "style.css");
const backupPath = path.join(challengersDir, "baseline_backup.css");
const resourcesPath = path.join(__dirname, "visual_resources.md");

// Find latest challenger for metadata
const challengers = fs.existsSync(challengersDir)
  ? fs.readdirSync(challengersDir)
      .filter((f) => f.startsWith("challenger_") && f.endsWith(".css"))
      .sort()
      .reverse()
  : [];

const latestChallenger = challengers[0] || "unknown";
let area = "unknown";
let hypothesis = "unknown";
let cssChange = "";

if (latestChallenger !== "unknown") {
  const content = fs.readFileSync(path.join(challengersDir, latestChallenger), "utf8");
  const areaMatch = content.match(/Area:\s+(.+)/);
  const hypoMatch = content.match(/Hypothesis:\s+(.+)/);
  area = areaMatch ? areaMatch[1].trim() : "unknown";
  hypothesis = hypoMatch ? hypoMatch[1].trim() : "unknown";
  // Extract the CSS override (everything after the header comment block)
  const afterHeader = content.split("*/").slice(1).join("*/").trim();
  cssChange = afterHeader.slice(0, 300).replace(/\n/g, " ").trim();
  if (afterHeader.length > 300) cssChange += "...";
}

// Count iterations for table row number
let iterCount = 0;
if (fs.existsSync(resourcesPath)) {
  const existing = fs.readFileSync(resourcesPath, "utf8");
  iterCount = (existing.match(/\| \d+ \|/g) || []).length;
}
const iterNum = iterCount + 1;

const timestamp = new Date().toISOString().slice(0, 10);

if (decision === "win") {
  // Keep current style.css — challenger is now the new baseline
  console.log("\n  Challenger promoted. Visual baseline updated.\n");

  const approvedSection = `
### Iteration ${iterNum} — ${timestamp} — APPROVED
- **Area:** ${area}
- **Challenger:** ${latestChallenger}
- **Hypothesis:** ${hypothesis}
- **CSS change:** \`${cssChange}\`
`;

  const tableRow = `| ${iterNum} | ${timestamp} | ${area} | ${hypothesis} | ✅ APPROVED |`;

  let resources = fs.readFileSync(resourcesPath, "utf8");
  resources = resources
    .replace("## Approved Changes (What Worked)\n<!-- populated automatically -->",
      `## Approved Changes (What Worked)\n<!-- populated automatically -->\n${approvedSection}`)
    .replace("<!-- populated automatically -->\n\n## Iteration History",
      "<!-- populated automatically -->\n\n## Iteration History")
    .replace(/(\| #.*?\|\n\| --- \| --- \| --- \| --- \| --- \|\n)(<!-- populated automatically -->)/,
      `$1${tableRow}\n$2`);

  fs.writeFileSync(resourcesPath, resources);

  console.log("  visual_resources.md updated with APPROVED entry.\n");

} else {
  // Restore baseline
  if (!fs.existsSync(backupPath)) {
    console.error("  No baseline_backup.css found. Cannot restore.");
    process.exit(1);
  }

  fs.copyFileSync(backupPath, cssPath);
  console.log("\n  Baseline restored. style.css reverted to backup.\n");

  const rejectedSection = `
### Iteration ${iterNum} — ${timestamp} — REJECTED
- **Area:** ${area}
- **Challenger:** ${latestChallenger}
- **Hypothesis:** ${hypothesis}
- **CSS change:** \`${cssChange}\`
- **Reason:** <!-- Add your note here — why did this lose? -->
`;

  const tableRow = `| ${iterNum} | ${timestamp} | ${area} | ${hypothesis} | ❌ REJECTED |`;

  let resources = fs.readFileSync(resourcesPath, "utf8");
  resources = resources
    .replace("## Rejected Changes (What Did Not Work)\n<!-- populated automatically — add a note explaining why -->",
      `## Rejected Changes (What Did Not Work)\n<!-- populated automatically — add a note explaining why -->\n${rejectedSection}`)
    .replace(/(\| #.*?\|\n\| --- \| --- \| --- \| --- \| --- \|\n)(<!-- populated automatically -->)/,
      `$1${tableRow}\n$2`);

  fs.writeFileSync(resourcesPath, resources);

  console.log("  visual_resources.md updated with REJECTED entry.");
  console.log("  → Open execution/visual_resources.md and add a note under the REJECTED entry explaining why it lost.");
  console.log("  → The loop will use that feedback to generate a smarter challenger next time.\n");
}
