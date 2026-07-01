"use client";
import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Product } from "@/lib/types";

interface Props {
  products: Product[];
  isLoading: boolean;
  onAddToCart: (product: Product) => void;
  // Keys (id || name) of products currently in the cart — drives the permanent
  // "Added ✓" state so it survives re-renders instead of a local timeout.
  addedIds: Set<string>;
}

// Empty-state headline whose glow travels letter-by-letter, left to right,
// across the WHOLE phrase (both words). Each letter is its own span with an
// animation-delay proportional to its position in the full sequence, so the
// highlight sweeps A→l→l→…→t continuously. "All the Joys." is white, "One Cart"
// is accent gold — the glow tints to each letter's own colour (currentColor).
function EmptyStateGlow() {
  const words: { text: string; cls: string }[] = [
    { text: "All the Joys.", cls: "joys" },
    { text: "One Cart", cls: "cart" },
  ];
  // Total letters across both words drives the per-letter delay + full cycle
  // length, so the sweep is one continuous pass end-to-end (not per-word).
  const total = words.reduce((n, w) => n + w.text.length, 0);
  const STEP = 0.12;                 // seconds between consecutive letters
  const CYCLE = total * STEP + 2.2;  // full loop: sweep + a rest before repeating
  let idx = 0;

  return (
    <p className="stage-empty-title glow-sweep" style={{ ["--cycle" as string]: `${CYCLE}s` }}>
      {words.map((w, wi) => (
        <span key={wi} className={w.cls}>
          {Array.from(w.text).map((ch, ci) => {
            const delay = idx * STEP;
            idx++;
            // Preserve spaces as a non-animated inline gap.
            if (ch === " ") return <span key={ci}>&nbsp;</span>;
            return (
              <span key={ci} className="glow-letter" style={{ animationDelay: `${delay}s` }}>
                {ch}
              </span>
            );
          })}
          {/* keep the inter-word space */}
          {wi < words.length - 1 ? <span>&nbsp;</span> : null}
        </span>
      ))}
    </p>
  );
}

/**
 * Right 65% "stage". Shows an atmospheric empty state until the first search
 * lands, then a large grid of tiles with big imagery and frosted-glass price
 * tags. New tiles animate in (GSAP); the stage replaces its contents each batch
 * so stale cards never linger.
 */
export function ProductStage({ products, isLoading, onAddToCart, addedIds }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);

  // The stage REPLACES its contents each batch (not append), so re-animate every
  // real card whenever the batch changes. Keyed on the product-id signature so a
  // new search result staggers in cleanly and stale cards never linger.
  const sig = products.map((p) => p.id || p.name).join("|");
  useGSAP(() => {
    const el = gridRef.current;
    if (!el) return;
    const cards = Array.from(
      el.querySelectorAll(".stage-card:not(.stage-card-skeleton)")
    ) as HTMLElement[];
    if (cards.length) {
      gsap.fromTo(
        cards,
        { opacity: 0, y: 28, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" }
      );
    }
  }, { dependencies: [sig] });

  const hasProducts = products.length > 0;

  return (
    <section className="product-stage" aria-label="Product results">
      {!hasProducts && !isLoading && (
        // Minimalist empty state: the Kapruka line on ONE row — "All the Joys."
        // in white, "One Cart" in accent gold. A glow sweeps letter-by-letter
        // from left to right across the whole phrase (see EmptyStateGlow).
        <div className="stage-empty" aria-hidden="true">
          <EmptyStateGlow />
        </div>
      )}

      {(hasProducts || isLoading) && (
        <div className="product-grid" ref={gridRef}>
          {products.map((p) => (
            <StageCard
              key={p.id || p.name}
              product={p}
              onAddToCart={onAddToCart}
              added={addedIds.has(p.id || p.name)}
            />
          ))}
          {isLoading &&
            Array.from({ length: hasProducts ? 2 : 6 }).map((_, i) => (
              <div key={`sk-${i}`} className="stage-card stage-card-skeleton">
                <div className="skeleton stage-card-img" />
                <div className="stage-card-body">
                  <div className="skeleton stage-skel-line" />
                  <div className="skeleton stage-skel-line short" />
                </div>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

function StageCard({ product, onAddToCart, added }: { product: Product; onAddToCart: (p: Product) => void; added: boolean }) {
  const [imgError, setImgError] = useState(false);

  function handleAdd() {
    if (added) return;
    onAddToCart(product);
  }

  return (
    <div className="stage-card">
      <div className="stage-card-media">
        {product.image_url && !imgError ? (
          <img
            className="stage-card-img"
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="stage-card-img stage-card-img-placeholder">🛍️</div>
        )}
        {product.price ? (
          <span className="stage-price-tag">Rs. {Number(product.price).toLocaleString()}</span>
        ) : null}
      </div>
      <div className="stage-card-body">
        <div className="stage-card-name">{product.name || "Product"}</div>
        <button className={`stage-card-add${added ? " added" : ""}`} onClick={handleAdd}>
          {added ? "Added ✓" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}
