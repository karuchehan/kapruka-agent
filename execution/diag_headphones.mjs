// DIAGNOSTIC ONLY — live Kapruka MCP, no Anthropic call. Traces the full
// route.ts path for a "headphones under Rs 20000" message:
//   query building → raw MCP results → junk filter → budget filter
// Replicates the exact STOP/CONTEXT sets + functions from route.ts & productFilter.ts.
//
// Run: node execution/diag_headphones.mjs

const MCP_URL = "https://mcp.kapruka.com/mcp";
const MCP_HDRS = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };

// ── verbatim from route.ts ──────────────────────────────────────────────────
const STOP = new Set([
  "i","me","my","the","a","an","is","are","was","were","be","been","have",
  "has","had","do","does","did","will","would","could","should","can","may",
  "might","for","to","in","on","at","by","with","from","of","and","or","but",
  "not","it","its","he","she","they","we","you","who","what","where","when",
  "how","this","that","these","those","need","want","looking","get","buy",
  "find","show","give","help","please","okay","ok","yeah","really","just",
  "also","too","so","as","if","than","very","some","any","all","about","into",
  "like","loves","old","years","year","something","someone","anything","that",
  "think","know","see","let","go","use","try","make","take","put","say","ask",
  "tell","feel","look","here","there","now","then","up","down","out","off","over",
  "under","again","further","once","him","her","his","their","them","our","your",
  "its","was","has","been","being","am","an","each","few","more","most","other",
  "such","own","same","than","too","very","just","because","until","while",
  "both","through","during","before","after","above","below","between","into",
  "through","during","before","after","above","below","between","since","without",
  "within","along","following","across","behind","beyond","plus","except","however",
  "day","today","tomorrow","yesterday","week","month","soon","next","last","time",
  "rs","lkr","rupees","rupee","budget","price","priced","cost","costs",
  "stuff","things","thing","kind","types","type","bit","lot","way",
  "no","hi","lo","ah","aw","uh","um","ha","oh","oi",
]);
const CONTEXT_WORDS = new Set([
  "gift","gifts","present","presents","surprise","buy","purchase","send","order",
  "birthday","anniversary","christmas","valentine","wedding","graduation","newborn",
  "mother","father","dad","mum","mom","sister","brother","friend","wife","husband",
  "boyfriend","girlfriend","aunt","uncle","grandma","grandpa","colleague","boss",
  "amma","thatha","akka","aiya","nangi","malli","duwa","putha","nona","mahattaya",
  "loves","like","enjoy","enjoy","needs","want","wants","prefer","prefers",
  "something","nice","good","great","perfect","special","best","awesome","wonderful",
  "looking","find","get","show","help","give","recommend","suggest",
  "years","old","aged","aged","male","female","man","woman","boy","girl","person",
  "celebrate","celebrating","occasion","event","party","ceremony",
  "abroad","international","overseas","overseas","deliver","delivery","send",
  "lucky","sweet","love",
  "colombo","kandy","galle","negombo","jaffna","matara","ratnapura","kurunegala",
  "anuradhapura","polonnaruwa","badulla","nuwara","eliya","trincomalee","batticaloa",
  "ampara","kalmunai","vavuniya","mannar","puttalam","chilaw","kalutara","panadura",
  "moratuwa","dehiwala","mount","lavinia","nugegoda","kottawa","kaduwela","kadawatha",
  "maharagama","piliyandala","homagama","bandaragama","beruwala","aluthgama","hikkaduwa",
  "tangalle","hambantota","matale","dambulla","sigiriya","haputale","ella","bandarawela",
]);
function extractKeywords(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w) && !CONTEXT_WORDS.has(w) && !/^\d+$/.test(w))
    .slice(0, 7);
}
function buildSearchQuery(messages) {
  const userMessages = messages.filter((m) => m.role === "user");
  const lastMsg = userMessages[userMessages.length - 1];
  if (!lastMsg) return "";
  const currentKws = extractKeywords(lastMsg.content);
  if (currentKws.length >= 1) return currentKws.slice(0, 5).join(" ");
  const prevReal = userMessages.slice(0, -1).filter((m) => m.content.trim().split(/\s+/).length >= 5);
  const prev = prevReal[prevReal.length - 1];
  return prev ? extractKeywords(prev.content).slice(0, 5).join(" ") : "";
}

