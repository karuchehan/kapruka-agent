// Product relevancy filtering — runs in app/api/chat/route.ts BEFORE products
// are shipped to the frontend. The cards rendered in the UI come from this
// filtered array, not from Claude. Keep this pure + deterministic so it can be
// tested against live MCP data without an Anthropic call.

interface FilterableProduct {
  name: string;
  price: number;
  image_url: string;
  category?: string;
  summary?: string;
}

interface BudgetMessage {
  role: string;
  content: string;
}

// Extract a stated budget (max price) from the conversation.
// Scans most-recent user message first — a budget, once stated, applies for
// the rest of the conversation. Returns null if no budget mentioned.
export function extractBudget(messages: BudgetMessage[]): number | null {
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content);

  for (let i = userTexts.length - 1; i >= 0; i--) {
    const t = userTexts[i].toLowerCase();

    // keyword → amount  ("under Rs 2000", "budget is 2,000", "around 500")
    const m1 = t.match(
      /(?:under|below|less than|cheaper than|max|maximum|up to|within|budget(?:\s+is|\s+of)?|around|about|no more than)\s*(?:rs\.?|lkr|rupees)?\s*(\d[\d,]*)/
    );
    if (m1) {
      const n = parseInt(m1[1].replace(/,/g, ""), 10);
      if (n > 0) return n;
    }

    // amount → keyword  ("Rs 2000 budget", "2000 or less")
    const m2 = t.match(
      /(?:rs\.?|lkr|rupees)?\s*(\d[\d,]*)\s*(?:budget|or less|or below|max|maximum)/
    );
    if (m2) {
      const n = parseInt(m2[1].replace(/,/g, ""), 10);
      if (n > 0) return n;
    }
  }
  return null;
}

// Company/vendor-listing name markers. A result whose NAME matches these is a
// shop/vendor listing (e.g. "Dinapala Electronics", "ABC Traders (Pvt) Ltd"),
// not an actual product — even if it has an image and a nonzero price.
const VENDOR_MARKERS = /\b(?:\(?pvt\)?|ltd|enterprises|traders?|distributors?|holdings|importers?|exporters?)\b/i;
// Short names that are just "<Brand> Electronics" / "...Trading" / "...Stores"
// — a real product name carries the item (e.g. "...Weighing Scale"), not just a shop noun.
const VENDOR_SUFFIX = /^(?:[\w&.'-]+\s+){0,2}(?:electronics?|trading|stores?|mart|emporium|agencies)$/i;

export function isVendorName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (VENDOR_MARKERS.test(n)) return true;
  if (VENDOR_SUFFIX.test(n)) return true;
  return false;
}

// Products that are clearly NOT books. When the shopper is in a book flow
// (categoryHint === "book") these leak in via loose MCP matching on a single
// genre word — e.g. "Winnie's Woodland Adventure ... Cake", "Uncharted 4
// (PS4 Game)", and "Ceylon Extreme Adventures — Full Day Tour Package" all
// share the token "adventure" with an "adventure" query. Reject them so a book
// search never surfaces a cake, a video game, or an experience voucher.
// Markers are deliberately specific (console brands, "(ps4 game)", "cake",
// "tour package") so a genuine title like "A Game of Thrones" is NOT caught by
// a bare "game", and "Diary of a Wimpy Kid: The Getaway" is not caught by a
// bare "getaway".
const NON_BOOK_MARKERS = /\b(?:cake|gateau|cupcake|hamper|bouquet|flowers?|chocolates?|playstation|ps[45]|xbox|nintendo|console|tour\s+package|day\s+tour|voucher|experience|spa\s+package)\b|\(\s*ps[45][^)]*\)|\(\s*nintendo[^)]*\)|game\s*\)/i;

export function isNonBook(name: string): boolean {
  return NON_BOOK_MARKERS.test(name);
}

// Positive book signal. A blocklist of non-book junk is whack-a-mole — real
// Kapruka noise like "Switch Game Jojo's Bizarre Adventure", "Paw Patrol
// Pillow", and "Ceylon-extreme-adventures-" share a genre word but no closing
// "(...)", so a name-only blocklist misses them. Instead, allowlist: genuine
// Kapruka book products carry a "Books" breadcrumb in their summary/category
// (e.g. "specialGifts - Kpc, Books, Children'sbook BOOKS ...") or an obvious
// book token in the title. In a book flow, keep ONLY products with that signal.
const BOOK_SIGNALS = /\b(?:books?|novels?|paperback|hardback|hardcover|hardbound|isbn|memoir|autobiograph|biograph|storybook|comics?|graphic\s+novel|childrens?\s*book|fiction)\b/i;

