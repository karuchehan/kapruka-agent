import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { extractBudget, filterProducts } from "@/lib/productFilter";
import type { TrackingInfo } from "@/lib/types";

// Load the system prompt from directives/system_prompt.md. On Vercel,
// process.cwd() is not guaranteed to be the project root, so a single
// cwd-relative read can throw ENOENT at module load → hard 500 → the client's
// opaque "Network error". Try several candidates (the file IS traced into the
// bundle via outputFileTracingIncludes), and NEVER throw at module scope —
// defer any failure into the handler so the client gets a precise JSON error.
function loadSystemPrompt(): { text: string; error: string } {
  const candidates = [
    join(process.cwd(), "directives", "system_prompt.md"),
    join(process.cwd(), "kaprukaAgent", "directives", "system_prompt.md"),
  ];
  // Module-relative fallback — matches the outputFileTracing layout
  // (.next/server/app/api/chat → ../../../../../directives). __dirname exists
  // in the built CJS server module.
  try { candidates.push(join(__dirname, "../../../../../directives/system_prompt.md")); } catch { /* no __dirname */ }

  for (const p of candidates) {
    try { return { text: readFileSync(p, "utf8"), error: "" }; } catch { /* try next */ }
  }
  return { text: "", error: `system_prompt.md not found. Tried: ${candidates.join(" | ")} (cwd=${process.cwd()})` };
}

const { text: BASE_SYSTEM_PROMPT, error: PROMPT_LOAD_ERROR } = loadSystemPrompt();

// Raise the serverless function timeout. The handler chains MCP init+call
// (+ a possible fallback re-search) and an Anthropic call; on the platform's
// low default cap a cold start + cross-region MCP latency can exceed it, and
// Vercel then returns a non-JSON 5xx — which the client surfaces as the
// unhelpful "Network error". 60s is the Hobby maximum.
export const maxDuration = 60;

const CHECKOUT_RE = /\[CHECKOUT_URL\](https?:\/\/[^\s]+)\[\/CHECKOUT_URL\]/;

// How many raw results each search_products MCP call fetches. The pool is
// filtered/ranked down to the visible cards downstream; this is the candidate
// breadth, not the display count.
const MCP_FETCH_LIMIT = 25;

// When the shopper states a budget, constrain the MCP search itself with
// `max_price` (verified live: kapruka_search_products honours `max_price` — the
// keys `price_max`/`maxPrice`/`price_to` are ignored and return zero results).
// This is the real fix for "nothing under Rs X" when cheap in-budget products
// exist: MCP relevance-ranks pricier items first, so the affordable ones rank
// below `limit` and never reach the client-side filter. max_price surfaces them
// at the source. Client-side budget filtering stays as a belt-and-suspenders.
function budgetArg(budget: number | null): Record<string, number> {
  return budget != null ? { max_price: budget } : {};
}

// ── SESSION SEARCH CACHE ──────────────────────────────────────────────────────
// Module-level map survives across Vercel Fluid Compute request reuses. Prevents
// MCP non-determinism from returning different products for the same query within
// a session. Key: `${sessionId}:${category}:${budget}:${occasion}`.
const searchCache = new Map<string, { products: Product[]; ts: number }>();
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 min

function cacheGet(key: string): Product[] | null {
  const e = searchCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) { searchCache.delete(key); return null; }
  return e.products;
}
function cacheSet(key: string, products: Product[]): void {
  const now = Date.now();
  for (const [k, v] of searchCache) if (now - v.ts > CACHE_TTL_MS) searchCache.delete(k);
  searchCache.set(key, { products, ts: now });
}

// Hidden UI markers the agent appends to drive visual cards. Parsed + stripped
// before the message is shown — same pattern as [CHECKOUT_URL].
const OCCASION_RE = /\[OCCASION_DATE:\s*(\d{4}-\d{2}-\d{2})\]/i;
const GIFT_RE     = /\[GIFT_MESSAGE:\s*true\]/i;
const BUNDLE_RE   = /\[BUNDLE:\s*true\]/i;
// Emitted by the agent when the user has confirmed they want to place/complete
// the order. Boolean signal only — the actual checkout URL is built client-side
// from the cart (the items the user added), never from the model.
const ORDER_RE    = /\[ORDER_CONFIRMED:\s*true\]/i;
// Emitted (one per item) when the user agrees to add a specific product. The
// captured name is resolved server-side to a real product so the client can sync
// the cart dock + build checkout from the actual items. Global — multiple adds.
const ADD_RE      = /\[ADD_TO_CART:\s*([^\]\n]+)\]/gi;
// Emitted (one per item) when the user asks to remove a specific product. The
// captured name is resolved server-side same as ADD_RE. Global — multiple removes.
const REMOVE_RE   = /\[REMOVE_FROM_CART:\s*([^\]\n]+)\]/gi;

// ── CHECKOUT FIELD MARKERS ──────────────────────────────────────────────────────
// Emitted (one per field) the moment the user PROVIDES a checkout detail — the same
// pattern as [ADD_TO_CART], but for the structured fields kapruka_create_order needs.
// Each captured value is returned to the client, which accumulates it into
// ChatState.checkoutData and echoes it back next turn — so the [CHECKOUT] readiness
// line always reflects what has been collected. The agent asks for ONE missing field
// at a time and withholds [ORDER_CONFIRMED] until name+phone+address+city are present.
const CO_NAME_RE   = /\[CO_NAME:\s*([^\]\n]+)\]/i;   // delivery recipient name (self-shop = the user)
const CO_PHONE_RE  = /\[CO_PHONE:\s*([^\]\n]+)\]/i;  // recipient phone (07x or +947x)
const CO_ADDR_RE   = /\[CO_ADDR:\s*([^\]\n]+)\]/i;   // full street address
const CO_CITY_RE   = /\[CO_CITY:\s*([^\]\n]+)\]/i;   // delivery city
const CO_DATE_RE   = /\[CO_DATE:\s*(\d{4}-\d{2}-\d{2})\]/i; // delivery date
const CO_SENDER_RE = /\[CO_SENDER:\s*([^\]\n]+)\]/i; // gift-card sender name (the USER)
const CO_GIFTMSG_RE = /\[CO_GIFTMSG:\s*([^\]\n]+)\]/i; // gift-card note text

// ── MCP URL + TOOL MAP ────────────────────────────────────────────────────────

const MCP_URL  = "https://mcp.kapruka.com/mcp";
const MCP_HDRS = { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" };
const TOOL_MAP: Record<string, string> = {
  search_products: "kapruka_search_products",
  get_product:     "kapruka_get_product",
  list_categories: "kapruka_list_categories",
  list_cities:     "kapruka_list_delivery_cities",
  check_delivery:  "kapruka_check_delivery",
  create_order:    "kapruka_create_order",
  track_order:     "kapruka_track_order",
};

// ── STOPWORDS ─────────────────────────────────────────────────────────────────

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
  // time words — never product keywords
  "day","today","tomorrow","yesterday","week","month","soon","next","last","time",
  // currency / budget tokens — never product keywords (leak into MCP query otherwise)
  "rs","lkr","rupees","rupee","budget","price","priced","cost","costs",
  // generic qualifiers
  "stuff","things","thing","kind","types","type","bit","lot","way",
  // 2-char noise words (now reachable since extractKeywords uses >= 2)
  "no","hi","lo","ah","aw","uh","um","ha","oh","oi",
  // verb noise that rides into queries ("he likes X" → "likes" is not a product)
  "likes","liked","wanted","wants","needs","needed",
]);

// ── INTENT DETECTION ──────────────────────────────────────────────────────────

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

// Generic container words. Valid as a lone query ("show me books") but when a
// MORE specific token is present ("books ... autobiographies"), they poison MCP
// ranking — MCP weights "books" and returns piano courses over the genre asked
// for. Same failure class as the Session-014 currency-token leak: drop the
// generic word when something specific survives alongside it.
const GENERIC_QUERY_WORDS = new Set([
  "book", "books", "item", "items", "product", "products", "thing", "things",
]);

function extractKeywords(text: string): string[] {
  const filtered = text.toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w) && !CONTEXT_WORDS.has(w) && !/^\d+$/.test(w));

  // Prefer specific tokens; only fall back to generic container words if that is
  // all we have (so "show me books" still searches "books").
  const specific = filtered.filter((w) => !GENERIC_QUERY_WORDS.has(w));
  return (specific.length ? specific : filtered).slice(0, 7);
}

interface ApiMessage { role: "user" | "assistant"; content: string; }

function buildSearchQuery(messages: ApiMessage[]): string {
  const userMessages = messages.filter((m) => m.role === "user");
  const lastMsg = userMessages[userMessages.length - 1];
  if (!lastMsg) return "";

  // Always lead with the CURRENT message — never let old topics contaminate.
  const currentKws = extractKeywords(lastMsg.content);
  if (currentKws.length >= 1) return currentKws.slice(0, 5).join(" ");

  // Zero keywords in current message (pure filler like "yes please").
  // Fall back to last substantive message (≥5 words), skipping onboarding answers.
  const prevReal = userMessages.slice(0, -1)
    .filter((m) => m.content.trim().split(/\s+/).length >= 5);
  const prev = prevReal[prevReal.length - 1];
  return prev ? extractKeywords(prev.content).slice(0, 5).join(" ") : "";
}

// Single generic category words MCP ranks badly (by keyword frequency, not
// intent). When a search collapses to one of these, MCP returns junk. Enrich
// from conversation context so MCP NEVER receives a bare 1-word query — the
// same fix the verified book flow applies, generalised to every category.
const GENERIC_CATEGORIES = new Set([
  "books", "book", "clothing", "clothes", "shoes", "shoe", "electronics",
  "electronic", "food", "foods", "gifts", "gift", "flowers", "flower",
  "cosmetics", "cosmetic", "jewellery", "jewelry", "toys", "toy",
  "perfume", "perfumes", "watch", "watches",
]);

const OCCASION_WORDS = [
  "birthday", "anniversary", "wedding", "christmas", "valentine",
  "graduation", "newborn",
];