// ── verbatim from lib/productFilter.ts ──────────────────────────────────────
function extractBudget(messages) {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content);
  for (let i = userTexts.length - 1; i >= 0; i--) {
    const t = userTexts[i].toLowerCase();
    const m1 = t.match(/(?:under|below|less than|cheaper than|max|maximum|up to|within|budget(?:\s+is|\s+of)?|around|about|no more than)\s*(?:rs\.?|lkr|rupees)?\s*(\d[\d,]*)/);
    if (m1) { const n = parseInt(m1[1].replace(/,/g, ""), 10); if (n > 0) return n; }
    const m2 = t.match(/(?:rs\.?|lkr|rupees)?\s*(\d[\d,]*)\s*(?:budget|or less|or below|max|maximum)/);
    if (m2) { const n = parseInt(m2[1].replace(/,/g, ""), 10); if (n > 0) return n; }
  }
  return null;
}
const VENDOR_MARKERS = /\b(?:\(?pvt\)?|ltd|enterprises|traders?|distributors?|holdings|importers?|exporters?)\b/i;
const VENDOR_SUFFIX = /^(?:[\w&.'-]+\s+){0,2}(?:electronics?|trading|stores?|mart|emporium|agencies)$/i;
function isVendorName(name) { const n = (name || "").trim(); if (!n) return true; if (VENDOR_MARKERS.test(n)) return true; if (VENDOR_SUFFIX.test(n)) return true; return false; }
function isJunkProduct(p) { if (!p.image_url || !p.image_url.trim()) return true; if (!(p.price > 0)) return true; if (isVendorName(p.name)) return true; return false; }
function normaliseProduct(p) {
  const rawPrice = p.price ?? p.sale_price ?? p.regular_price ?? 0;
  const price = typeof rawPrice === "object" ? rawPrice?.amount ?? 0 : rawPrice;
  return {
    id: String(p.id || p.product_id || ""), name: String(p.name || p.title || ""),
    price: Number(price), image_url: String(p.image_url || p.image || p.thumbnail || ""),
    url: String(p.url || p.product_url || p.link || ""),
  };
}

async function callMCP(q, extra = {}) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 9000);
  try {
    const initResp = await fetch(MCP_URL, { method: "POST", headers: MCP_HDRS, signal: c.signal,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "diag", version: "1.0" } } }) });
    const sid = initResp.headers.get("mcp-session-id");
    const toolResp = await fetch(MCP_URL, { method: "POST", headers: { ...MCP_HDRS, "Mcp-Session-Id": sid }, signal: c.signal,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "kapruka_search_products", arguments: { params: { q, limit: 8, in_stock_only: true, sort: "relevance", response_format: "json", ...extra } } } }) });
    const text = await toolResp.text();
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const payload = JSON.parse(line.slice(6));
      if (payload.error) return { __error: payload.error.message };
      const result = payload.result || {};
      if (result.isError) return { __error: result.content?.[0]?.text };
      const content = result.content || [];
      if (content[0]?.type === "text") { try { return JSON.parse(content[0].text); } catch { return { __raw: content[0].text }; } }
    }
    return { __empty: true };
  } finally { clearTimeout(t); }
}

function dump(label, raw) {
  console.log(`\n=== ${label} ===`);
  if (raw.__error) { console.log("MCP ERROR:", raw.__error); return []; }
  if (raw.__raw) { console.log("NON-JSON:", raw.__raw.slice(0, 300)); return []; }
  const results = raw.results || [];
  console.log(`result keys: ${Object.keys(raw).join(", ")} | count: ${results.length}`);
  const norm = results.map(normaliseProduct);
  norm.forEach((p, i) => console.log(`  [${i}] ${p.name} | Rs.${p.price} | img:${p.image_url ? "Y" : "N"} | vendor:${isVendorName(p.name) ? "Y" : "N"}`));
  return norm;
}

async function run() {
  // Q2: what query does the route actually build for the user message?
  const convo = [{ role: "user", content: "I want headphones under Rs 20000" }];
  const query = buildSearchQuery(convo);
  const budget = extractBudget(convo);
  console.log(`USER MSG: "${convo[0].content}"`);
  console.log(`>> buildSearchQuery → "${query}"`);
  console.log(`>> extractBudget   → ${budget}`);

  // Regression guard: currency/budget tokens must NOT leak into the search query.
  if (query !== "headphones") {
    console.error(`\nREGRESSION: query should be "headphones", got "${query}" — currency/budget token leaked into MCP search`);
    process.exit(1);
  }
  console.log("  ✓ no currency-token leak (query is clean 'headphones')");

  // Q1/Q4: raw MCP for the built query + the literal words
  for (const q of [query, "headphones", "headphone", "earphones", "wireless headphones"]) {
    const norm = dump(`MCP raw: "${q}"`, await callMCP(q));
    if (norm.length) {
      const afterJunk = norm.filter((p) => !isJunkProduct(p));
      const afterBudget = budget != null ? afterJunk.filter((p) => p.price <= budget) : afterJunk;
      console.log(`  → after junk filter: ${afterJunk.length} | after budget(${budget}): ${afterBudget.length}`);
    }
  }
}
run().catch((e) => { console.error("diag error:", e.message); process.exit(1); });
