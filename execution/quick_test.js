#!/usr/bin/env node
/**
 * Quick test harness — run before and after every change.
 * Usage: node execution/quick_test.js
 * All 5 must be green before opening the browser.
 */

const BASE = process.env.AGENT_URL || "http://localhost:3002";
const USER = { name: "Chehan", age: 30, gender: "male" };

const TESTS = [
  {
    name: "single-word search",
    body: { messages: [{ role: "user", content: "football" }], userProfile: USER },
    checks: [hasProducts(2), shortMessage(300)],
  },
  {
    name: "natural language gift request",
    body: {
      messages: [{ role: "user", content: "birthday gift for my dad who likes sports, he is 55" }],
      userProfile: USER,
    },
    checks: [hasProducts(2), shortMessage(300)],
  },
  {
    name: "multi-turn context: sports → football",
    body: {
      messages: [
        { role: "user",      content: "i need a gift for my dad, he likes sports stuff" },
        { role: "assistant", content: "What kind of sports does he follow?" },
        { role: "user",      content: "football" },
      ],
      userProfile: USER,
    },
    checks: [hasProducts(2), shortMessage(300)],
  },
  {
    name: "product integrity — id + name + price",
    body: {
      messages: [{ role: "user", content: "chocolate gift" }],
      userProfile: USER,
    },
    checks: [hasProducts(1), productsHaveFields, shortMessage(300)],
  },
  {
    name: "no error field on valid request",
    body: {
      messages: [{ role: "user", content: "flowers for mum" }],
      userProfile: USER,
    },
    checks: [noError, hasProducts(1)],
  },
];

// ── CHECK FACTORIES ───────────────────────────────────────────────────────────

function hasProducts(min) {
  return (d) => {
    const n = (d.products || []).length;
    return n >= min ? null : `expected ≥${min} products, got ${n}`;
  };
}

function shortMessage(max) {
  return (d) => {
    const len = (d.message || "").length;
    return len <= max ? null : `message too long: ${len} chars (max ${max})`;
  };
}

function productsHaveFields(d) {
  const bad = (d.products || []).filter(p => !p.id || !p.name || !(p.price > 0));
  return bad.length === 0 ? null : `${bad.length} product(s) missing id/name/price`;
}

function noError(d) {
  return d.error ? `got error: ${d.error}` : null;
}

// ── RUNNER ────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n  Kapruka Quick Test → ${BASE}\n`);

  let passed = 0, failed = 0;

  for (const t of TESTS) {
    process.stdout.write(`  ${t.name.padEnd(45)} `);
    const start = Date.now();

    let data;
    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(t.body),
        signal:  AbortSignal.timeout(35_000),
      });
      data = await res.json();
    } catch (err) {
      console.log(`FAIL  ${err.message}`);
      failed++;
      continue;
    }

    const elapsed = `${Date.now() - start}ms`;
    const failures = t.checks.map(fn => fn(data)).filter(Boolean);

    if (failures.length === 0) {
      console.log(`PASS  ${elapsed}`);
      passed++;
    } else {
      console.log(`FAIL  ${elapsed}`);
      failures.forEach(f => console.log(`         ↳ ${f}`));
      failed++;
    }
  }

  console.log(`\n  ${passed}/${TESTS.length} passed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