// Common preference adjectives users say; used to qualify a bare category
// ("fiction" books, "casual" shoes). "kids" included so a stated audience
// survives even when no recipient age is set.
const PREFERENCE_WORDS = [
  "casual", "formal", "fiction", "romantic", "elegant", "vintage", "modern",
  "traditional", "organic", "handmade", "luxury", "sporty", "kids",
];

// Turn a bare single category word into a ≥2-word, context-aware query.
// Precedence: stated preference → recipient age/gender → occasion → "popular".
function enrichGenericQuery(
  baseQuery: string,
  recipientProfile: { age?: number | null; gender?: string } | null | undefined,
  convText: string,
): string {
  const tokens = baseQuery.trim().split(/\s+/);
  if (tokens.length !== 1) return baseQuery;          // already ≥2 words
  const cat = tokens[0].toLowerCase();
  if (!GENERIC_CATEGORIES.has(cat)) return baseQuery; // not a bare category

  const prefixes: string[] = [];

  const pref = PREFERENCE_WORDS.find((p) => new RegExp(`\\b${p}\\b`).test(convText));
  if (pref) prefixes.push(pref);

  const age = recipientProfile?.age;
  const gender = (recipientProfile?.gender || "").toLowerCase();
  if (age != null && age <= 12) {
    if (!prefixes.includes("kids")) prefixes.push("kids");
  } else if (/\b(male|man|men|boy)\b/.test(gender)) {
    prefixes.push("mens");
  } else if (/\b(female|woman|women|girl)\b/.test(gender)) {
    prefixes.push("womens");
  }

  if (prefixes.length === 0) {
    const occ = OCCASION_WORDS.find((o) => new RegExp(`\\b${o}`).test(convText));
    if (occ) prefixes.push(occ);
  }

  if (prefixes.length === 0) prefixes.push("popular"); // guarantee ≥2 words

  return `${prefixes.slice(0, 2).join(" ")} ${cat}`.trim();
}

// Gift categories: MCP query term + detection regex. Used to (a) build a
// category-explicit query that is NOT gender-enriched — gendering an occasion
// category ("flowers" → "womens flowers") returns 0 results — and (b) gate
// results per category so a bundle never mixes a phone into the cakes.
const CATEGORY_TERMS: Record<string, string> = {
  flower: "flowers", cake: "cake", chocolate: "chocolates", hamper: "gift hamper", book: "books",
};
const CATEGORY_DETECT: Record<string, RegExp> = {
  flower:    /\b(flowers?|bouquet|roses?|floral|blooms?|orchids?|lilies|lily|carnations?|anthurium|gerbera)\b/,
  cake:      /\b(cakes?|gateau|gateaux|cupcakes?|cheesecake)\b/,
  chocolate: /\b(chocolates?|choco|truffles?|pralines?|ferrero|toblerone|lindt)\b/,
  hamper:    /\b(hampers?|gift\s*baskets?)\b/,
  book:      /\b(books?|novels?|read(?:s|ing)?|author|fiction|non[\s-]?fiction|autobiograph|memoir|biograph|paperback|hardcover|storybook)\b/,
};

function detectCategories(text: string): string[] {
  const l = text.toLowerCase();
  const out: string[] = [];
  for (const [cat, re] of Object.entries(CATEGORY_DETECT)) {
    if (re.test(l)) out.push(cat);
  }
  return out;
}

// A category-explicit MCP query, optionally prefixed by the occasion. No gender
// prefix — that breaks occasion categories (flowers/cake/chocolate).
function categoryQuery(cat: string, convText: string): string {
  const term = CATEGORY_TERMS[cat] || cat;
  const occ = OCCASION_WORDS.find((o) => new RegExp(`\\b${o}`).test(convText));
  return occ ? `${occ} ${term}` : term;
}

// Select the products that become visible cards. When a budget is stated, show
// ONLY within-budget products — NEVER an over-budget card (the user is explicit:
// no upselling). Within-budget items keep their incoming MCP relevance order
// (best match for the budget first), NOT price-asc — "best product for the
// budget, not cheapest". If none fit, return [] so the agent stays honest and a
// broaden-retry can fire; never fall back to showing over-budget candidates. Max 8.
function pickForCards(candidates: Product[], budget: number | null): Product[] {
  if (budget == null) return candidates.slice(0, 8);
  const within = candidates.filter((p) => p.price <= budget);
  return within.slice(0, 8);
}

// Category-mismatch guard. MCP relevance search occasionally returns adjacent-
// category products (a cake when chocolates were asked for). After MCP returns and
// before the visible cards are picked, drop results whose NAME carries a word that
// belongs to a different category than the one requested.
const INTENT_EXCLUDE: Record<string, RegExp> = {
  // chocolates / sweets — exclude baked goods
  chocolate: /\b(cake|pastry|bread|tart|pie)\b/,
  // cakes — exclude packaged confectionery
  cake:      /(chocolate box|chocolate bar|\bcandy\b)/,
  // flowers — exclude non-floral gifts
  flower:    /\b(cake|chocolate|perfume)\b/,
  // perfume / fragrance — exclude non-fragrance gifts
  perfume:   /\b(cake|flower|chocolate)\b/,
};

// Resolve the user's requested product type to an INTENT_EXCLUDE key, then drop
// results whose name matches the mismatched-category words. Safety valve: if the
// filter would leave fewer than 3 results, skip it and return the original array —
// never strand the user with almost nothing. Logs every exclusion for debugging.
function filterByIntent(requestedType: string | null, results: Product[]): Product[] {
  if (!requestedType || !results.length) return results;
  const req = requestedType.toLowerCase();

  let key: string | null = null;
  if (/\b(chocolate|chocolates|sweet|sweets)\b/.test(req)) key = "chocolate";
  else if (/\b(cake|cakes)\b/.test(req)) key = "cake";
  else if (/\b(flower|flowers|bouquet|roses?|floral)\b/.test(req)) key = "flower";
  else if (/\b(perfume|perfumes|fragrance|fragrances|cologne)\b/.test(req)) key = "perfume";
  if (!key) return results;

  const exclude = INTENT_EXCLUDE[key];
  const kept: Product[] = [];
  const dropped: Product[] = [];
  for (const p of results) {
    if (exclude.test(p.name.toLowerCase())) dropped.push(p);
    else kept.push(p);
  }

  // Skip the filter entirely when too little would remain.
  if (kept.length < 3) {
    if (dropped.length) {
      console.log(`[filterByIntent] skipped for "${requestedType}" — only ${kept.length} would remain after dropping ${dropped.length}`);
    }
    return results;
  }

  if (dropped.length) {
    console.log(`[filterByIntent] "${requestedType}" (${key}) excluded ${dropped.length}: ${dropped.map((p) => p.name).join(" | ")}`);
  }
  return kept;
}

// Search one category and return on-topic, in-budget products (category-gated).
async function searchCategory(
  cat: string,
  convText: string,
  budget: number | null,
  take: number,
  excludeSympathy: boolean,
  dropFloral: boolean,
): Promise<Product[]> {
  if (cat === "flower") {
    // Flowers need a multi-query parallel search — a single "flowers" query returns
    // popularity-ranked (expensive) results. Cheap bouquets (Rs.4,200–4,400) exist
    // but rank below the limit when only one query fires.
    const pool = await searchFlowersParallel(convText, budget, excludeSympathy);
    return pool.slice(0, take);
  }
  const q = categoryQuery(cat, convText);
  const r = await callMCP("search_products", { q, limit: MCP_FETCH_LIMIT, in_stock_only: true, sort: "relevance", ...budgetArg(budget) });
  // Never drop floral when this very category IS flower (explicit per-category search).
  const c = filterProducts<Product>((r.results || []).map(normaliseProduct), budget, [cat], cat, excludeSympathy, dropFloral && cat !== "flower");
  return c.slice(0, take);
}

// Flower searches require multiple parallel queries because MCP relevance-ranks by
// popularity (expensive items first). Three queries targeting different vocabulary
// pools the top-15 from each (~45 candidates), deduplicated, then sorted price-asc
// when a budget exists — guarantees cheap in-budget bouquets surface.
const FLOWER_QUERIES = ["roses bouquet", "flower bouquet", "bouquet"];
async function searchFlowersParallel(
  convText: string,
  budget: number | null,
  excludeSympathy: boolean,
): Promise<Product[]> {
  const occ = OCCASION_WORDS.find((o) => new RegExp(`\\b${o}\\b`).test(convText));
  const queries = FLOWER_QUERIES.map((q) => (occ ? `${occ} ${q}` : q));
  // Always add the bare category term as a 4th query
  queries.push(occ ? `${occ} flowers` : "flowers");

  const settled = await Promise.allSettled(
    queries.map((q) =>
      callMCP("search_products", { q, limit: MCP_FETCH_LIMIT, in_stock_only: true, sort: "relevance", ...budgetArg(budget) })
    )
  );

  // Pool + dedupe across all query results
  const seen = new Set<string>();
  const pool: Product[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const p of (r.value.results || []).map(normaliseProduct)) {
      const key = p.id || p.name;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      pool.push(p);
    }
  }

  // Gate for flower relevance + junk; never drop floral here (this IS the flower search)
  const filtered = filterProducts<Product>(pool, budget, ["flower", "bouquet", "roses"], "flower", excludeSympathy, false);

  // Sort price ascending when budget given — surfaces cheapest options first
  if (budget != null) {
    filtered.sort((a, b) => a.price - b.price);
  }

  return filtered;
}

// Known Sri Lankan delivery cities — used to extract the target city from a
// delivery question so check_delivery gets a concrete location.
const CITIES = [
  "colombo","kandy","galle","negombo","jaffna","matara","ratnapura","kurunegala",
  "anuradhapura","polonnaruwa","badulla","nuwara eliya","trincomalee","batticaloa",
  "ampara","kalmunai","vavuniya","mannar","puttalam","chilaw","kalutara","panadura",
  "moratuwa","dehiwala","mount lavinia","nugegoda","kottawa","kaduwela","kadawatha",
  "maharagama","piliyandala","homagama","bandaragama","beruwala","aluthgama","hikkaduwa",
  "tangalle","hambantota","matale","dambulla","sigiriya","haputale","ella","bandarawela",
];

