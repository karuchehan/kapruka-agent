# Directive: Onboarding Flow

## Purpose

Before any shopping begins, the agent collects three pieces of information to personalize the entire experience. This data makes recommendations dramatically more relevant and is also valuable behavioral data for Kapruka.

## What We Collect

- Name
- Age  
- Gender

## What We Do NOT Collect At Onboarding

- Location — collected at checkout when delivery address is actually needed
- Email — not required
- Phone — not required
- Any account or login information

## Why We Collect This (And How To Communicate It)

Tell the user upfront in plain language before asking anything:

> "Just a few quick things so I can give you better recommendations."

That one line is enough. No privacy policy wall, no long explanation. People understand and accept this immediately when the reason is clear and the ask is minimal.

## The Onboarding Conversation

Keep it conversational — three short exchanges, not a form.

**Message 1 (Agent opens with):**
> "Hey! Just a few quick things so I can give you better recommendations. What's your name?"

**Message 2 (after name):**
> "Nice to meet you, [Name]! How old are you?"

**Message 3 (after age):**
> "And are you male or female?"

**Transition (after gender — move straight into shopping):**
> "Perfect! So what are we shopping for today, [Name]?"

Total time to complete onboarding: under 30 seconds. Immediately moves into the shopping experience.

## How The Data Is Used During The Session

**For personal shopping:**
- A 19-year-old female gets suggestions leaning toward fashion, cosmetics, lifestyle
- A 45-year-old male gets suggestions leaning toward electronics, grooming, home
- Age and gender shape both the product categories surfaced and the tone of the responses

**For gifting:**
When the conversation reveals the user is buying for someone else, the agent naturally asks about the recipient too — woven into conversation, not a separate form:

> "Who's the lucky person? And how old are they — and male or female?"

Now the agent knows: a 25-year-old male is buying for a 55-year-old female. The recommendation logic shifts entirely based on that relationship dynamic.

## Data Storage

Stored in JavaScript memory for the session duration:

```javascript
const userProfile = {
  name: '',
  age: null,
  gender: '',        // 'male' or 'female'
};

const recipientProfile = {
  age: null,
  gender: '',
  relationship: '',  // 'mother', 'father', 'friend', etc. — collected conversationally
};
```

Both profiles are injected into every API call as context so the agent always has this information available.

## Value To Kapruka

This onboarding creates first-party demographic data that Kapruka currently has no clean way to collect. Their website only tracks clicks — this agent captures:

- Age and gender distribution of who is shopping
- What age groups buy what categories
- What occasions come up most in conversations
- What people search for that Kapruka might not have
- Relationship between sender and recipient demographics

This is a genuine business intelligence layer on top of the shopping experience. Worth mentioning explicitly in the challenge submission.

## Edge Cases

- User skips or gives vague age (e.g. "I'm old") — accept it gracefully, move on, don't block
- User declines gender — accept it, move on, default to gender-neutral recommendations
- User gives a name that is clearly a nickname or emoji — accept it, use it as-is
- Never re-ask information already given during the same session
