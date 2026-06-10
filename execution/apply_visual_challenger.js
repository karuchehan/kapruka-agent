/**
 * apply_visual_challenger.js
 * Finds the latest challenger CSS, backs up current style.css, appends the challenger.
 *
 * Usage: node execution/apply_visual_challenger.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

export function applyVisualChallenger() {
  const challengersDir = path.join(__dirname, "visual_challengers");
  const cssPath = path.join(ROOT, "style.css");
  const backupPath = path.join(challengersDir, "baseline_backup.css");

  if (!fs.existsSync(challengersDir)) {
    console.error("  No visual_challengers directory found. Run generate_visual_challenger.js first.");
    process.exit(1);
  }

  // Find latest challenger (sort by filename timestamp descending)
  const challengers = fs.readdirSync(challengersDir)
    .filter((f) => f.startsWith("challenger_") && f.endsWith(".css"))
    .sort()
    .reverse();

  if (!challengers.length) {
    console.error("  No challenger files found. Run generate_visual_challenger.js first.");
    process.exit(1);
  }

  const latestChallenger = challengers[0];
  const challengerPath = path.join(challengersDir, latestChallenger);

  // Read challenger header to show area and hypothesis
  const challengerContent = fs.readFileSync(challengerPath, "utf8");
  const areaMatch = challengerContent.match(/Area:\s+(.+)/);
  const hypothesisMatch = challengerContent.match(/Hypothesis:\s+(.+)/);
  const area = areaMatch ? areaMatch[1].trim() : "unknown";
  const hypothesis = hypothesisMatch ? hypothesisMatch[1].trim() : "unknown";

  // Backup current style.css
  fs.copyFileSync(cssPath, backupPath);
  console.log(`\n  Backup saved → execution/visual_challengers/baseline_backup.css`);

  // Append challenger CSS to style.css
  const currentCSS = fs.readFileSync(cssPath, "utf8");
  const divider = `\n\n/* ── VISUAL CHALLENGER: ${latestChallenger} ── */\n`;
  const challengerCSS = challengerContent
    .split("\n")
    .filter((line) => !line.startsWith("/*") && !line.endsWith("*/") && line.trim() !== "*/")
    .join("\n");

  fs.writeFileSync(cssPath, currentCSS + divider + challengerCSS);

  console.log(`  Challenger applied: ${latestChallenger}`);
  console.log(`  Area:       ${area}`);
  console.log(`  Hypothesis: ${hypothesis}`);
  console.log();
  console.log("  ┌─────────────────────────────────────────────────────────┐");
  console.log("  │  Open vercel dev and review the change in your browser. │");
  console.log("  │                                                         │");
  console.log("  │  When ready, run one of:                                │");
  console.log("  │    node execution/visual_decision.js win                │");
  console.log("  │    node execution/visual_decision.js lose               │");
  console.log("  └─────────────────────────────────────────────────────────┘\n");

  return { challengerPath, area, hypothesis };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  applyVisualChallenger();
}