function extractCity(lower: string): string | null {
  // Longest match first so "mount lavinia"/"nuwara eliya" beat "lavinia"/"nuwara".
  const sorted = [...CITIES].sort((a, b) => b.length - a.length);
  for (const c of sorted) {
    if (new RegExp(`\\b${c}\\b`).test(lower)) return c;
  }
  return null;
}

function detectIntent(messages: ApiMessage[]) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return { type: "none" };

  const text  = lastUser.content;
  const lower = text.toLowerCase();

  // ORDER TRACKING — post-sale "where's my order". Multilingual triggers
  // (English / Singlish / Tamil). A Kapruka order number looks like VPAY827982BA
  // (2–6 letters, 4–12 digits, optional trailing alphanumerics); match it
  // case-insensitively and upper-case it for the MCP call (MCP is case-sensitive).
  // An order-number-shaped token (e.g. VPAY827982BA) is itself a strong tracking
  // signal — nobody types one while shopping.
  const hasOrderNo = /\b[A-Za-z]{2,6}\d{4,12}[A-Za-z0-9]*\b/.test(text);
  const orderWord =
    /\b(order|parcel|package|shipment|consignment)\b/.test(lower) ||
    /ඇණවුම|ඕඩර|ඔර්ඩර|ආර්ඩර|ஆர்டர்|பார்சல்/.test(text);
  const trackWord =
    /\b(track|tracking|status|where(?:'?s| is| are)?|arrived?|shipped|dispatched|delivered|coming|update|reach(?:ed)?)\b/.test(lower) ||
    /\b(koheda|kohedha|kohomada|awada|aawada|enwada|awathuda|enga|engae|vandhucha|vanthucha)\b/.test(lower) ||
    /කොහෙද|ආවද|எங்கே|வந்த/.test(text);
  // "order" as a VERB ("I want to order flowers") is shopping, not tracking —
  // exclude it so a shopping+delivery message isn't mistaken for a track request.
  const verbOrder =
    /\b(to|wanna|gonna|will|i'?ll|can i|could i|may i|like to|want to|need to|place an?|placing an?|put in an?)\s+order\b/.test(lower);
  // "order" as a NOUN ("my order", "the parcel", "order number", Singlish
  // "mage order eka", Tamil "en order") is the tracking sense.
  const orderNoun =
    /\b(my|the|this|that|your)\s+(order|parcel|package|shipment|consignment)\b/.test(lower) ||
    /\border\s*(number|no\.?|#|id|status)\b/.test(lower) ||
    /\b(parcel|consignment|shipment)\b/.test(lower) ||
    /\b(mage|maage|ape|oyage|oyaage|umbe|en|ente|enathu|namma)\b[\s\w]{0,6}order/.test(lower) ||
    /order\s+eka/.test(lower);
  const explicitTrack =
    /\btrack\b[\s\S]*\border\b|\border\b[\s\S]*\btrack\b|order status|track my|where(?:'?s| is) my (?:order|parcel|package|delivery|shipment)/.test(lower);
  // A message that is essentially JUST an order number (≤3 words, no product
  // keywords) — e.g. the user replying to "what's your order number?" with a
  // bare "VPAY827982BA" — is a track request even without an "order"/"track"
  // word. Nobody types an order number while shopping, so treat it as the
  // strong tracking signal the comment above describes. Without this, a lone
  // number falls through to a product SEARCH for "vpay827982ba" → zero results
  // → the reply dies with no tracking context.
  const bareOrderNo =
    hasOrderNo && text.trim().split(/\s+/).length <= 3 && extractKeywords(text).length <= 1;

  if (explicitTrack || bareOrderNo || (hasOrderNo && (orderWord || trackWord)) || (orderNoun && trackWord && !verbOrder)) {
    const match = text.match(/\b([A-Za-z]{2,6}\d{4,12}[A-Za-z0-9]*)\b/);
    return { type: "track", orderNumber: match ? match[1].toUpperCase() : null };
  }

  if (/\b(deliver|delivery|ship|arrive|arrives|arrival)\b/.test(lower) && /\b(to|in|at)\b/.test(lower)) {
    return { type: "delivery", city: extractCity(lower) };
  }

  // Cart-add auto-messages — skip re-search, let agent confirm
  if (/\bi'?d like to add the .+ to my cart\b/i.test(lower)) {
    return { type: "none" };
  }

  // Non-shopping short acknowledgments only (≤6 words)
  if (
    /^(yes|no|ok|okay|sure|thanks|thank|great|perfect|add|remove|cancel|done|got it|sounds good|proceed|checkout)\b/i.test(text.trim()) &&
    text.trim().split(/\s+/).length <= 6
  ) {
    return { type: "none" };
  }

  // Follow-up questions about an ALREADY-shown item — do NOT re-search.
  // Re-searching here was the source of card duplicates, "I don't have details"
  // deflection, and price flips (same title, different ranked variant per call).
  // Let these pass through to Claude with existing context (see LAST SHOWN PRODUCTS).
  const FOLLOWUP_RE = /\b(what(?:'?s| is| does| are)|tell me more|how much|what does)\b[\s\S]*\b(that|it|this|they|them|those|these)\b/i;
  if (FOLLOWUP_RE.test(lower)) {
    return { type: "none" };
  }
  // Generic: short message (<6 words) referencing "that/it/this" with no NEW
  // product/category keyword of its own → it's about something already shown.
  const refersToShown = /\b(that|it|this|they|them|those|these)\b/i.test(lower);
  if (
    text.trim().split(/\s+/).length < 6 &&
    refersToShown &&
    extractKeywords(text).length === 0
  ) {
    return { type: "none" };
  }

  const query = buildSearchQuery(messages);
  return { type: "search", query };
}

// ── MCP CALLER ────────────────────────────────────────────────────────────────

// The first MCP call after the Kapruka server (or our function) has been idle
// frequently fails on the `initialize` round-trip — a cold-start artefact, not a
// real outage. A judge's very first message is exactly that cold call, so a
// single transient failure must NOT surface as "nothing available". callMCP wraps
// the real work and retries ONCE on a transient error (timeout / network / 5xx),
// with a short backoff. A second failure is treated as a genuine error and thrown.
async function callMCP(tool: string, args: Record<string, unknown>, timeoutMs = 6000) {
  try {
    return await callMCPOnce(tool, args, timeoutMs);
  } catch (e) {
    const msg = (e as Error).message || "";
    // Only retry transient classes — never retry a real tool error (isError) or a
    // not-found, which are deterministic and would just fail again at twice the cost.
    const transient = /abort|timeout|fetch failed|network|ECONNRESET|init \d|call 5\d\d|Empty MCP/i.test(msg);
    if (!transient) throw e;
    console.log(`[callMCP] transient failure on "${tool}" (${msg}) — retrying once`);
    await new Promise((r) => setTimeout(r, 250));
    return await callMCPOnce(tool, args, timeoutMs);
  }
}

async function callMCPOnce(tool: string, args: Record<string, unknown>, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const toolName = TOOL_MAP[tool] || tool;

    const initResp = await fetch(MCP_URL, {
      method: "POST",
      headers: MCP_HDRS,
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "kapruka-agent", version: "1.0" },
        },
      }),
      signal: controller.signal,
    });
    if (!initResp.ok) throw new Error(`MCP init ${initResp.status}`);
    const sessionId = initResp.headers.get("mcp-session-id");
    if (!sessionId) throw new Error("No MCP session ID");

    const toolResp = await fetch(MCP_URL, {
      method: "POST",
      headers: { ...MCP_HDRS, "Mcp-Session-Id": sessionId },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 2,
        method: "tools/call",
        params: { name: toolName, arguments: { params: { ...args, response_format: "json" } } },
      }),
      signal: controller.signal,
    });
    if (!toolResp.ok) throw new Error(`MCP call ${toolResp.status}`);

    const text = await toolResp.text();
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const payload = JSON.parse(line.slice(6));
      if (payload.error) throw new Error(payload.error.message || "MCP error");
      const result = payload.result || {};
      if (result.isError) throw new Error(result.content?.[0]?.text || "MCP error");
      const content = result.content || [];
      if (content[0]?.type === "text") {
        try { return JSON.parse(content[0].text); }
        catch { return { raw: content[0].text }; }
      }
    }
    throw new Error("Empty MCP response");
  } finally {
    clearTimeout(timer);
  }
}

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────

interface UserProfile { name: string; age: number | null; gender: string; }
interface RecipientProfile { age: number | null; gender: string; relationship: string; }

// Externalized client state injected on every call. Mirrors lib/types ChatState.
interface CheckoutData {
  recipientName?: string;
  phone?: string;
  address?: string;
  city?: string;
  date?: string;
  senderName?: string;
  giftMessage?: string;
}
interface ChatState {
  cartItems: { name: string; price: number }[];
  cartCount: number;
  deliveryCity: string | null;
  checkoutStage: "idle" | "collecting_address" | "address_confirmed" | "complete";
  budgetStated: number | null;
  checkoutData?: CheckoutData;
}

// The fields kapruka_create_order requires before it can build an order. City is
// derivable from the confirmed delivery city, so the four the agent must actively
// collect are name, phone, address, city. Date defaults server-side; sender too.
function missingCheckoutFields(s: ChatState | null): string[] {
  const d = s?.checkoutData || {};
  const city = d.city || s?.deliveryCity || "";
  const need: [string, string][] = [
    ["name", d.recipientName || ""],
    ["phone", d.phone || ""],
    ["address", d.address || ""],
    ["city", city],
  ];
  return need.filter(([, v]) => !String(v).trim()).map(([k]) => k);
}

