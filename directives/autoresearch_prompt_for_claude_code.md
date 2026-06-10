# Autoresearch Loop — Claude Code Instructions

Copy and paste everything below this line into Claude Code:

---

I want you to build an autonomous prompt refinement loop for my Kapruka shopping agent, inspired by Karpathy's autoresearch methodology. Read every word of this carefully before writing a single line of code.

## Step 0 — Before You Do Anything

1. Read `directives/system_prompt.md` — this is the baseline system prompt you will be improving
2. Read `directives/agent_concept.md` — understand what the agent is and how it should behave
3. Read `directives/onboarding_flow.md` — understand the onboarding logic
4. Only after reading all three, begin building

## The Problem

The shopping agent gives inconsistent responses. Sometimes good, sometimes bad, all over the place. I cannot manually test every scenario and tell it what is good or bad. I need this to run automatically — find what is broken, fix it, and loop. No human in the loop.

## The Concept

Karpathy built a system for improving neural networks where:
1. There is a **baseline** — the current version
2. A **challenger** is generated — a slightly modified version targeting known weaknesses
3. Both are tested against an **objective metric**
4. The **winner becomes the new baseline**
5. **Learnings are logged** to a resources file so future iterations are smarter
6. The loop repeats autonomously

We apply the exact same pattern here:
- His metric (validation loss) → our metric (**response quality score**)
- His thing to modify (hyperparameters) → our thing to modify (**the system prompt**)
- His training run (5 minutes) → our test run (scoring all 20 scenarios)
- His learnings log → our `execution/resources.md`

The loop runs autonomously. Every iteration: test current prompt → identify failures → generate challenger → score both → keep winner → log learnings → repeat.

## The Scoring Method — Second AI As Judge (Critical)

Do NOT use hardcoded scoring rules. That approach cannot measure tone, naturalness, or cultural fit.

Instead, use **a second Claude call as the judge** — this is the "second AI as critic" pattern. For every agent response, make a separate Anthropic API call where Claude acts as an expert evaluator. Give the judge:
- The test scenario (what the user asked)
- The user profile (name, age, gender)
- The expected qualities for this scenario
- The agent's actual response

Ask the judge to score 1-5 on each dimension AND explain its reasoning. The explanation is what gets logged — it tells you exactly what to fix.

**Scoring dimensions:**
- `relevance` — did it actually address what the user said?
- `personalization` — did it use name, age, gender context appropriately?
- `product_quality` — were the suggested products appropriate for this person?
- `tone` — warm, natural, and human — not robotic or corporate?
- `language_match` — did it match the user's language (English / Tanglish / Sinhala)?
- `completeness` — did it move the conversation toward checkout?

**Judge prompt to use inside `score_response.js`:**

```
You are an expert evaluator for a Sri Lankan shopping agent called Kapruka Assistant.

Your job is to score the agent's response to a shopping scenario.

USER PROFILE:
${JSON.stringify(userProfile)}

SCENARIO DESCRIPTION:
${scenario.description}

CONVERSATION:
${JSON.stringify(scenario.messages)}

EXPECTED QUALITIES FOR A GOOD RESPONSE:
${scenario.expected_qualities.join('\n')}

AGENT RESPONSE TO EVALUATE:
${agentResponse}

Score the response 1-5 on each of these dimensions. Be strict — a 5 means genuinely excellent, not just acceptable.

Dimensions:
- relevance: Did it address what the user actually said?
- personalization: Did it use name, age, gender context appropriately?
- product_quality: Were suggested products appropriate for this specific person?
- tone: Was it warm, natural, and human — not robotic or corporate?
- language_match: Did it match the user's language (English / Tanglish / Sinhala)?
- completeness: Did it move toward checkout?

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
  "average": <float>,
  "failures": ["dimension: reason", ...],
  "what_was_wrong": "one sentence summary of the biggest problem if average < 4",
  "what_was_good": "one sentence summary of what worked well"
}
```

## What To Build

### File 1: `execution/test_scenarios.json`

At least 20 realistic shopping conversation scenarios. Cover every edge case:

**Personal shopping:**
- 19-year-old female browsing for herself
- 45-year-old male looking for electronics
- Someone with a very low budget (under 500 LKR)
- Vague request: "just get me something nice"

