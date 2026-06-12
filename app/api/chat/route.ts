import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { extractBudget, filterProducts } from "@/lib/productFilter";

const BASE_SYSTEM_PROMPT = readFileSync(
  join(process.cwd(), "directives", "system_prompt.md"),
  "utf8"
);

// Raise the serverless function timeout. The handler chains MCP init+call
// (+ a possible fallback re-search) and an Anthropic call; on the platform's
// low default cap a cold start + cross-region MCP latency can exceed it, and
// Vercel then returns a non-JSON 5xx — which the client surfaces as the
// unhelpful "Network error". 60s is the Hobby maximum.
export const maxDuration = 60;

const CHECKOUT_RE = /\[CHECKOUT_URL\](https?:\/\/[^\s]+)\[\/CHECKOUT_URL\]/;

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
    return { type: "delivery" };
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

// ── ROUTE HANDLER ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { messages, userProfile, recipientProfile, lastShownProducts } = await req.json();

  if (!messages || !Array.isArray(messages)) {
    return Response.json({ error: "messages array required" }, { status: 400 });
  }

  const priorProducts: Product[] = Array.isArray(lastShownProducts)
    ? (lastShownProducts as Product[])
    : [];

  const intent = detectIntent(messages);
  const budget = extractBudget(messages);

  let products: Product[] = [];
  let trackingData = null;

  try {
    if (intent.type === "search" && (intent as { query?: string }).query) {
      const result = await callMCP("search_products", {
        q:             (intent as { query: string }).query,
        limit:         8,
        in_stock_only: true,
        sort:          "relevance",
      });
      // Filter junk (vendor listings, no-image, zero-price), over-budget, and
      // off-topic results (relevance gate) BEFORE slicing — cards rendered in UI
      // come from this array, not Claude.
      const queryTokens = (intent as { query: string }).query.split(/\s+/);
      if (result.results?.length) {
        const candidates = filterProducts<Product>(result.results.map(normaliseProduct), budget, queryTokens);
        products = candidates.slice(0, 4);
      }

      if (products.length < 2) {
        const lastUser = [...messages].reverse().find((m: ApiMessage) => m.role === "user");
        const fallbackKws = lastUser ? extractKeywords(lastUser.content) : [];
        const fallbackQ   = fallbackKws.slice(0, 3).join(" ");
        if (fallbackQ && fallbackQ !== (intent as { query: string }).query) {
          try {
            const r2 = await callMCP("search_products", { q: fallbackQ, limit: 8, in_stock_only: true, sort: "relevance" });
            const c2 = filterProducts<Product>((r2.results || []).map(normaliseProduct), budget, fallbackKws);
            if (c2.length > products.length) {
              products = c2.slice(0, 4);
            }
          } catch { /* best-effort */ }
        }
      }
    } else if (intent.type === "track" && (intent as { orderNumber?: string }).orderNumber) {
      trackingData = await callMCP("track_order", { order_number: (intent as { orderNumber: string }).orderNumber });
    }
  } catch (err) {
    console.error("MCP fetch error:", (err as Error).message);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let message    = "";
  let checkoutUrl: string | null = null;

  try {
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

    message = truncateToSentences(
      rawText
        .replace(/\[PRODUCTS\][\s\S]*?\[\/PRODUCTS\]/g, "")
        .replace(CHECKOUT_RE, "")
        .trim(),
      3
    );

  } catch (err) {
    const status = (err as { status?: number }).status || 500;
    return Response.json({ error: (err as Error).message || "Internal server error" }, { status });
  }

  return Response.json({ message, products, checkoutUrl });
}