// Render the [STATE] ground-truth block the agent must read before replying.
function buildStateBlock(s: ChatState | null): string {
  if (!s) return "";
  const city = s.deliveryCity || "unknown";
  const budget = s.budgetStated != null ? `LKR ${s.budgetStated}` : "not stated";
  let line = `[STATE] Cart: ${s.cartCount} items. Delivery city: ${city}. Checkout stage: ${s.checkoutStage}. Budget: ${budget}.`;
  if (s.cartItems?.length) {
    line += ` Cart contents: ${s.cartItems.map((i) => `${i.name} (LKR ${i.price})`).join(", ")}.`;
  }

  // [CHECKOUT] readiness — only while there is a cart to check out. Shows what has
  // been collected and what is still missing, so the agent asks for exactly ONE
  // missing field at a time and never emits [ORDER_CONFIRMED] before all four are in.
  if (s.cartCount > 0 && s.checkoutStage !== "idle") {
    const d = s.checkoutData || {};
    const shown = (v?: string) => (v && v.trim() ? v.trim() : "✗");
    const missing = missingCheckoutFields(s);
    line += `\n[CHECKOUT] Collected — name: ${shown(d.recipientName)}, phone: ${shown(d.phone)}, address: ${shown(d.address)}, city: ${shown(d.city || (s.deliveryCity ?? ""))}, date: ${shown(d.date) === "✗" ? "(will default)" : shown(d.date)}.`;
    line += missing.length
      ? ` Still MISSING: ${missing.join(", ")}. Ask the user for ONLY the next missing field, one at a time, in their register, and when they give it emit the matching marker ([CO_NAME:…], [CO_PHONE:…], [CO_ADDR:…], [CO_CITY:…]). Do NOT emit [ORDER_CONFIRMED] yet — fields are incomplete.`
      : ` All required fields collected — once the user confirms the order, emit [ORDER_CONFIRMED: true].`;
  }
  return line;
}

function buildSystemPrompt(
  userProfile: UserProfile | null,
  recipientProfile: RecipientProfile | null,
  liveProducts: Product[],
  tracking: TrackingInfo | null,
  lastShownProducts: Product[],
  chatState: ChatState | null,
  mcpSearchFailed: boolean
) {
  const dynamicParts: string[] = [];

  // Catalog service hiccup this turn (MCP threw after its retry). Tell the agent to
  // own the moment warmly and offer a retry — NEVER to claim nothing is available
  // and NEVER to invent products. Put it first so it dominates the reply.
  if (mcpSearchFailed) {
    dynamicParts.push(
      "PRODUCT SEARCH HICCUP: the Kapruka catalog didn't respond this turn (a brief service hiccup, not your fault). In ONE warm sentence, apologise lightly and ask the user to try that again in a moment. Do NOT say there are no products, and do NOT invent any products or prices."
    );
  }

  // [STATE] is ground truth — put it FIRST so it sits at the top of the
  // conversation context the agent reads (see the [STATE] rule in the prompt).
  const stateBlock = buildStateBlock(chatState);
  if (stateBlock) dynamicParts.push(stateBlock);

  // Current date so the agent can resolve relative dates ("Friday", "tomorrow")
  // into the absolute YYYY-MM-DD required by the [OCCASION_DATE] marker.
  const now = new Date();
  dynamicParts.push(
    `CURRENT DATE: ${now.toISOString().slice(0, 10)} (${now.toLocaleDateString("en-US", { weekday: "long" })}) — use this to resolve relative dates.`
  );

  if (userProfile?.name) {
    let p = `USER PROFILE\nName: ${userProfile.name}`;
    if (userProfile.age)    p += ` | Age: ${userProfile.age}`;
    if (userProfile.gender) p += ` | Gender: ${userProfile.gender}`;
    dynamicParts.push(p);
  }

  if (recipientProfile?.relationship) {
    let r = `RECIPIENT PROFILE\nRelationship: ${recipientProfile.relationship}`;
    if (recipientProfile.age)    r += ` | Age: ${recipientProfile.age}`;
    if (recipientProfile.gender) r += ` | Gender: ${recipientProfile.gender}`;
    dynamicParts.push(r);
  }

  if (liveProducts?.length) {
    const slim = liveProducts.map((p, i) => `${i + 1}. ${p.name} — LKR ${p.price}`).join("\n");
    dynamicParts.push(`AVAILABLE PRODUCTS (already fetched — recommend from these):\n${slim}`);
  }

  // Products shown in the previous carousel. When the user asks "what is that
  // book about?" / "how much is that?" we do NOT re-search — Claude answers from
  // these. No fresh products are injected for follow-ups, so this is the only
  // product context available, keeping names and prices consistent across turns.
  if (lastShownProducts?.length) {
    const slim = lastShownProducts
      .map((p, i) => {
        const desc = p.summary ? ` — ${p.summary.slice(0, 200)}` : "";
        return `${i + 1}. ${p.name} — LKR ${p.price}${desc}`;
      })
      .join("\n");
    dynamicParts.push(
      `LAST SHOWN PRODUCTS (the user may be referring to one of these — answer questions about them directly from this list; do not say you lack details):\n${slim}`
    );
  }

  // Order tracking → a rich TrackingCard with the full status + timeline renders
  // in the UI automatically. The agent's job is ONE warm conversational sentence,
  // never the raw fields or the step-by-step timeline (the card shows those).
  if (tracking) {
    if (tracking.found) {
      const bits = [`Order ${tracking.orderNumber} — status: ${tracking.statusDisplay}`];
      if (tracking.deliveryDate) bits.push(`delivery date ${tracking.deliveryDate}`);
      if (tracking.recipientCity) bits.push(`going to ${tracking.recipientCity}`);
      if (tracking.latestStep) bits.push(`latest update: ${tracking.latestStep}`);
      dynamicParts.push(
        `ORDER TRACKING RESULT (a card with the full timeline is already shown to the user — do NOT reproduce the timeline, fields, or raw JSON; reply with ONE warm sentence that states the status and the single most relevant detail):\n${bits.join(". ")}.`
      );
    } else if (tracking.serviceError) {
      dynamicParts.push(
        `ORDER TRACKING RESULT: The tracking service is temporarily unreachable for "${tracking.orderNumber}" (this is a system hiccup, NOT a bad order number). In ONE warm sentence, apologise that you couldn't reach tracking right now and ask the user to try again in a moment. Do NOT tell them their number is wrong or ask them to double-check it. Do NOT invent a status.`
      );
    } else {
      dynamicParts.push(
        `ORDER TRACKING RESULT: No order was found for "${tracking.orderNumber}". In ONE warm sentence, apologise that you couldn't find that order and ask the user to double-check the order number from their Kapruka confirmation email. Do NOT invent a status.`
      );
    }
  }

  const blocks: Anthropic.MessageParam["content"] = [];
  const systemBlocks = [
    { type: "text" as const, text: BASE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } },
    ...(dynamicParts.length ? [{ type: "text" as const, text: dynamicParts.join("\n\n---\n\n") }] : []),
  ];
  void blocks;
  return systemBlocks;
}

// ── PRODUCT NORMALISE ─────────────────────────────────────────────────────────

interface Product { id: string; name: string; price: number; image_url: string; url: string; category?: string; summary?: string; in_stock?: boolean; }

function normaliseProduct(p: Record<string, unknown>): Product {
  const rawPrice = (p.price ?? p.sale_price ?? p.regular_price ?? 0) as number | { amount?: number };
  const price = typeof rawPrice === "object" ? (rawPrice?.amount ?? 0) : rawPrice;
  // MCP returns `category` as an object {id,name,slug} that is almost always
  // "General" — useless for genre. The real type/genre signal lives in `summary`
  // (e.g. "Non Fiction Autobiography"). Capture both; the relevance gate reads them.
  const cat = p.category;
  const category = typeof cat === "object" && cat !== null
    ? String((cat as { name?: string }).name || "")
    : String(cat || p.category_name || p.type || "");
  // Resolve stock status from whatever field MCP returns.
  // Treat undefined (field absent) as in-stock so in_stock_only=true handles it at source.
  const stockRaw = p.in_stock ?? p.available ?? p.is_available ?? p.stock_status ?? p.availability;
  const in_stock = stockRaw === undefined ? true
    : typeof stockRaw === "boolean"  ? stockRaw
    : typeof stockRaw === "number"   ? stockRaw > 0
    : !/out.?of.?stock|unavailable/i.test(String(stockRaw));
  return {
    // Use url as final fallback — every Kapruka product has a unique URL even
    // when the MCP omits the numeric id field. Prevents all no-id products from
    // collapsing to the key "" and being wrongly deduplicated client-side.
    id:        String(p.id || p.product_id || p.url || p.product_url || p.link || ""),
    name:      String(p.name || p.title || ""),
    price:     Number(price),
    image_url: String(p.image_url || p.image || p.thumbnail || ""),
    url:       String(p.url || p.product_url || p.link || ""),
    category,
    summary:   String(p.summary || p.description || p.short_description || ""),
    in_stock,
  };
}

// ── XML TOOL-CALL LEAK SANITIZER ──────────────────────────────────────────────
// The model occasionally emits raw Anthropic tool-call XML (<function_calls>…,
// <invoke…>, <parameter…>) as literal prose instead of an actual tool call.
// Without stripping, this XML renders verbatim in the chat bubble. Remove every
// such block (and any orphaned/unclosed tag) from the final response before it
// reaches the frontend. The user must NEVER see raw tool-call XML.
function stripToolCallXml(text: string): string {
  return text
    // Whole well-formed blocks first (covers nested invoke/parameter inside).
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, "")
    .replace(/<invoke\b[\s\S]*?<\/invoke>/gi, "")
    .replace(/<parameter\b[\s\S]*?<\/parameter>/gi, "")
    // Orphaned / unclosed tags left by truncated or malformed emissions.
    .replace(/<\/?function_calls>/gi, "")
    .replace(/<\/?invoke\b[^>]*>/gi, "")
    .replace(/<\/?parameter\b[^>]*>/gi, "")
    // Collapse the whitespace/newline debris left behind.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

// ── SERVER-SIDE SENTENCE TRUNCATION ──────────────────────────────────────────

function truncateToSentences(text: string, n = 2): string {
  // Split only on sentence-end + whitespace + capital/quote — avoids splitting "Rs. 1,200"
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z"'(—])/);
  return parts.slice(0, n).join(" ").trim();
}