**Gifting:**
- 25-year-old male sending to his 55-year-old mother in Colombo
- Sending for a birthday with a tight deadline
- Parents' anniversary — sender unsure what to get
- Gift from a child to a parent (age gap dynamic)

**Delivery constraints:**
- "Needs to arrive by this Sunday"
- "Can anything get to Kandy same day?"
- Caller is in London, recipient in Colombo, Vesak is next week

**Multi-item cart:**
- "Can I add a cake and flowers together?"
- User adds item, then asks to add another, then removes one

**Language:**
- Tanglish: "machan I need something for my amma la, her birthday is tomorrow"
- Sinhala: full Sinhala script input
- Mid-conversation language switch

**Edge cases:**
- User changes their mind after adding to cart
- Product category that Kapruka might not carry
- User gives conflicting information
- User asks for something with no budget mentioned

Each scenario structure:
```json
{
  "id": "scenario_001",
  "description": "what this specifically tests",
  "user_profile": { "name": "...", "age": ..., "gender": "..." },
  "messages": [
    { "role": "user", "content": "..." }
  ],
  "expected_qualities": [
    "uses the user's name",
    "suggests products appropriate for a 19-year-old female",
    "..."
  ]
}
```

---

### File 2: `execution/score_response.js`

A Node.js module that exports a single async function `scoreResponse(scenario, userProfile, agentResponse)`.

Internally it makes one Anthropic API call using the judge prompt above with `claude-sonnet-4-20250514`.

Returns the parsed JSON score object.

Handles API errors gracefully — if the judge call fails, return null and log the error. Do not crash.

---

### File 3: `execution/run_tests.js`

A Node.js script that:
1. Loads `test_scenarios.json`
2. Reads the current system prompt from `directives/system_prompt.md`
3. For each scenario: sends the conversation + user profile to the agent via the Anthropic SDK directly (not through the HTTP server — call the SDK directly with the system prompt loaded from the file)
4. Scores each response using `score_response.js`
5. Saves full detailed results to `execution/results/run_[timestamp].json`

Output format for each result:
```json
{
  "scenario_id": "...",
  "description": "...",
  "agent_response": "...",
  "scores": { ... },
  "average": 3.8,
  "failures": [...],
  "what_was_wrong": "..."
}
```

6. After all scenarios, prints a clear summary:
```
=== TEST RUN SUMMARY ===
System prompt version: baseline / challenger
Total scenarios: 20
Average score: 3.6
Failed scenarios (any dimension < 3): 4
Weakest dimensions: tone (avg 2.8), language_match (avg 2.5)

FAILED SCENARIOS:
- scenario_007: Tanglish input — responded in formal English (language_match: 2)
- scenario_012: Vague request — gave generic response, no clarifying question (relevance: 2)
```

---

### File 4: `execution/generate_challenger.js`

A Node.js script that:
1. Reads the current system prompt from `directives/system_prompt.md`
2. Reads the latest results file from `execution/results/` (sorted by timestamp, take the newest)
3. Reads `execution/resources.md`
4. Makes one Anthropic API call asking Claude to generate an improved challenger system prompt

The prompt to generate the challenger:
```
You are an expert prompt engineer. Your job is to improve a system prompt for a Sri Lankan shopping agent.

CURRENT SYSTEM PROMPT:
${currentSystemPrompt}

WHAT FAILED IN THE LATEST TEST RUN:
${failedScenarios}

LEARNINGS FROM PREVIOUS ITERATIONS (what has worked and not worked before):
${resourcesContent}

Your task:
- Make TARGETED improvements only — do not rewrite sections that are working
- Focus specifically on fixing the failed dimensions: ${weakestDimensions}
- Do not change the agent's core personality or structure
- Each change must directly address a specific failure from the test results
- At the end of the system prompt, add a comment block: <!-- CHANGES IN THIS VERSION: bullet list of what you changed and why -->

Return ONLY the improved system prompt text, nothing else.
```

5. Saves the challenger to `execution/challenger_system_prompt.md`
6. Prints what the main changes were (extracted from the comment block)

---

### File 5: `execution/compare_and_promote.js`

