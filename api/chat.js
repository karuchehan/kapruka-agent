import Anthropic  from "@anthropic-ai/sdk";
import fs         from "fs";
import path       from "path";
import { spawn }  from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

const BASE_SYSTEM_PROMPT = fs.readFileSync(
  path.join(ROOT, "directives", "system_prompt.md"),
  "utf8"
);

const CHECKOUT_RE = /\[CHECKOUT_URL\](https?:\/\/[^\s]+)\[\/CHECKOUT_URL\]/;

// ── SENTENCE TRUNCATOR ────────────────────────────────────────────────────────

function truncateToSentences(text, max) {
  // Split on sentence-ending punctuation followed by space or end
  const matches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!matches) return text;
  return matches.slice(0, max).join("").trim();
}

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
]);

// ── INTENT DETECTION ──────────────────────────────────────────────────────────

// Context words that pollute product search — occasions, recipients, intent verbs
const CONTEXT_WORDS = new Set([
  "gift","gifts","present","presents","surprise","buy","purchase","send","order",
  "birthday","anniversary","christmas","valentine","wedding","graduation","newborn",
  "mother","father","dad","mum","mom","sister","brother","friend","wife","husband",
  "boyfriend","girlfriend","aunt","uncle","grandma","grandpa","colleague","boss",
  "loves","like","enjoy","enjoy","needs","want","wants","prefer","prefers",
  "something","nice","good","great","perfect","special","best","awesome","wonderful",
  "looking","find","get","show","help","give","recommend","suggest",
  "years","old","aged","aged","male","female","man","woman","boy","girl","person",
  "celebrate","celebrating","occasion","event","party","ceremony",
  "abroad","international","overseas","overseas","deliver","delivery","send",
  "lucky","sweet","love",
]);

function extractKeywords(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w) && !CONTEXT_WORDS.has(w) && !/^\d+$/.test(w))
    .slice(0, 7);
}

// Build composite query from last 3 user messages — captures multi-turn context
function buildSearchQuery(messages) {
  const userMessages = messages
    .filter(m => m.role === "user")
    .slice(-3)
    .map(m => m.content);

  const allKeywords = [];
  const seen = new Set();
  for (const text of userMessages) {
    for (const kw of extractKeywords(text)) {
      if (!seen.has(kw)) {
        seen.add(kw);
        allKeywords.push(kw);
      }
    }
  }

  const query = allKeywords.slice(0, 5).join(" ");
  return query || userMessages[userMessages.length - 1]?.trim().slice(0, 60) || "";
}

function detectIntent(messages) {
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  if (!lastUser) return { type: "none" };

  const text  = lastUser.content;
  const lower = text.toLowerCase();

  // Order tracking
  if (/\b(track|tracking|order status|where.*order|order.*where)\b/.test(lower)) {
    const match = text.match(/\b([A-Z]{2,6}\d{4,12}[A-Z0-9]*)\b/);
    if (match) return { type: "track", orderNumber: match[1] };
    return { type: "track", orderNumber: null };
  }

  // Delivery check — only when city explicitly mentioned
  if (/\b(deliver|delivery|ship|arrive|arrives|arrival)\b/.test(lower) &&
      /\b(to|in|at)\b/.test(lower)) {
    return { type: "delivery" };
  }

  // Non-shopping responses (acknowledgments, cart actions)
  if (/^(yes|no|ok|okay|sure|thanks|thank|great|perfect|add|remove|cancel|done|got it|sounds good|proceed|checkout)\b/i.test(text.trim())) {
    return { type: "none" };
  }

  // Default: product search — composite query across last 3 user messages
  const query = buildSearchQuery(messages);
  return { type: "search", query };
}

// ── PYTHON MCP CALLER ─────────────────────────────────────────────────────────