// ── CARD ↔ REPLY RECONCILIATION ───────────────────────────────────────────────
// The visible cards used to be the raw MCP pool (≤8), independent of which 2–4
// products the agent chose to NAME in its reply — so the carousel showed items
// the agent never recommended (vegetable packs / Fortnite kits beside a birthday
// cake). This reconciles the cards to exactly what the agent said: match each
// fetched product against the agent's prose, exact normalized containment first,
// then a token-overlap fuzzy pass for paraphrased / partial names. Returns the
// matched products ordered by where they first appear in the reply.
function reconcileCards(prose: string, pool: Product[]): Product[] {
  if (!pool.length || !prose.trim()) return [];
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const M = norm(prose);
  // Words too generic to anchor a fuzzy match on their own.
  const GENERIC = new Set([
    "the", "and", "for", "with", "gift", "set", "pack", "box", "mom", "dad",
    "happy", "birthday", "kapruka", "premium", "special", "deluxe", "classic",
  ]);

  const scored: { p: Product; pos: number }[] = [];
  for (const p of pool) {
    const n = norm(p.name);
    if (!n) continue;

    let pos = -1;
    // 1. Exact normalized containment — agent quoted the name as shown.
    const idx = M.indexOf(n);
    if (idx !== -1) {
      pos = idx;
    } else {
      // 2. Fuzzy: significant-token overlap. A match needs either two
      //    overlapping significant tokens (≥60% of the name's tokens), or one
      //    distinctive long token (≥6 chars) — handles partial/paraphrased names.
      const tokens = n.split(" ").filter((t) => t.length >= 4 && !GENERIC.has(t));
      const positions = tokens
        .map((t) => ({ t, i: M.search(new RegExp(`\\b${t}`)) }))
        .filter((x) => x.i !== -1);
      const strong = positions.filter((x) => x.t.length >= 6);
      const enoughOverlap =
        tokens.length >= 2 && positions.length >= 2 && positions.length / tokens.length >= 0.6;
      const distinctive = positions.length >= 1 && strong.length >= 1;
      if (enoughOverlap || distinctive) {
        pos = Math.min(...positions.map((x) => x.i));
      }
    }

    if (pos !== -1) scored.push({ p, pos });
  }

  scored.sort((a, b) => a.pos - b.pos);

  // Dedupe by id/name, cap at the carousel max (8).
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const { p } of scored) {
    const key = p.id || norm(p.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.slice(0, 8);
}

// ── DELIVERY RESULT MAPPING ───────────────────────────────────────────────────

interface DeliveryInfo { city: string; available: boolean; etaLabel: string; }
interface OccasionInfo { label: string; targetDate: string; emoji: string; }
interface BundleInfo { title: string; items: Product[]; total: number; }

// Map a resolved occasion date + conversation text → label/emoji for the chip.
function buildOccasion(iso: string, convText: string): OccasionInfo {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { label: "Your occasion", targetDate: "", emoji: "🎁" };
  const map: [RegExp, string, string][] = [
    [/birthday/, "Birthday", "🎂"],
    [/anniversary/, "Anniversary", "💞"],
    [/wedding/, "Wedding", "💍"],
    [/valentine/, "Valentine's", "❤️"],
    [/christmas/, "Christmas", "🎄"],
    [/mother'?s day/, "Mother's Day", "💐"],
    [/father'?s day/, "Father's Day", "🎁"],
  ];
  for (const [re, label, emoji] of map) {
    if (re.test(convText)) return { label, targetDate: d.toISOString(), emoji };
  }
  return { label: "Your occasion", targetDate: d.toISOString(), emoji: "🎁" };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Format an ETA into "Friday, June 20" when it parses as a date; otherwise pass
// the raw label through (MCP may return a free-text estimate like "2-3 days").
function formatEta(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  const d = new Date(s);
  if (!isNaN(d.getTime()) && /\d/.test(s)) {
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }
  return s;
}

// The MCP check_delivery response shape isn't contractually fixed — read the
// likely fields defensively and return null if nothing usable is present (the
// card then simply doesn't render).
function mapDelivery(city: string, res: Record<string, unknown> | null): DeliveryInfo | null {
  if (!res || typeof res !== "object") return null;
  const r = res as Record<string, unknown>;
  const availableRaw =
    r.available ?? r.can_deliver ?? r.is_available ?? r.deliverable ?? r.delivery_available;
  const available = availableRaw === undefined ? true : Boolean(availableRaw);
  const etaRaw =
    r.estimated_delivery ?? r.estimated_date ?? r.delivery_date ?? r.eta ??
    r.estimate ?? r.date ?? r.estimated_delivery_date;
  const etaLabel = available ? (formatEta(etaRaw) || "Available") : "";
  return { city: titleCase(city), available, etaLabel };
}

// ── ORDER TRACKING MAPPING ────────────────────────────────────────────────────
// Map the kapruka_track_order JSON into the clean, display-ready TrackingInfo.
// The live response differs from the docstring schema in two ways we must handle
// defensively: `amount` comes back as { value, currency } (not a plain string),
// and `recipient.phone` carries an HTML artefact ("077-...<BR") — so we never
// surface the phone, only name + city.

// Canonical 4-step stepper index from the raw status token. -1 = cancelled.
function statusToStage(status: string): number {
  const s = status.toLowerCase();
  if (/cancel|refund|fail/.test(s)) return -1;
  if (/deliver(ed|y\s*complete)/.test(s)) return 3;
  if (/ship|out.?for.?deliver|dispatch|transit|on.?the.?way/.test(s)) return 2;
  if (/confirm|prepar|process|pack|received\s+to/.test(s)) return 1;
  return 0; // received / pending / awaiting
}

function formatTrackAmount(a: unknown): string | undefined {
  if (a == null) return undefined;
  let value: string | number | undefined;
  let currency = "LKR";
  if (typeof a === "object") {
    const o = a as { value?: string | number; amount?: string | number; currency?: string };
    value = o.value ?? o.amount;
    if (o.currency) currency = o.currency;
  } else {
    value = a as string | number;
  }
  if (value == null || value === "") return undefined;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  if (isNaN(n) || n <= 0) return undefined;
  return `${currency} ${n.toLocaleString("en-US")}`;
}

function cleanText(s: unknown): string {
  // Strip HTML artefacts ("<BR", "<br/>") and collapse whitespace.
  return String(s ?? "").replace(/<\s*br\s*\/?\s*>?/gi, " ").replace(/\s+/g, " ").trim();
}

// Build the graceful "no such order" result — the number really doesn't exist.
function notFoundTracking(orderNumber: string): TrackingInfo {
  return {
    found: false,
    orderNumber,
    status: "not_found",
    statusDisplay: "Not found",
    stage: 0,
    progress: [],
  };
}

// Build the "tracking service is temporarily unreachable" result. Distinct from
// not-found: the number may be perfectly valid — MCP just timed out / 5xx'd. We
// must NOT tell the user their number is wrong in this case.
function serviceErrorTracking(orderNumber: string): TrackingInfo {
  return {
    found: false,
    serviceError: true,
    orderNumber,
    status: "service_error",
    statusDisplay: "Temporarily unavailable",
    stage: 0,
    progress: [],
  };
}

function mapTracking(orderNumber: string, res: Record<string, unknown> | null): TrackingInfo {
  // callMCP returns { raw } when the payload isn't JSON. A genuine "no such
  // order" comes back as raw text like "Error (order_not_found): ..." — that IS
  // a real not-found. Anything else without a usable status (null, an unexpected
  // error string) is a service problem, NOT proof the number is wrong.
  if (!res || typeof res !== "object" || (!res.status && !res.status_display)) {
    const rawText = res && typeof res === "object" ? String((res as { raw?: unknown }).raw ?? "") : "";
    const genuineNotFound = /order_not_found|no order (?:exists|found)|not\s*found/i.test(rawText);
    return genuineNotFound ? notFoundTracking(orderNumber) : serviceErrorTracking(orderNumber);
  }
  const r = res as Record<string, unknown>;
  const status = String(r.status || "");
  const statusDisplay = cleanText(r.status_display) || titleCase(status.replace(/[-_]/g, " ")) || "Processing";

  const rawProgress = Array.isArray(r.progress) ? (r.progress as Record<string, unknown>[]) : [];
  const progress = rawProgress
    .map((p) => ({ step: cleanText(p.step), timestamp: cleanText(p.timestamp) }))
    .filter((p) => p.step)
    .slice(-6); // keep the most recent few — the card shows a compact timeline

  const recipient = (r.recipient && typeof r.recipient === "object" ? r.recipient : {}) as Record<string, unknown>;
  // Prefer the order `comments` as the latest note (e.g. "Delivery successfully
  // completed."), else the final progress step.
  const latestStep = cleanText(r.comments) || (progress.length ? progress[progress.length - 1].step : "");

  return {
    found: true,
    orderNumber: cleanText(r.order_number) || orderNumber,
    status,
    statusDisplay,
    stage: statusToStage(status || statusDisplay),
    orderDate: cleanText(r.order_date) || undefined,
    deliveryDate: cleanText(r.delivery_date) || undefined,
    amount: formatTrackAmount(r.amount),
    recipientName: cleanText(recipient.name) || undefined,
    recipientCity: titleCase(cleanText(recipient.city).toLowerCase()) || undefined,
    latestStep: latestStep || undefined,
    progress,
  };
}

// ── DELIVERY-CITY VALIDATION (live) ───────────────────────────────────────────
// create_order rejects any city that is not a Kapruka delivery city, so we resolve
// the user's typed city to the exact canonical spelling the tool expects, LIVE.
// list_delivery_cities is paginated (25/page) but takes a `query` filter — so we
// query by the city (and by address-area tokens) instead of scanning the whole list.
// Bare "Colombo" is ambiguous (Colombo 01…15); we disambiguate using the street
// address ("Bambalapitiya" → Colombo 04 via its alias) and fall back to the first
// deliverable match so a common city never dead-ends the order.

interface CityCand { name: string; aliasTokens: string[] }

const cityNorm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const cityTokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length >= 4);

async function queryCities(q: string): Promise<CityCand[]> {
  if (!q.trim()) return [];
  try {
    const res = await callMCP("list_cities", { query: q, limit: 50 }, 6000);
    const raw = (res.cities || res.results || []) as unknown[];
    return raw.map((c) => {
      const name = typeof c === "string" ? c : String((c as { name?: string; city?: string }).name || (c as { city?: string }).city || "");
      const aliases = typeof c === "object" && c ? ((c as { aliases?: string[] }).aliases || []) : [];
      return { name, aliasTokens: aliases.flatMap((a) => cityTokens(a)) };
    }).filter((c) => c.name);
  } catch { return []; }
}

// Resolve a user-typed city (+ street address for disambiguation) to its canonical
// Kapruka spelling, or null if genuinely not deliverable.
async function canonicaliseCity(city: string, address = ""): Promise<string | null> {
  const cityKey = cityNorm(city);
  if (!cityKey) return null;

  // Gather candidates: query by the city, and by each significant address token
  // (so "Bambalapitiya" surfaces "Colombo 04" even when the user typed "Colombo").
  const queries = [city, ...cityTokens(address)].slice(0, 5);
  const seen = new Map<string, CityCand>();
  for (const q of queries) {
    for (const c of await queryCities(q)) if (!seen.has(cityNorm(c.name))) seen.set(cityNorm(c.name), c);
  }
  const cands = [...seen.values()];
  if (!cands.length) return null;

  // 1. Exact name / alias match to the typed city.
  for (const c of cands) if (cityNorm(c.name) === cityKey || c.aliasTokens.includes(cityKey)) return c.name;

  // 2. Disambiguate by the street address — a candidate name or alias token that
  //    appears in the address wins (Bambalapitiya alias → Colombo 04).
  const addrToks = cityTokens(address);
  for (const c of cands) {
    const nk = cityNorm(c.name);
    if (addrToks.some((t) => nk.includes(t) || t.includes(nk))) return c.name;
    if (c.aliasTokens.some((a) => addrToks.some((t) => t.includes(a) || a.includes(t)))) return c.name;
  }

  // 3. Substring match on the city (bare "Colombo" → first "Colombo NN"), else the
  //    first deliverable candidate. Either way the order can be placed.
  const sub = cands.find((c) => { const nk = cityNorm(c.name); return nk.includes(cityKey) || cityKey.includes(nk); });
  return (sub || cands[0]).name;
}

// Delivery date default — today + 2 days, YYYY-MM-DD in Asia/Colombo (UTC+5:30).
// Used when the agent didn't collect a specific date; always today-or-future.
function defaultDeliveryDate(): string {
  const colomboNow = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
  const d = new Date(colomboNow.getTime() + 2 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

interface CheckoutResult {
  checkoutUrl: string; orderRef: string; itemsTotal: number; deliveryFee: number;
  addonsTotal: number; grandTotal: number; currency: string; expiresAt: string;
}

// Build the create_order payload from the collected checkout fields + cart, call the
// MCP, and map the response. Returns the CheckoutResult on success, or throws with a
// message the caller turns into a graceful checkoutError (never a raw 500).
async function createOrder(
  cart: { product_id: string; quantity: number }[],
  d: CheckoutData,
  city: string,
  userName = "",
): Promise<CheckoutResult> {
  const recipientName = (d.recipientName || "").trim();
  // Sender is the USER, never the recipient. Prefer an explicit [CO_SENDER], then the
  // user's known name, then a neutral fallback — so a gift card never reads
  // "from <recipient> to <recipient>".
  const senderName = (d.senderName || userName || "Kapruka Customer").trim();
  const giftMessage = (d.giftMessage || "").trim().slice(0, 300);
  const payload: Record<string, unknown> = {
    cart,
    recipient: { name: recipientName, phone: (d.phone || "").trim() },
    delivery: {
      address: (d.address || "").trim(),
      city,
      location_type: "house",
      date: d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : defaultDeliveryDate(),
    },
    sender: { name: senderName, anonymous: false },
    currency: "LKR",
  };
  if (giftMessage) payload.gift_message = giftMessage;
  const res = await callMCP("create_order", payload, 12000);
  // The tool returns { checkout_url, order_ref, summary, expires_at } on success,
  // or { raw: "Error (code): message" } / an error string on failure.
  const rawErr = typeof res.raw === "string" ? res.raw : (typeof res === "string" ? res : "");
  if (rawErr && /error/i.test(rawErr)) throw new Error(rawErr.replace(/^Error[^:]*:\s*/i, "").trim() || "create_order failed");
  const url = res.checkout_url || res.checkoutUrl;
  if (!url) throw new Error("No checkout URL returned");
  const sum = (res.summary || {}) as Record<string, number>;
  return {
    checkoutUrl: String(url),
    orderRef: String(res.order_ref || res.orderRef || ""),
    itemsTotal: Number(sum.items_total ?? 0),
    deliveryFee: Number(sum.delivery_fee ?? 0),
    addonsTotal: Number(sum.addons_total ?? 0),
    grandTotal: Number(sum.grand_total ?? 0),
    currency: String(sum.currency || "LKR"),
    expiresAt: String(res.expires_at || res.expiresAt || ""),
  };
}

// ── WARM-UP (GET) ─────────────────────────────────────────────────────────────
// Fired fire-and-forget by the client on page load. Lives in THIS route file so it
// deploys to the SAME serverless function the judge's POST will hit — warming both
// the Node instance (cold boot) AND the Kapruka MCP `initialize` path before the
// first real message. Uses the cheapest MCP tool (list_categories) and NEVER calls
// Anthropic — zero API cost, no ANTHROPIC_API_KEY touched. Best-effort: any failure
// returns ok:false but never throws (the warm-up must not surface an error to the UI).
export async function GET() {
  const start = Date.now();
  try {
    await callMCP("list_categories", {}, 5000);
    return Response.json({ ok: true, warmedMs: Date.now() - start });
  } catch (e) {
    // A failed warm-up is fine — it still cold-boots the function and primes MCP.
    return Response.json({ ok: false, warmedMs: Date.now() - start, error: (e as Error).message });
  }
}

// ── ROUTE HANDLER ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Surface a config failure as JSON (not a module crash → opaque "Network error").
  if (!BASE_SYSTEM_PROMPT) {
    return Response.json({ error: `Server config error: ${PROMPT_LOAD_ERROR}` }, { status: 500 });
  }

  const { messages, userProfile, recipientProfile, lastShownProducts, sessionId, chatState, cartProducts } = await req.json();
  const sid = String(sessionId || "");
  const clientState: ChatState | null = chatState && typeof chatState === "object" ? chatState as ChatState : null;
  // Cart items with their real product_id — needed to build the create_order payload.
  // ChatState.cartItems only carries name+price, so the client sends the full cart
  // products separately. Each Kapruka product id (e.g. "CHOCOLATES00767") is a valid
  // create_order product_id (verified live).
  const cartForOrder: { product_id: string; quantity: number }[] = Array.isArray(cartProducts)
    ? (cartProducts as Product[])
        .map((p) => ({ product_id: String(p.id || ""), quantity: 1 }))
        .filter((c) => c.product_id.length >= 3)
    : [];

  if (!messages || !Array.isArray(messages)) {
    return Response.json({ error: "messages array required" }, { status: 400 });
  }

  const priorProducts: Product[] = Array.isArray(lastShownProducts)
    ? (lastShownProducts as Product[])
    : [];

  const intent = detectIntent(messages);
  const budget = extractBudget(messages);

  // Sticky category context across the WHOLE conversation. The per-turn search
  // query leads with the current message, which can lose the category constraint
  // — so MCP returns off-category results that share a genre word. Detect the
  // category from the full transcript and pass it to the filter so off-category
  // results are dropped even when the latest message omits the category word.
  const convText = (messages as ApiMessage[]).map((m) => m.content).join(" ").toLowerCase();
  // Category detection must read USER text only. The assistant's clarifying
  // menu ("...gadgets, food, or flowers and a cake?") otherwise leaks "flower"
  // into the hint and forces a flower search even when the user asked for food
  // — the brother's-birthday-returns-pink-bouquets bug.
  const userText = (messages as ApiMessage[])
    .filter((m) => m.role === "user").map((m) => m.content).join(" ").toLowerCase();
  const categoryHint: string | null = detectCategories(userText)[0] ?? null;

  // Categories named in the CURRENT message — drives multi-category (bundle)
  // search so each item is fetched + gated by its own category.
  const lastUserMsg = [...(messages as ApiMessage[])].reverse().find((m) => m.role === "user");
  const msgCats = lastUserMsg ? detectCategories(lastUserMsg.content) : [];

  // When the current message names exactly one category, use that — it overrides
  // the sticky conversation hint. E.g. "show me cakes" after flowers → msgCats[0]
  // is "cake", not "flower". Without this, the sticky "flower" hint causes a flower
  // re-search that returns already-deduplicated products → stage never updates.
  const effectiveCat = msgCats.length === 1 ? msgCats[0] : categoryHint;

  // Recipient-gender gate. Derive male recipient from the USER text (relationship
  // nouns + pronouns) or the recipient profile. When the recipient is male AND
  // the user did not explicitly ask for flowers, drop floral bouquets from the
  // results — a male birthday should never return pink bouquets as primaries.
  const recipientMale =
    /\b(brother|him|his|he|male|man|men|boy|father|dad|son|husband|uncle|nephew|grandfather|grandpa|guy)\b/.test(userText) ||
    /\b(male|man|men|boy)\b/.test((recipientProfile?.gender || "").toLowerCase());
  const recipientFemale =
    /\b(sister|her|she|female|woman|women|girl|mother|mom|mum|daughter|wife|aunt|niece|grandmother|grandma)\b/.test(userText) ||
    /\b(female|woman|women|girl)\b/.test((recipientProfile?.gender || "").toLowerCase());
  const explicitFlowerRequest =
    effectiveCat === "flower" || msgCats.includes("flower") || /\b(flower|bouquet|roses?|floral|bloom)\b/.test(userText);
  const dropFloral = recipientMale && !recipientFemale && !explicitFlowerRequest;

  // Occasion-based negative filter: strip funeral/sympathy/get-well items when
  // the flow is celebratory — UNLESS the user actually asked for sympathy/get-well
  // (then keep them so genuine condolence/recovery orders still work).
  const sympathyCtx = /\b(funeral|sympath\w*|condolence|bereave\w*|mourning|memorial|get\s*well|hospital)\b/.test(convText);
  const celebratory = /\b(birthday|anniversary|wedding|valentine|graduation|newborn|congrat\w*|celebrat\w*|baby\s+shower)\b/.test(convText);
  const excludeSympathy = celebratory && !sympathyCtx;

  let products: Product[] = [];
  let tracking: TrackingInfo | null = null;
  let delivery: DeliveryInfo | null = null;
  // Set when a product-search MCP call throws (after its built-in retry). Distinct
  // from "MCP returned zero products" — this is a service hiccup, and the agent must
  // acknowledge it + offer to retry rather than claim nothing is available.
  let mcpSearchFailed = false;

  try {
    if (intent.type === "search" && msgCats.length >= 2) {
      // Multi-category (bundle-style) request: search each category on its own
      // and gate each by that category, so there is ZERO cross-category bleed
      // (no phone in the cakes). Dedupe across categories by product id.
      const per = await Promise.all(
        msgCats.slice(0, 3).map((c) => searchCategory(c, convText, budget, 2, excludeSympathy, dropFloral).catch(() => []))
      );
      const seen = new Set<string>();
      products = per.flat().filter((p) => {
        if (!p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      // Budget is soft in the pool now — for the visible bundle cards prefer the
      // within-budget items when any exist, so we never show an over-budget pick.
      if (budget != null) {
        const within = products.filter((p) => p.price <= budget);
        if (within.length) products = within;
      }
    } else if (intent.type === "search" && (intent as { query?: string }).query) {
      const baseQuery = (intent as { query: string }).query;

      // Cache key: stable for the same category + budget + occasion within a session.
      // Prevents MCP non-determinism from surfacing different products each turn.
      const occForKey = OCCASION_WORDS.find((o) => new RegExp(`\\b${o}\\b`).test(convText)) ?? "";
      const cacheKey = `${sid}:${effectiveCat ?? baseQuery}:${budget ?? ""}:${occForKey}`;

      // Flower category: use parallel multi-query search. A bare "flowers" query
      // returns popularity-ranked (expensive) results; cheap bouquets exist but rank
      // below the limit. searchFlowersParallel fires 4 queries, pools ~60 candidates,
      // dedupes, and sorts price-asc when a budget is set. Uses effectiveCat (not
      // categoryHint) so "show me cakes" after flowers correctly triggers cake search.
      if (effectiveCat === "flower") {
        // Same intent verification the primary non-flower path runs — drop
        // adjacent-category results (cakes/chocolates/perfume) from the pooled
        // flower candidates before the visible cards are picked.
        const flowerType = `${effectiveCat ?? ""} ${baseQuery}`.trim();
        const cached = sid ? cacheGet(cacheKey) : null;
        if (cached) {
          products = pickForCards(filterByIntent(flowerType, cached), budget);
        } else {
          const flowerPool = await searchFlowersParallel(convText, budget, excludeSympathy);
          if (sid && flowerPool.length) cacheSet(cacheKey, flowerPool);
          products = pickForCards(filterByIntent(flowerType, flowerPool), budget);
        }
      } else {
      // Enrich the MCP query in a book flow. A bare genre word ("adventure")
      // makes MCP rank adventure-themed CAKES/GAMES first. The phrasing
      // "kids <genre> books" flips results to genuine children's books
      // (The Journey, Dork Diaries, Madol Doova) — verified against the live
      // MCP; word order and the plural matter ("adventure books for kids"
      // regresses to piano courses). Keep the gate's queryTokens as the raw
      // genre so relevance still matches on the genre, not on "book".
      const childPrefix =
        effectiveCat === "book" && recipientProfile?.age != null && recipientProfile.age <= 12
          ? "kids "
          : "";
      const searchQuery =
        effectiveCat === "book"
          ? `${childPrefix}${baseQuery} books`.trim()
          : effectiveCat && effectiveCat in CATEGORY_TERMS
            ? categoryQuery(effectiveCat, convText) // explicit category, no gender prefix
            : enrichGenericQuery(baseQuery, recipientProfile, convText);

      // Check cache before hitting MCP
      const cachedNonFlower = sid ? cacheGet(cacheKey) : null;
      if (cachedNonFlower) {
        products = pickForCards(cachedNonFlower, budget);
      } else {
      const result = await callMCP("search_products", {
        q:             searchQuery,
        limit:         MCP_FETCH_LIMIT,
        in_stock_only: true,
        sort:          "relevance",
        ...budgetArg(budget),
      });
      // Filter junk (vendor listings, no-image, zero-price) and off-topic results
      // (relevance gate) BEFORE slicing — cards rendered in UI come from this
      // array, not Claude. Budget is now soft (within-budget items ordered first);
      // pick the within-budget ones for the visible cards so we never SHOW an
      // over-budget product, while the larger limit surfaces the cheap options
      // that a narrow query + small limit used to bury.
      const queryTokens = baseQuery.split(/\s+/);
      if (result.results?.length) {
        const candidates = filterProducts<Product>(result.results.map(normaliseProduct), budget, queryTokens, effectiveCat, excludeSympathy, dropFloral);
        // Verify category intent before the cards are picked — drop adjacent-category
        // results (e.g. cakes when chocolates were asked for). Pass both the detected
        // category and the raw query so perfume (not an effectiveCat) is still caught.
        const verified = filterByIntent(`${effectiveCat ?? ""} ${baseQuery}`.trim(), candidates);
        products = pickForCards(verified, budget);
      }

      const withinBudget = (ps: Product[]) => (budget == null ? ps : ps.filter((p) => p.price <= budget));

      // Retry when results are thin OR a budget was stated and NONE of the
      // current results fit it (the cheap in-budget items often rank below the
      // limit on a narrow query).
      if (products.length < 2 || (budget != null && withinBudget(products).length === 0)) {
        const lastUser = [...messages].reverse().find((m: ApiMessage) => m.role === "user");
        const fallbackKws = lastUser ? extractKeywords(lastUser.content) : [];
        const fallbackQ   = fallbackKws.slice(0, 3).join(" ");
        if (fallbackQ && fallbackQ !== baseQuery) {
          try {
            const fallbackSearchQ =
              effectiveCat === "book"
                ? `${childPrefix}${fallbackQ} books`.trim()
                : effectiveCat && effectiveCat in CATEGORY_TERMS
                  ? categoryQuery(effectiveCat, convText)
                  : enrichGenericQuery(fallbackQ, recipientProfile, convText);
            const r2 = await callMCP("search_products", { q: fallbackSearchQ, limit: MCP_FETCH_LIMIT, in_stock_only: true, sort: "relevance", ...budgetArg(budget) });
            const c2 = filterProducts<Product>((r2.results || []).map(normaliseProduct), budget, fallbackKws, effectiveCat, excludeSympathy, dropFloral);
            const v2 = filterByIntent(`${effectiveCat ?? ""} ${baseQuery}`.trim(), c2);
            const pick2 = pickForCards(v2, budget);
            // Prefer the retry only if it gives more cards OR more within-budget cards.
            if (pick2.length > products.length || withinBudget(pick2).length > withinBudget(products).length) {
              products = pick2;
            }
          } catch { /* best-effort */ }
        }
      }

      // Budget broaden: if a budget was stated and STILL nothing fits it, do one
      // last broad search (the bare category term, large limit) before the agent
      // tells the user nothing is available.
      if (budget != null && effectiveCat && effectiveCat in CATEGORY_TERMS && withinBudget(products).length === 0) {
        try {
          const broadQ = categoryQuery(effectiveCat, ""); // bare category term, no narrowing
          const rb = await callMCP("search_products", { q: broadQ, limit: MCP_FETCH_LIMIT, in_stock_only: true, sort: "relevance", ...budgetArg(budget) });
          const cb = filterProducts<Product>((rb.results || []).map(normaliseProduct), budget, [effectiveCat], effectiveCat, excludeSympathy, dropFloral);
          const vb = filterByIntent(`${effectiveCat ?? ""} ${baseQuery}`.trim(), cb);
          const within = withinBudget(vb);
          if (within.length) products = within.slice(0, 8);
        } catch { /* best-effort */ }
      }

      // Store successful result in cache
      if (sid && products.length) cacheSet(cacheKey, products);
      } // end cache-miss block
      } // end non-flower branch
    } else if (intent.type === "track" && (intent as { orderNumber?: string }).orderNumber) {
      const orderNumber = (intent as { orderNumber: string }).orderNumber;
      // Inner try/catch so a thrown MCP failure becomes a graceful card + prompt
      // cue instead of being swallowed into null. A thrown error here is a
      // TRANSIENT MCP problem (timeout / 5xx / empty) — NOT proof the number is
      // wrong — so it maps to serviceError, not not-found. The delivered payload
      // is large and MCP can be slow to warm, so give tracking a longer timeout.
      try {
        const res = await callMCP("track_order", { order_number: orderNumber }, 12000);
        tracking = mapTracking(orderNumber, res as Record<string, unknown>);
      } catch (e) {
        console.error("track_order error:", (e as Error).message);
        tracking = serviceErrorTracking(orderNumber);
      }
    } else if (intent.type === "delivery" && (intent as { city?: string | null }).city) {
      const city = (intent as { city: string }).city;
      const res = await callMCP("check_delivery", { city });
      delivery = mapDelivery(city, res);
    }
  } catch (err) {
    console.error("MCP fetch error:", (err as Error).message);
    // A thrown error on a search intent (the catch is reached only after callMCP's
    // own retry) means the catalog service is genuinely unreachable this turn —
    // flag it so the agent apologises for the hiccup instead of going silently
    // productless. Track has its own inner try/catch (→ graceful not-found), so it
    // never lands here; this is the search/delivery path.
    if (intent.type === "search") mcpSearchFailed = true;
  }

  // Guard BEFORE constructing the client. `new Anthropic({ apiKey: undefined })`
  // throws synchronously at construction ("Could not resolve authentication
  // method"). When that ran outside the try below, a missing Production env var
  // crashed the function → Vercel HTML 500 → client's res.json() fails → opaque
  // "Network error". Return precise JSON instead.
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "Server config error: ANTHROPIC_API_KEY is not set in this environment" },
      { status: 500 }
    );
  }

  let message    = "";
  let checkoutUrl: string | null = null;
  let occasion: OccasionInfo | null = null;
  let giftMessage = false;
  let bundle: BundleInfo | null = null;
  let orderConfirmed = false;
  const addedProducts: Product[]   = [];
  const removedProducts: Product[] = [];
  // Checkout fields the agent captured THIS turn (from [CO_*] markers) → returned so
  // the client accumulates them into ChatState.checkoutData. The real create_order
  // result (pay-link + totals) and any graceful error also ride back on the response.
  const checkoutFields: CheckoutData = {};
  let checkout: CheckoutResult | null = null;
  let checkoutError: string | null = null;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemBlocks = buildSystemPrompt(userProfile, recipientProfile, products, tracking, priorProducts, clientState, mcpSearchFailed);

    const response = await client.messages.create(
      {
        model:      "claude-sonnet-4-6",
        max_tokens: 500,
        system:     systemBlocks,
        messages,
      },
      { timeout: 15_000 }
    );

    const u = response.usage;
    if (u) {
      console.log(
        `tokens — in: ${u.input_tokens}` +
        ` | cache_write: ${(u as { cache_creation_input_tokens?: number }).cache_creation_input_tokens || 0}` +
        ` | cache_read: ${(u as { cache_read_input_tokens?: number }).cache_read_input_tokens || 0}` +
        ` | out: ${u.output_tokens}`
      );
    }

    const rawText = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");

    // Strip every hidden UI marker + any leaked product dump → the agent's
    // natural prose. Used BOTH to reconcile the cards and (truncated) as the
    // message shown to the user, so the two are derived from the same text.
    const cleaned = stripToolCallXml(rawText
      .replace(/\[PRODUCTS\][\s\S]*?\[\/PRODUCTS\]/g, "")
      .replace(CHECKOUT_RE, "")
      .replace(OCCASION_RE, "")
      .replace(GIFT_RE, "")
      .replace(BUNDLE_RE, "")
      .replace(ORDER_RE, "")
      .replace(ADD_RE, "")
      .replace(REMOVE_RE, "")
      .replace(CO_NAME_RE, "")
      .replace(CO_PHONE_RE, "")
      .replace(CO_ADDR_RE, "")
      .replace(CO_CITY_RE, "")
      .replace(CO_DATE_RE, "")
      .replace(CO_SENDER_RE, "")
      .replace(CO_GIFTMSG_RE, "")
      .replace(/AVAILABLE PRODUCTS[^\n]*\n[\s\S]*?(?=\n\n[A-Z]|$)/gi, "")
      .replace(/\d+\.\s+[^\n]+(?:—|–)\s*LKR\s*[\d,]+[^\n]*/gi, "")
      .replace(/LAST SHOWN PRODUCTS[\s\S]*?(?=\n\n[A-Z]|$)/gi, "")
      .trim());

    // Reconcile the visible cards to the products the agent actually named, so
    // the carousel is a direct reflection of the reply — never a parallel pool.
    // - If the agent named products we can match → cards = exactly those.
    // - If it named none AND quoted no prices → it asked a question → no cards.
    // - If it quoted prices but the matcher found nothing → keep the pool (a
    //   matcher miss must not wipe a legitimate carousel).
    const reconciledCards = reconcileCards(cleaned, products);
    const agentNamedProducts = /\b(rs\.?|lkr)\s*[\d,]/i.test(cleaned);
    if (reconciledCards.length) {
      products = reconciledCards;
    } else if (!agentNamedProducts) {
      products = [];
    }

    const cm = rawText.match(CHECKOUT_RE);
    if (cm) checkoutUrl = cm[1];

    // [CO_*] checkout fields the user just provided → collect for the client to
    // accumulate. Parsed from raw (markers already stripped from `cleaned`).
    {
      const grab = (re: RegExp) => { const m = rawText.match(re); return m ? m[1].trim() : ""; };
      const name = grab(CO_NAME_RE);   if (name)   checkoutFields.recipientName = name;
      const phone = grab(CO_PHONE_RE); if (phone)  checkoutFields.phone = phone;
      const addr = grab(CO_ADDR_RE);   if (addr)   checkoutFields.address = addr;
      const city = grab(CO_CITY_RE);   if (city)   checkoutFields.city = city;
      const date = grab(CO_DATE_RE);   if (date)   checkoutFields.date = date;
      const sender = grab(CO_SENDER_RE); if (sender) checkoutFields.senderName = sender;
      const gmsg = grab(CO_GIFTMSG_RE); if (gmsg)  checkoutFields.giftMessage = gmsg;
    }

    // Hidden UI markers → structured fields (parsed from raw, stripped from message).
    // ORDER_CONFIRMED must be parsed first — occasion chip is suppressed when checkout
    // fires in the same response (prevents the "Birthday Today!" chip appearing at checkout).
    if (ORDER_RE.test(rawText)) orderConfirmed = true;

    // Order confirmed → build + place the guest checkout via kapruka_create_order.
    // Merge the fields collected across the session (clientState.checkoutData) with
    // any captured THIS turn, fall back to the confirmed delivery city, then gate on
    // the required set. The STATE block should stop the agent confirming early, but
    // this is the server-side safety net: on incomplete data we do NOT create an order
    // (orderConfirmed is downgraded) and return a checkoutError instead of a broken card.
    if (orderConfirmed) {
      const merged: CheckoutData = { ...(clientState?.checkoutData || {}), ...checkoutFields };
      if (!merged.city && clientState?.deliveryCity) merged.city = clientState.deliveryCity;
      const missing = missingCheckoutFields({ ...(clientState as ChatState), checkoutData: merged, deliveryCity: clientState?.deliveryCity ?? null });
      if (!cartForOrder.length) {
        orderConfirmed = false;
        checkoutError = "empty_cart";
      } else if (missing.length) {
        // Agent jumped the gun — suppress the checkout, let the [CHECKOUT] line steer
        // the next turn to collect what's missing.
        orderConfirmed = false;
        checkoutError = `missing:${missing.join(",")}`;
        console.log(`[checkout] ORDER_CONFIRMED but missing fields: ${missing.join(", ")} — suppressed`);
      } else {
        try {
          const canonCity = await canonicaliseCity(merged.city!, merged.address || "");
          if (!canonCity) {
            orderConfirmed = false;
            checkoutError = "city_not_deliverable";
          } else {
            checkout = await createOrder(cartForOrder, merged, canonCity, (userProfile?.name || "").trim());
          }
        } catch (e) {
          orderConfirmed = false;
          checkoutError = (e as Error).message || "checkout_failed";
          console.error("[checkout] create_order error:", checkoutError);
        }
      }
    }
    const om = !orderConfirmed ? rawText.match(OCCASION_RE) : null;
    if (om) {
      const occ = buildOccasion(om[1], convText);
      if (occ.targetDate) occasion = occ;
    }
    if (GIFT_RE.test(rawText)) giftMessage = true;

    // [ADD_TO_CART: name] — resolve each confirmed add to a real product from this
    // turn's results or the last carousel, so the client syncs the cart + dock.
    // Done BEFORE the bundle reset below so `products` is still populated.
    {
      const pool = [...products, ...priorProducts];
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const seen = new Set<string>();
      let m: RegExpExecArray | null;
      ADD_RE.lastIndex = 0;
      while ((m = ADD_RE.exec(rawText)) !== null) {
        const want = norm(m[1]);
        if (!want) continue;
        const match =
          pool.find((p) => norm(p.name) === want) ||
          pool.find((p) => { const n = norm(p.name); return !!n && (n.includes(want) || want.includes(n)); });
        if (!match) continue;
        const key = match.id || norm(match.name);
        if (seen.has(key)) continue;
        seen.add(key);
        addedProducts.push(match);
      }
    }

    // [REMOVE_FROM_CART: name] — resolve each removal to a real product and return
    // it so the client can sync the cart dock. Same pool + norm logic as ADD_RE.
    {
      const pool = [...products, ...priorProducts];
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const seen = new Set<string>();
      let m: RegExpExecArray | null;
      REMOVE_RE.lastIndex = 0;
      while ((m = REMOVE_RE.exec(rawText)) !== null) {
        const want = norm(m[1]);
        if (!want) continue;
        const match =
          pool.find((p) => norm(p.name) === want) ||
          pool.find((p) => { const n = norm(p.name); return !!n && (n.includes(want) || want.includes(n)); });
        if (!match) continue;
        const key = match.id || norm(match.name);
        if (seen.has(key)) continue;
        seen.add(key);
        removedProducts.push(match);
      }
    }

    if (BUNDLE_RE.test(rawText) && products.length >= 2) {
      const total = products.reduce((s, p) => s + Number(p.price || 0), 0);
      bundle = { title: "A bundle made for the occasion", items: products, total };
      products = []; // render as a grouped bundle instead of a plain carousel
    }

    // `cleaned` already has every marker + leaked product dump stripped (computed
    // above for card reconciliation) — just truncate it to the visible message.
    message = truncateToSentences(cleaned, 3);

    // FALSE-SUCCESS GUARD: the agent emitted [ORDER_CONFIRMED] and wrote a
    // "placing your order!" reply, but create_order was suppressed/failed
    // (checkoutError). Never show a success message when no order exists — replace
    // it with an honest, tailored line so the user knows what to fix. Only fires
    // when the message actually implies success, so a correct "what's your phone?"
    // ask is left untouched.
    if (checkoutError && /\b(plac(ed|ing)|order (is |placed|ready|confirmed|done)|checkout now|on its way|all set|enjoy)\b/i.test(message)) {
      if (checkoutError === "city_not_deliverable") {
        message = "Hmm, I couldn't confirm delivery to that city — could you double-check it or share a nearby town, and I'll place the order right away?";
      } else if (checkoutError === "empty_cart") {
        message = "Your cart looks empty — add an item and I'll get the order ready for you.";
      } else if (checkoutError.startsWith("missing:")) {
        const fields = checkoutError.slice(8).replace(/,/g, ", ");
        message = `I just need a couple more details before I can place it — could you share your ${fields}?`;
      } else {
        message = "Something hiccuped while placing the order just now — want me to try that again?";
      }
    }

  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return Response.json({ error: (err as Error).message || "Internal server error" }, { status });
  }

  return Response.json({ message, products, checkoutUrl, delivery, tracking, occasion, giftMessage, bundle, orderConfirmed, addedProducts, removedProducts, checkoutFields, checkout, checkoutError });
}
