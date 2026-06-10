/**
 * visual_orchestrator.js
 * One command: generate a visual challenger and apply it.
 * Human reviews the result and runs visual_decision.js to judge.
 *
 * Usage:
 *   node execution/visual_orchestrator.js
 *
 * Then:
 *   vercel dev  (review in browser)
 *   node execution/visual_decision.js win    ← promote challenger
 *   node execution/visual_decision.js lose   ← restore baseline
 *
 * Repeat from Step 1 for next iteration.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { generateVisualChallenger } from "./generate_visual_challenger.js";
import { applyVisualChallenger } from "./apply_visual_challenger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

async function main() {
  // Step 1: Generate challenger
  await generateVisualChallenger();

  // Step 2: Apply challenger
  applyVisualChallenger();

  // Step 3: Instructions
  console.log("  ╔══════════════════════════════════════════════════════════╗");
  console.log("  ║  VISUAL CHALLENGER APPLIED                               ║");
  console.log("  ╠══════════════════════════════════════════════════════════╣");
  console.log("  ║                                                          ║");
  console.log("  ║  1. Open your browser at http://localhost:3001           ║");
  console.log("  ║  2. Complete onboarding, search for products             ║");
  console.log("  ║  3. Review the visual change                             ║");
  console.log("  ║                                                          ║");
  console.log("  ║  When ready, run:                                        ║");
  console.log("  ║    node execution/visual_decision.js win                 ║");
  console.log("  ║    node execution/visual_decision.js lose                ║");
  console.log("  ║                                                          ║");
  console.log("  ║  Then run this script again for the next iteration.      ║");
  console.log("  ╚══════════════════════════════════════════════════════════╝\n");
}

main().catch((err) => { console.error(err); process.exit(1); });