export function isBookish(p: FilterableProduct): boolean {
  return BOOK_SIGNALS.test(`${p.name} ${p.category ?? ""} ${p.summary ?? ""}`);
}

// Per-category positive signals for the non-book gift categories. Used as an
// allowlist so a category search only surfaces in-category products — a flowers
// search never returns a cake, a cake search never returns a phone. The strong
// item word ("bouquet"/"cake"/"chocolate") is almost always in the Kapruka
// product name, so the allowlist is reliable without being over-tight.
const CATEGORY_SIGNALS: Record<string, RegExp> = {
  flower:    /\b(flowers?|bouquet|roses?|floral|blooms?|orchids?|lilies|lily|carnations?|arrangement|anthurium|gerbera)\b/i,
  cake:      /\b(cakes?|gateau|gateaux|cupcakes?|cheesecake)\b/i,
  chocolate: /\b(chocolates?|choco|truffles?|pralines?|ferrero|toblerone|lindt)\b/i,
  hamper:    /\b(hampers?|gift\s*baskets?|gift\s*box(?:es)?)\b/i,
};

export function isKnownCategory(cat: string | null | undefined): boolean {
  return !!cat && (cat === "book" || cat in CATEGORY_SIGNALS);
}

function categoryMatch(p: FilterableProduct, cat: string): boolean {
  const re = CATEGORY_SIGNALS[cat];
  if (!re) return true;
  return re.test(`${p.name} ${p.category ?? ""} ${p.summary ?? ""}`);
}

// Sympathy / get-well markers. These products (funeral wreaths, condolence
// arrangements, get-well bouquets) pass the positive "flower" category gate but
// are a tonal mismatch in a celebratory flow (a funeral wreath surfacing for a
// birthday). Dropped only when the caller sets excludeSympathy (celebratory
// occasion AND the user did not actually ask for sympathy/get-well items).
const SYMPATHY_MARKERS =
  /\b(funeral|wreaths?|sympath\w*|condolences?|bereave\w*|mourning|memorial|in\s+loving\s+memory|rest\s+in\s+peace|r\.?i\.?p\.?|casket|coffin|get\s*well|hospital|recovery)\b/i;

export function isSympathy(p: FilterableProduct): boolean {
  return SYMPATHY_MARKERS.test(`${p.name} ${p.category ?? ""} ${p.summary ?? ""}`);
}

// True when a product is a flower bouquet / floral arrangement. Used by the
// male-recipient gender gate: a "brother's birthday, into food/gadgets" flow
// should never surface pink rose bouquets as the primary results. Dropped only
// when the caller sets dropFloral (male recipient AND the user did not actually
// ask for flowers).
export function isFloral(p: FilterableProduct): boolean {
  return CATEGORY_SIGNALS.flower.test(`${p.name} ${p.category ?? ""} ${p.summary ?? ""}`);
}

// A result is junk (vendor/shop listing, not a real product) when:
// - it has no image (vendor listings on Kapruka MCP frequently lack one), or
// - its price is zero/negative (placeholder listing), or
// - its name reads as a company/vendor listing rather than a product.
export function isJunkProduct(p: FilterableProduct): boolean {
  if (!p.image_url || !p.image_url.trim()) return true;
  if (!(p.price > 0)) return true;
  if (isVendorName(p.name)) return true;
  return false;
}

// Generic container stems (mirror of route.ts GENERIC_QUERY_WORDS, after stem()).
// A query made only of these is too broad to discriminate — keep the unfiltered
// fallback. A query with anything ELSE is specific enough that zero matches means
// MCP returned junk → return empty rather than show wrong products.
const GENERIC_FILTER_STEMS = new Set(["book", "item", "product", "thing"]);

// Light stem: lowercase, strip non-alnum, drop a common trailing inflection so
// "autobiographies" ~ "autobiography", "watches" ~ "watch". Not linguistically
// correct — just enough to match a query genre token against a product/category.
function stem(w: string): string {
  const base = w.toLowerCase().replace(/[^a-z0-9]/g, "");
  return base.replace(/(ies|es|s|y)$/, "");
}

function stemTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(stem)
    .filter((t) => t.length >= 3);
}

