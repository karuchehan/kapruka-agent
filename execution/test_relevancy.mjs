// Relevancy filter test — hits LIVE Kapruka MCP (unauthenticated, no Anthropic
// call, zero API cost). Verifies budget extraction + junk/budget filtering on
// real product data. Pure functions below MIRROR lib/productFilter.ts — keep in sync.
//
// Run: node execution/test_relevancy.mjs

const MCP_URL = "https://mcp.kapruka.com/mcp";
const MCP_HDRS = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };

// ── mirrors lib/productFilter.ts ────────────────────────────────────────────
function extractBudget(messages) {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content);
  for (let i = userTexts.length - 1; i >= 0; i--) {
    const t = userTexts[i].toLowerCase();
    const m1 = t.match(
      /(?:under|below|less than|cheaper than|max|maximum|up to|within|budget(?:\s+is|\s+of)?|around|about|no more than)\s*(?:rs\.?|lkr|rupees)?\s*(\d[\d,]*)/
    );
    if (m1) { const n = parseInt(m1[1].replace(/,/g, ""), 10); if (n > 0) return n; }
    const m2 = t.match(/(?:rs\.?|lkr|rupees)?\s*(\d[\d,]*)\s*(?:budget|or less|or below|max|maximum)/);
    if (m2) { const n = parseInt(m2[1].replace(/,/g, ""), 10); if (n > 0) return n; }
  }
  return null;
}
const VENDOR_MARKERS = /\b(?:\(?pvt\)?|ltd|enterprises|traders?|distributors?|holdings|importers?|exporters?)\b/i;
const VENDOR_SUFFIX = /^(?:[\w&.'-]+\s+){0,2}(?:electronics?|trading|stores?|mart|emporium|agencies)$/i;
function isVendorName(name) {
  const n = (name || "").trim();
  if (!n) return true;
  if (VENDOR_MARKERS.test(n)) return true;
  if (VENDOR_SUFFIX.test(n)) return true;
  return false;
}
function isJunkProduct(p) {
  if (!p.image_url || !p.image_url.trim()) return true;
  if (!(p.price > 0)) return true;
  if (isVendorName(p.name)) return true;
  return false;
}
function filterProducts(products, budget) {
  let out = products.filter((p) => !isJunkProduct(p));
  if (budget != null) out = out.filter((p) => p.price <= budget);
  return out;
}
function normaliseProduct(p) {
  const rawPrice = p.price ?? p.sale_price ?? p.regular_price ?? 0;
  const price = typeof rawPrice === "object" ? rawPrice?.amount ?? 0 : rawPrice;
  return {
    id: String(p.id || p.product_id || ""),
    name: String(p.name || p.title || ""),
    price: Number(price),
    image_url: String(p.image_url || p.image || p.thumbnail || ""),
    url: String(p.url || p.product_url || p.link || ""),
  };
}

// ── minimal MCP caller (mirrors route.ts callMCP) ───────────────────────────
async function callMCP(q, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const initResp = await fetch(MCP_URL, {
      method: "POST", headers: MCP_HDRS, signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } },
      }),
    });
    if (!initResp.ok) throw new Error(`MCP init ${initResp.status}`);
    const sessionId = initResp.headers.get("mcp-session-id");
    const toolResp = await fetch(MCP_URL, {
      method: "POST", headers: { ...MCP_HDRS, "Mcp-Session-Id": sessionId }, signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0", id: 2, method: "tools/call",
        params: { name: "kapruka_search_products", arguments: { params: { q, limit: 8, in_stock_only: true, sort: "relevance", response_format: "json" } } },
      }),
    });
    const text = await toolResp.text();
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const payload = JSON.parse(line.slice(6));
      const result = payload.result || {};
      const content = result.content || [];
      if (content[0]?.type === "text") { try { return JSON.parse(content[0].text); } catch { return {}; } }
    }
    return {};
  } finally { clearTimeout(timer); }
}

// ── tests ───────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.log(`  ✗ ${m}`); } };

async function run() {
  // Unit: budget extraction
  console.log("\n[unit] extractBudget");
  ok(extractBudget([{ role: "user", content: "I want earphones under Rs 2000" }]) === 2000, "'under Rs 2000' → 2000");
  ok(extractBudget([{ role: "user", content: "my budget is below 2,000" }]) === 2000, "'below 2,000' → 2000");
  ok(extractBudget([{ role: "user", content: "something around Rs. 500" }]) === 500, "'around Rs. 500' → 500");
  ok(extractBudget([{ role: "user", content: "show me earphones" }]) === null, "no budget → null");

  // Unit: vendor-name detection
  console.log("\n[unit] isVendorName");
  ok(isVendorName("Dinapala Electronics") === true, "'Dinapala Electronics' → vendor");
  ok(isVendorName("ABC Traders (Pvt) Ltd") === true, "'ABC Traders (Pvt) Ltd' → vendor");
  ok(isVendorName("Sigma Distributors") === true, "'Sigma Distributors' → vendor");
  ok(isVendorName("Portable Electronic Digital Weighing Scale 0-10kg") === false, "real product name → not vendor");
  ok(isVendorName("Pocket Scale For Kitchen Medicine Gems Jewelry 200g Max") === false, "real product name → not vendor");
  ok(isVendorName("Marketing Management Book") === false, "'Marketing ... Book' → not vendor (no false positive)");

  // Scenario 1: earphones under Rs 2000
  console.log("\n[scenario 1] earphones under Rs 2000");
  const budget1 = extractBudget([{ role: "user", content: "I want earphones under Rs 2000" }]);
  const r1 = await callMCP("earphones");
  const f1 = filterProducts((r1.results || []).map(normaliseProduct), budget1);
  console.log(`  raw: ${(r1.results || []).length}, after filter: ${f1.length}, budget: ${budget1}`);
  f1.forEach((p) => console.log(`    - ${p.name} @ Rs.${p.price}`));
  ok(f1.every((p) => p.price <= 2000), "all shown products ≤ Rs 2000");
  ok(f1.every((p) => p.image_url && p.image_url.trim()), "no image-less vendor listings");
  ok(f1.every((p) => p.price > 0), "no zero-price junk");

  // Scenario 2: portable scales — no vendor listings
  console.log("\n[scenario 2] portable scales");
  const r2 = await callMCP("portable scales");
  const raw2 = (r2.results || []).map(normaliseProduct);
  const f2 = filterProducts(raw2, null);
  const dropped = raw2.filter((p) => isJunkProduct(p));
  console.log(`  raw: ${raw2.length}, after filter: ${f2.length}, dropped junk: ${dropped.length}`);
  dropped.forEach((p) => console.log(`    DROPPED: ${p.name} @ Rs.${p.price} (img:${p.image_url ? "y" : "n"})`));
  f2.forEach((p) => console.log(`    - ${p.name} @ Rs.${p.price}`));
  ok(f2.every((p) => p.image_url && p.image_url.trim()), "no image-less results");
  ok(f2.every((p) => p.price > 0), "no zero/negative-price results");

  // Scenario 3: impossible budget → zero results within budget
  console.log("\n[scenario 3] earphones under Rs 1 (impossible budget)");
  const r3 = await callMCP("earphones");
  const f3 = filterProducts((r3.results || []).map(normaliseProduct), 1);
  console.log(`  after filter @ budget Rs.1: ${f3.length}`);
  ok(f3.length === 0, "zero results within impossible budget (agent must say so, not show junk)");

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
run().catch((e) => { console.error("test error:", e.message); process.exit(1); });