function callMCP(tool, args, timeoutMs = 18000) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(ROOT, "execution", "tools", "kapruka_mcp.py");
    const proc = spawn("python3", [scriptPath, tool, JSON.stringify(args)]);

    let stdout = "", stderr = "";
    proc.stdout.on("data", d => (stdout += d));
    proc.stderr.on("data", d => (stderr += d));

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`MCP ${tool} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on("close", code => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`MCP ${tool} failed (${code}): ${stderr.trim()}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`MCP ${tool} returned invalid JSON: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

// ── SYSTEM PROMPT BUILDER ─────────────────────────────────────────────────────

function buildSystemPrompt(userProfile, recipientProfile, liveProducts) {
  let parts = [];

  if (userProfile?.name) {
    let p = `USER PROFILE\nName: ${userProfile.name}`;
    if (userProfile.age)    p += ` | Age: ${userProfile.age}`;
    if (userProfile.gender) p += ` | Gender: ${userProfile.gender}`;
    parts.push(p);
  }

  if (recipientProfile?.relationship) {
    let r = `RECIPIENT PROFILE\nRelationship: ${recipientProfile.relationship}`;
    if (recipientProfile.age)    r += ` | Age: ${recipientProfile.age}`;
    if (recipientProfile.gender) r += ` | Gender: ${recipientProfile.gender}`;
    parts.push(r);
  }

  // Slim product list for Claude — name + price only, no image URLs
  if (liveProducts?.length) {
    const slim = liveProducts.map((p, i) =>
      `${i + 1}. ${p.name} — LKR ${p.price}`
    ).join("\n");
    parts.push(`AVAILABLE PRODUCTS (already fetched — recommend from these):\n${slim}`);
  }

  parts.push(BASE_SYSTEM_PROMPT);

  return parts.join("\n\n---\n\n");
}

// ── NORMALISE PRODUCT FIELDS ──────────────────────────────────────────────────

function normaliseProduct(p) {
  // price may be a number OR {amount, currency} object
  const rawPrice = p.price ?? p.sale_price ?? p.regular_price ?? 0;
  const price = typeof rawPrice === "object" ? (rawPrice?.amount ?? 0) : rawPrice;

  return {
    id:        p.id        || p.product_id || "",
    name:      p.name      || p.title      || "",
    price,
    image_url: p.image_url || p.image      || p.thumbnail     || "",
    url:       p.url       || p.product_url || p.link         || "",
  };
}

// ── HANDLER ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const { messages, userProfile, recipientProfile } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  // ── 1. Detect intent from full message history ───────────────────────────
  const intent = detectIntent(messages);

  // ── 2. Fetch live products deterministically (Python) ────────────────────
  let products    = [];   // always populated from Python results
  let trackingData = null;

  try {
    if (intent.type === "search" && intent.query) {
      const result = await callMCP("search_products", {
        q:             intent.query,
        limit:         8,
        in_stock_only: true,
        sort:          "relevance",
      });
      if (result.results?.length) {
        products = result.results.slice(0, 4).map(normaliseProduct);
      }

      // Fallback: if composite query returned < 2, retry with just the last user message keyword
      if (products.length < 2) {
        const lastUser = [...messages].reverse().find(m => m.role === "user");
        const fallbackKws = lastUser ? extractKeywords(lastUser.content) : [];
        const fallbackQ   = fallbackKws.slice(0, 3).join(" ");
        if (fallbackQ && fallbackQ !== intent.query) {
          try {
            const r2 = await callMCP("search_products", {
              q:             fallbackQ,
              limit:         8,
              in_stock_only: true,
              sort:          "relevance",
            });
            if ((r2.results?.length || 0) > products.length) {
              products = r2.results.slice(0, 4).map(normaliseProduct);
            }
          } catch (_) { /* best-effort */ }
        }
      }
    } else if (intent.type === "track" && intent.orderNumber) {
      const result = await callMCP("track_order", { order_number: intent.orderNumber });
      trackingData = result;
    }
  } catch (err) {
    console.error("MCP fetch error:", err.message);
    // Non-fatal — continue without live data
  }

  // ── 3. Call Claude — text only, products are already determined ──────────
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let message    = "";
  let checkoutUrl = null;

  try {
    const systemPrompt = buildSystemPrompt(userProfile, recipientProfile, products);

    const extraContext = trackingData
      ? `\n\nOrder tracking result:\n${JSON.stringify(trackingData, null, 2)}`
      : "";

    const augmentedSystem = extraContext
      ? systemPrompt + extraContext
      : systemPrompt;

    const response = await client.messages.create(
      {
        model:      "claude-sonnet-4-6",
        max_tokens: 768,
        system:     augmentedSystem,
        messages,
      },
      { timeout: 30_000 }
    );

    const rawText = response.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    // Extract checkout URL if present
    const cm = rawText.match(CHECKOUT_RE);
    if (cm) checkoutUrl = cm[1];

    // Strip any PRODUCTS block Claude may have attempted (we ignore it)
    message = rawText
      .replace(/\[PRODUCTS\][\s\S]*?\[\/PRODUCTS\]/g, "")
      .replace(CHECKOUT_RE, "")
      .trim();

    // Hard cap: keep only first 3 sentences
    message = truncateToSentences(message, 3);

  } catch (err) {
    console.error("Claude error:", err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "Internal server error" });
  }

  // ── 4. Return — products always from Python, message always from Claude ──
  res.status(200).json({ message, products, checkoutUrl });
}