// Keep only products whose name/category/summary shares a (stemmed) token with
// the search query. Guards against MCP returning off-type results (e.g. fiction
// for an "autobiography" query).
//
// Fallback is at ZERO survivors, not <2. Live MCP data showed the genre word
// often appears in only ONE result's summary (e.g. Gandhi's says "Autobiography"
// but Gorky's says "Translations") — a <2 threshold re-admitted the fiction in
// exactly the case the gate exists to catch. One on-topic card beats four with
// three off-topic. (route.ts has its own <2 re-search fallback for thin results.)
function relevanceGate<T extends FilterableProduct>(
  products: T[],
  queryTokens: string[],
  categoryHint?: string | null
): T[] {
  const qStems = [...new Set(queryTokens.map(stem).filter((t) => t.length >= 3))];
  if (!qStems.length) return products;

  const wantsFiction = qStems.includes("fiction");
  const gated = products.filter((p) => {
    // Genre/type signal lives in name + category + summary (MCP category is
    // almost always "General"; summary carries "Non Fiction Autobiography" etc).
    const raw = `${p.name} ${p.category ?? ""} ${p.summary ?? ""}`.toLowerCase();
    // "Non Fiction" tokenises to ["non","fiction"], so a non-fiction title would
    // otherwise satisfy a "fiction" query. Exclude it explicitly.
    if (wantsFiction && /\bnon[\s-]?fiction\b/.test(raw)) return false;
    const hay = stemTokens(raw);
    return qStems.some((q) => hay.some((h) => h === q || h.includes(q) || q.includes(h)));
  });

  if (gated.length >= 1) return gated;

  // Zero genre matches. If the query carried a SPECIFIC token (not just a
  // generic container like "book"/"thing"), MCP returned off-topic junk —
  // return nothing so the agent asks a follow-up rather than showing wrong
  // products (e.g. "electrical equipment" matched self-help books). Only fall
  // back to the unfiltered list when the query was purely generic.
  // Book flow: `products` here is already the isBookish allowlist, ranked by MCP
  // relevance to a context-enriched query (e.g. "children adventure book"). If
  // no title textually carries the genre word, fall back to that book set
  // (caller slices the top few) rather than returning empty — empty cards make
  // the agent invent titles. Non-books were already removed, so the worst case
  // is a loosely-relevant book, never a cake or a game.
  if (categoryHint === "book") return products;
  // Non-book known category: `products` is already the per-category allowlist,
  // ranked by MCP relevance. If no title textually carries the query genre word,
  // fall back to that in-category set (caller slices the top few) rather than
  // empty — every survivor is already on-topic for the category.
  if (categoryHint && CATEGORY_SIGNALS[categoryHint]) return products;

  const hasSpecific = qStems.some((q) => !GENERIC_FILTER_STEMS.has(q));
  return hasSpecific ? [] : products;
}

// Drop junk, then drop anything over the stated budget (if any), then (if a
// query is supplied) drop off-topic results via the relevance gate.
export function filterProducts<T extends FilterableProduct>(
  products: T[],
  budget: number | null,
  queryTokens?: string[],
  categoryHint?: string | null,
  excludeSympathy?: boolean,
  dropFloral?: boolean
): T[] {
  let out = products.filter((p) => !isJunkProduct(p));
  // Occasion-based negative filter: drop funeral/sympathy/get-well items in a
  // celebratory flow (caller decides). Runs before category/budget/relevance.
  if (excludeSympathy) out = out.filter((p) => !isSympathy(p));
  // Gender gate: drop floral bouquets in a male-recipient flow that did not
  // ask for flowers (a brother's birthday should not return pink bouquets).
  if (dropFloral) out = out.filter((p) => !isFloral(p));
  // In a book flow, keep ONLY products that carry a book signal (allowlist) and
  // additionally drop anything that trips the non-book blocklist. This removes
  // cakes, games, pillows, and tour packages that merely shared a genre word
  // like "adventure" with the query.
  if (categoryHint === "book") {
    out = out.filter((p) => isBookish(p) && !isNonBook(p.name));
  } else if (categoryHint && CATEGORY_SIGNALS[categoryHint]) {
    // Non-book category: allowlist to products that carry the category's item
    // word — prevents cross-category bleed (no cake in a flowers search, no
    // phone in a cake search).
    out = out.filter((p) => categoryMatch(p, categoryHint));
  }
  // Budget is a SOFT signal, NOT a hard cut. Previously over-budget items were
  // dropped here — on a small MCP result set whose relevance ranking surfaced
  // pricier items first, that discarded the cheaper in-budget products before
  // they ever reached the pool (the "nothing under Rs. 6,000" bug, when several
  // bouquets under 6,000 actually existed). Instead, keep every on-topic result
  // but order within-budget items first (relevance order preserved within each
  // group). The caller selects within-budget items for the visible cards and the
  // agent recommends within budget naturally.
  if (budget != null) {
    const within: T[] = [];
    const over: T[] = [];
    for (const p of out) (p.price <= budget ? within : over).push(p);
    out = [...within, ...over];
  }
  if (queryTokens?.length) out = relevanceGate(out, queryTokens, categoryHint);
  return out;
}
