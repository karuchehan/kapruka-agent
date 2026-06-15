import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { extractBudget, filterProducts } from "@/lib/productFilter";

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

// Search one category and return on-topic, in-budget products (category-gated).
async function searchCategory(
  cat: string,
  convText: string,
  budget: number | null,
  take: number,
  excludeSympathy: boolean,
  dropFloral: boolean,
): Promise<Product[]> {
  const q = categoryQuery(cat, convText);
  const r = await callMCP("search_products", { q, limit: 8, in_stock_only: true, sort: "relevance" });
  // Never drop floral when this very category IS flower (explicit per-category search).
  const c = filterProducts<Product>((r.results || []).map(normaliseProduct), budget, [cat], cat, excludeSympathy, dropFloral && cat !== "flower");
  return c.slice(0, take);
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

  if (/\b(track|tracking|order status|where.*order|order.*where)\b/.test(lower)) {
    const match = text.match(/\b([A-Z]{2,6}\d{4,12}[A-Z0-9]*)\b/);
    if (match) return { type: "track", orderNumber: match[1] };
    return { type: "track", orderNumber: null };
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

async function callMCP(tool: string, args: Record<string, unknown>, timeoutMs = 6000) {
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

function buildSystemPrompt(
  userProfile: UserProfile | null,
  recipientProfile: RecipientProfile | null,
  liveProducts: Product[],
  trackingData: unknown,
  lastShownProducts: Product[]
) {
  const dynamicParts: string[] = [];

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

  if (trackingData) {
    dynamicParts.push(`Order tracking result:\n${JSON.stringify(trackingData, null, 2)}`);
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

interface Product { id: string; name: string; price: number; image_url: string; url: string; category?: string; summary?: string; }

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
  return {
    id:        String(p.id || p.product_id || ""),
    name:      String(p.name || p.title || ""),
    price:     Number(price),
    image_url: String(p.image_url || p.image || p.thumbnail || ""),
    url:       String(p.url || p.product_url || p.link || ""),
    category,
    summary:   String(p.summary || p.description || p.short_description || ""),
  };
}

// ── SERVER-SIDE SENTENCE TRUNCATION ──────────────────────────────────────────

function truncateToSentences(text: string, n = 2): string {
  // Split only on sentence-end + whitespace + capital/quote — avoids splitting "Rs. 1,200"
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z"'(—])/);
  return parts.slice(0, n).join(" ").trim();
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

// ── ROUTE HANDLER ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Surface a config failure as JSON (not a module crash → opaque "Network error").
  if (!BASE_SYSTEM_PROMPT) {
    return Response.json({ error: `Server config error: ${PROMPT_LOAD_ERROR}` }, { status: 500 });
  }

  const { messages, userProfile, recipientProfile, lastShownProducts } = await req.json();

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
    categoryHint === "flower" || msgCats.includes("flower") || /\b(flower|bouquet|roses?|floral|bloom)\b/.test(userText);
  const dropFloral = recipientMale && !recipientFemale && !explicitFlowerRequest;

  // Occasion-based negative filter: strip funeral/sympathy/get-well items when
  // the flow is celebratory — UNLESS the user actually asked for sympathy/get-well
  // (then keep them so genuine condolence/recovery orders still work).
  const sympathyCtx = /\b(funeral|sympath\w*|condolence|bereave\w*|mourning|memorial|get\s*well|hospital)\b/.test(convText);
  const celebratory = /\b(birthday|anniversary|wedding|valentine|graduation|newborn|congrat\w*|celebrat\w*|baby\s+shower)\b/.test(convText);
  const excludeSympathy = celebratory && !sympathyCtx;

  let products: Product[] = [];
  let trackingData = null;
  let delivery: DeliveryInfo | null = null;

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
    } else if (intent.type === "search" && (intent as { query?: string }).query) {
      const baseQuery = (intent as { query: string }).query;
      // Enrich the MCP query in a book flow. A bare genre word ("adventure")
      // makes MCP rank adventure-themed CAKES/GAMES first. The phrasing
      // "kids <genre> books" flips results to genuine children's books
      // (The Journey, Dork Diaries, Madol Doova) — verified against the live
      // MCP; word order and the plural matter ("adventure books for kids"
      // regresses to piano courses). Keep the gate's queryTokens as the raw
      // genre so relevance still matches on the genre, not on "book".
      const childPrefix =
        categoryHint === "book" && recipientProfile?.age != null && recipientProfile.age <= 12
          ? "kids "
          : "";
      const searchQuery =
        categoryHint === "book"
          ? `${childPrefix}${baseQuery} books`.trim()
          : categoryHint && categoryHint in CATEGORY_TERMS
            ? categoryQuery(categoryHint, convText) // explicit category, no gender prefix
            : enrichGenericQuery(baseQuery, recipientProfile, convText);

      const result = await callMCP("search_products", {
        q:             searchQuery,
        limit:         8,
        in_stock_only: true,
        sort:          "relevance",
      });
      // Filter junk (vendor listings, no-image, zero-price), over-budget, and
      // off-topic results (relevance gate) BEFORE slicing — cards rendered in UI
      // come from this array, not Claude.
      const queryTokens = baseQuery.split(/\s+/);
      if (result.results?.length) {
        const candidates = filterProducts<Product>(result.results.map(normaliseProduct), budget, queryTokens, categoryHint, excludeSympathy, dropFloral);
        products = candidates.slice(0, 4);
      }

      if (products.length < 2) {
        const lastUser = [...messages].reverse().find((m: ApiMessage) => m.role === "user");
        const fallbackKws = lastUser ? extractKeywords(lastUser.content) : [];
        const fallbackQ   = fallbackKws.slice(0, 3).join(" ");
        if (fallbackQ && fallbackQ !== baseQuery) {
          try {
            const fallbackSearchQ =
              categoryHint === "book"
                ? `${childPrefix}${fallbackQ} books`.trim()
                : categoryHint && categoryHint in CATEGORY_TERMS
                  ? categoryQuery(categoryHint, convText)
                  : enrichGenericQuery(fallbackQ, recipientProfile, convText);
            const r2 = await callMCP("search_products", { q: fallbackSearchQ, limit: 8, in_stock_only: true, sort: "relevance" });
            const c2 = filterProducts<Product>((r2.results || []).map(normaliseProduct), budget, fallbackKws, categoryHint, excludeSympathy, dropFloral);
            if (c2.length > products.length) {
              products = c2.slice(0, 4);
            }
          } catch { /* best-effort */ }
        }
      }
    } else if (intent.type === "track" && (intent as { orderNumber?: string }).orderNumber) {
      trackingData = await callMCP("track_order", { order_number: (intent as { orderNumber: string }).orderNumber });
    } else if (intent.type === "delivery" && (intent as { city?: string | null }).city) {
      const city = (intent as { city: string }).city;
      const res = await callMCP("check_delivery", { city });
      delivery = mapDelivery(city, res);
    }
  } catch (err) {
    console.error("MCP fetch error:", (err as Error).message);
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
  const addedProducts: Product[] = [];

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemBlocks = buildSystemPrompt(userProfile, recipientProfile, products, trackingData, priorProducts);

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

    const cm = rawText.match(CHECKOUT_RE);
    if (cm) checkoutUrl = cm[1];

    // Hidden UI markers → structured fields (parsed from raw, stripped from message).
    const om = rawText.match(OCCASION_RE);
    if (om) {
      const occ = buildOccasion(om[1], convText);
      if (occ.targetDate) occasion = occ;
    }
    if (GIFT_RE.test(rawText)) giftMessage = true;
    if (ORDER_RE.test(rawText)) orderConfirmed = true;

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

    if (BUNDLE_RE.test(rawText) && products.length >= 2) {
      const total = products.reduce((s, p) => s + Number(p.price || 0), 0);
      bundle = { title: "A bundle made for the occasion", items: products, total };
      products = []; // render as a grouped bundle instead of a plain carousel
    }

    message = truncateToSentences(
      rawText
        .replace(/\[PRODUCTS\][\s\S]*?\[\/PRODUCTS\]/g, "")
        .replace(CHECKOUT_RE, "")
        .replace(OCCASION_RE, "")
        .replace(GIFT_RE, "")
        .replace(BUNDLE_RE, "")
        .replace(ORDER_RE, "")
        .replace(ADD_RE, "")
        .trim(),
      3
    );

  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return Response.json({ error: (err as Error).message || "Internal server error" }, { status });
  }

  return Response.json({ message, products, checkoutUrl, delivery, occasion, giftMessage, bundle, orderConfirmed, addedProducts });
}
