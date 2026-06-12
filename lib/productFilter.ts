// Product relevancy filtering — runs in app/api/chat/route.ts BEFORE products
// are shipped to the frontend. The cards rendered in the UI come from this
// filtered array, not from Claude. Keep this pure + deterministic so it can be
// tested against live MCP data without an Anthropic call.

interface FilterableProduct {
  name: string;
  price: number;
  image_url: string;
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

// Drop junk, then drop anything over the stated budget (if any).
export function filterProducts<T extends FilterableProduct>(
  products: T[],
  budget: number | null
): T[] {
  let out = products.filter((p) => !isJunkProduct(p));
  if (budget != null) out = out.filter((p) => p.price <= budget);
  return out;
}