A Node.js script that:
1. Runs ALL test scenarios against the **baseline** (`directives/system_prompt.md`) — saves to `execution/results/baseline_[timestamp].json`
2. Runs ALL test scenarios against the **challenger** (`execution/challenger_system_prompt.md`) — saves to `execution/results/challenger_[timestamp].json`
3. Computes average score for each
4. Compares dimension by dimension — not just overall average
5. Decision logic:
   - If challenger average is higher AND does not regress on any previously-passing scenario: **CHALLENGER WINS**
   - If baseline average is higher OR challenger causes regression: **BASELINE HOLDS**
6. If challenger wins: overwrite `directives/system_prompt.md` with the challenger content, append win entry to `execution/resources.md`
7. If baseline holds: delete `execution/challenger_system_prompt.md`, append loss entry to `execution/resources.md`
8. Print clear result:

```
=== COMPARISON RESULT ===
Baseline average: 3.6
Challenger average: 3.9
Winner: CHALLENGER

Improvements:
- language_match: 2.5 → 3.8 (+1.3)
- tone: 2.8 → 3.4 (+0.6)

Regressions: none

CHALLENGER PROMOTED TO BASELINE
```

---

### File 6: `execution/resources.md`

Start with this structure — the loop populates it automatically:

```markdown
# Autoresearch Learnings Log

> This file is automatically updated by the autoresearch loop. Do not edit manually.

## What Works (Confirmed Improvements)
<!-- populated automatically -->

## What Does Not Work (Tried And Discarded)
<!-- populated automatically -->

## Iteration History

| Run # | Date | Baseline Score | Challenger Score | Winner | Key Changes |
|---|---|---|---|---|---|
<!-- populated automatically -->

## Weakest Dimensions Over Time
<!-- populated automatically — track which dimensions keep failing -->
```

---

### File 7: `execution/orchestrator.js`

The master script. One command, one full iteration:

```
Step 1: Run tests on current baseline
Step 2: Check if any scenarios failed — if ALL pass with 4+, print "SYSTEM PROMPT IS EXCELLENT — no changes needed" and exit
Step 3: Generate challenger targeting the failures
Step 4: Compare baseline vs challenger, promote winner
Step 5: Print full iteration summary
Step 6: Exit
```

Print a clean iteration summary at the end:
```
=== ITERATION COMPLETE ===
Run #: 3
Started: [timestamp]
Baseline score going in: 3.6
Result: CHALLENGER PROMOTED
New baseline score: 3.9
Scenarios still failing: 2
Next focus areas: language_match, personalization
Time taken: 4m 32s
```

---

## Verification Plan (Do This Before Considering It Done)

Before you tell me it is built, verify the following:

1. Run `node execution/orchestrator.js` — it must complete one full iteration without crashing
2. Check that `execution/results/` has at least two result files (baseline and challenger)
3. Check that `execution/resources.md` has been updated with one entry
4. Check that `directives/system_prompt.md` has either been updated (if challenger won) or is unchanged (if baseline held)
5. Check that the summary printout is readable and makes sense
6. If anything fails — fix it, update this directive with what you learned, re-run

---

## Environment Variables

`.env` file:
```
ANTHROPIC_API_KEY=your_key_here
```

No other env vars needed — the agent is called via SDK directly, not through HTTP.

---

## Important Rules

1. Never hardcode API keys — always read from `.env`
2. All result files go in `execution/results/` — create the folder if it does not exist
3. The ONLY files permanently modified by the loop are `directives/system_prompt.md` and `execution/resources.md`
4. If a scenario fails due to an actual API error — skip it, log the error, do not count it as a failed scenario
5. Use `claude-sonnet-4-20250514` for everything — both the agent calls AND the judge calls AND the challenger generation
6. Self-anneal: if any script throws an error, fix the script, update this directive with the edge case you found, re-test
7. Rate limiting: add a 1 second delay between API calls to avoid hitting rate limits
8. The judge and the agent are different calls — the agent generates the shopping response, the judge evaluates it. Never mix these up.

---

## The Goal

After 20-30 iterations of this loop, `directives/system_prompt.md` will be significantly better than the starting version — hardened against every edge case, naturally personalized, handles Sinhala and Tanglish, and consistently scores 4+ across all dimensions on every test scenario.

The system improves itself. You just run `node execution/orchestrator.js` and walk away.
