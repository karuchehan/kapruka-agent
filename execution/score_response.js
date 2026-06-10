/**
 * score_response.js
 * Scores a single agent response using a second Claude call as judge.
 * Export: scoreResponse(scenario, agentResponse) → { scores, average, failures, what_was_wrong, what_was_good } | null
 */

import Anthropic from "@anthropic-ai/sdk";
import dotenv    from "dotenv";
import path      from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const JUDGE_SYSTEM = `You are an expert evaluator for a Sri Lankan shopping agent called the Kapruka Assistant. You score agent responses strictly and honestly. A score of 5 means genuinely excellent — not merely acceptable. Be strict. Output only valid JSON.`;

export async function scoreResponse(scenario, agentResponse) {
  const judgePrompt = `You are an expert evaluator for a Sri Lankan shopping agent called Kapruka Assistant.

USER PROFILE:
${JSON.stringify(scenario.user_profile)}

SCENARIO DESCRIPTION:
${scenario.description}

CONVERSATION LEADING TO THE RESPONSE:
${JSON.stringify(scenario.messages, null, 2)}

EXPECTED QUALITIES FOR A GOOD RESPONSE:
${scenario.expected_qualities.join("\n")}

AGENT RESPONSE TO EVALUATE:
${agentResponse}

Score the response 1-5 on each dimension. Be strict — a 5 means genuinely excellent.

Dimensions:
- relevance: Did it address what the user actually said? (e.g. 'planting' = plants/gardening, NOT planners)
- personalization: Did it use name, age, gender context appropriately?
- product_quality: Were suggested products appropriate for this specific person and context?
- tone: Was it warm, natural, human — not robotic or corporate?
- language_match: Did it match the user's language register (English / Tanglish / Sinhala)?
- completeness: Did it move the conversation forward toward helping them find something?

Respond ONLY in this exact JSON format, nothing else:
{
  "scores": {
    "relevance": <1-5>,
    "personalization": <1-5>,
    "product_quality": <1-5>,
    "tone": <1-5>,
    "language_match": <1-5>,
    "completeness": <1-5>
  },
  "average": <float to 2 decimal places>,
  "failures": ["dimension: reason", ...],
  "what_was_wrong": "one sentence summary of the biggest problem if average < 4, else empty string",
  "what_was_good": "one sentence summary of what worked well"
}`;

  try {
    const response = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 512,
      system:     JUDGE_SYSTEM,
      messages:   [{ role: "user", content: judgePrompt }],
    });

    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim();

    // Extract JSON from response (handles cases where model wraps in markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON in judge response: ${text.slice(0, 200)}`);

    const parsed = JSON.parse(jsonMatch[0]);

    // Recompute average from scores in case model math is off
    const vals = Object.values(parsed.scores);
    parsed.average = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;

    return parsed;

  } catch (err) {
    console.error(`  [judge error] scenario ${scenario.id}: ${err.message}`);
    return null;
  }
}
