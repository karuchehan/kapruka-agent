# Directive: Autonomous Prompt Refinement Loop

## The Concept

Borrowed from Karpathy's autoresearch methodology — but applied to improving the agent's system prompt instead of neural network training. The idea: run the agent against a set of realistic test conversations, evaluate the quality of responses, identify failures, refine the system prompt, and repeat. Autonomously. You wake up to a better agent.

## How It Works

1. Define a set of realistic test scenarios (shopping conversations)
2. Run each scenario through the agent automatically
3. Evaluate each response against a scoring rubric
4. Identify what broke or felt weak
5. Update the system prompt based on findings
6. Re-run and compare
7. Repeat until responses consistently score well

The agent improves itself through iteration — not through manual trial and error.

## Test Scenario Categories

Cover all the main use cases:

**Personal shopping:**
- "I need a birthday gift for myself, I'm into electronics"
- "What's good for a 25-year-old girl who likes fashion?"
- "Show me your best chocolates under 2000 rupees"

**Gifting:**
- "I want to send something to my mum in Colombo for her birthday"
- "My parents' anniversary is this Friday, what should I send?"
- "A gift from a 25-year-old son to a 60-year-old father"

**Delivery constraints:**
- "Needs to arrive by Sunday"
- "Can anything be delivered same day to Kandy?"
- "I'm in London, can I send this for Vesak next week?"

**Multi-item:**
- "Can I send a cake and flowers together?"
- "Add the chocolates to my cart as well"

**Language:**
- Tanglish input: "machan I need a gift for my amma la"
- Sinhala input: test with actual Sinhala script

**Edge cases:**
- User changes their mind mid-conversation
- User asks for something Kapruka doesn't have
- Budget is very low — under 500 rupees
- User gives vague input: "just get me something nice"

## The Evaluation Rubric (Per Response)

Score each response 1-5 on:

| Dimension | What to check |
|---|---|
| Relevance | Did it actually address what the user said? |
| Personalization | Did it use the user's name, age, gender context? |
| Product quality | Were the suggested products actually appropriate? |
| Tone | Did it feel warm and natural, not robotic? |
| Language match | Did it match the user's language (English / Tanglish / Sinhala)? |
| Completeness | Did it move the conversation toward checkout? |

Flag any response that scores below 3 on any dimension — those are the failures to fix.

## The Execution Script

`execution/run_autoresearch.js` — a Node.js script that:

1. Loads all test scenarios from `execution/test_scenarios.json`
2. Calls `/api/chat.js` with each scenario
3. Saves all responses to `execution/results/run_[timestamp].json`
4. Outputs a summary: what passed, what failed, what was weak

Run it with:
```bash
node execution/run_autoresearch.js
```

## The Improvement Loop

After each run:

1. Read the results file
2. Find all responses that scored below 3 on any dimension
3. Identify the pattern — is it always vague inputs that fail? Language switching? Budget constraints?
4. Update `directives/system_prompt.md` with improved instructions for those cases
5. Re-run
6. Compare scores between runs — are they going up?

Over multiple iterations the system prompt becomes hardened against all the edge cases and weak spots.

## The System Prompt File

`directives/system_prompt.md` is the living document that gets refined by this loop. It contains:

- Agent personality and tone instructions
- Onboarding flow instructions
- How to handle gifting vs personal shopping
- Language handling instructions
- How to use the user profile (name, age, gender)
- How to handle delivery constraints
- How to handle multi-item carts
- Edge case handling

This file is what gets read into every API call as the system prompt. It is the thing we are improving.

## Self-Annealing In This Context

When the test runner breaks:
1. Read the error
2. Fix the script
3. Update this directive with the edge case
4. Re-run

When a scenario consistently fails:
1. Identify why — look at the raw response
2. Add specific instruction to system_prompt.md
3. Re-run that scenario
4. Confirm it now passes before moving on

## Goal

By submission day, every test scenario should score 4 or 5 across all dimensions. The agent should handle everything gracefully — vague inputs, language switching, budget constraints, delivery deadlines, multi-item carts, gifting and personal shopping alike.
