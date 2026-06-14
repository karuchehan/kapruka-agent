"use client";
import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Product } from "@/lib/types";

interface Props {
  products: Product[];
  isLoading: boolean;
  onAddToCart: (product: Product) => void;
}

/**
 * Right 65% "stage". Empty until products arrive, then a large grid of tiles
 * with big imagery and frosted-glass price tags. New tiles animate in (GSAP);
 * already-mounted tiles are left untouched so the grid doesn't re-stagger on
 * every turn.
 */
export function ProductStage({ products, isLoading, onAddToCart }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  useGSAP(() => {
    const el = gridRef.current;
    if (!el) return;
    const cards = Array.from(el.querySelectorAll(".stage-card")) as HTMLElement[];
    const fresh = cards.slice(prevCount.current);
    if (fresh.length) {
      gsap.fromTo(
        fresh,
        { opacity: 0, y: 28, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" }
      );
    }
    prevCount.current = cards.length;
  }, { dependencies: [products.length] });

  const hasProducts = products.length > 0;

  return (
    <section className="product-stage" aria-label="Product results">
      {!hasProducts && !isLoading && (
        <div className="stage-empty">
          <div className="stage-empty-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <p className="stage-empty-title">Your picks will appear here</p>
          <p className="stage-empty-sub">Tell Kapruka what you're looking for and products land on this stage.</p>
        </div>
      )}

      {(hasProducts || isLoading) && (
        <div className="product-grid" ref={gridRef}>
          {products.map((p) => (
            <StageCard key={p.id || p.name} product={p} onAddToCart={onAddToCart} />
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

function StageCard({ product, onAddToCart }: { product: Product; onAddToCart: (p: Product) => void }) {
  const [added, setAdded] = useState(false);
  const [imgError, setImgError] = useState(false);

  function handleAdd() {
    onAddToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
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
