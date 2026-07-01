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

// Four real Kapruka products shown on the stage the instant the app loads —
// before any search — so the stage is never empty on first paint. Pulled live
// from the MCP (verified 2026-07-01); ids are real product_ids, so add-to-cart
// and checkout work on them exactly like a search result. The moment the first
// real search batch arrives, `products` is non-empty and these are replaced
// wholesale by the normal render path — no MCP call on mount, no loading state.
const STATIC_FEATURED: Product[] = [
  {
    id: "CAKE00KA001685",
    name: "Springtime Birthday Ribbon Cake",
    price: 5770,
    image_url:
      "https://static2.kapruka.com/product-image/width=330,quality=93,f=auto/shops/cakes/productImages/zoom/1721645817680_untitled1.jpg",
    url: "https://www.kapruka.com/buyonline/springtime-birthday-ribbon-cake/kid/cake00ka001685",
  },
  {
    id: "FLOWERS00T2034",
    name: "5 Red Roses Bouquet",
    price: 6880,
    image_url:
      "https://static2.kapruka.com/product-image/width=330,quality=93,f=auto/shops/flowershop/flowerImages/zooms/1768475653238_dsc03002.jpg",
    url: "https://www.kapruka.com/buyonline/5-red-roses-bouquet-elegant-lu/kid/flowers00t2034",
  },
  {
    id: "CHOCOLATES00767",
    name: "All Nuts Mix - 12 Piece Chocolate Box",
    price: 3600,
    image_url:
      "https://static2.kapruka.com/product-image/width=330,quality=93,f=auto/shops/specialGifts/productImages/1558586400563_dsc_5227_m.jpg",
    url: "https://www.kapruka.com/buyonline/all-nuts-mix-12-piece-java/kid/chocolates00767",
  },
  {
    id: "EF_PC_HAMP0V18POD00018P",
    name: "Healthy & Energy Booster Fitness Hamper",
    price: 8450,
    image_url:
      "https://static2.kapruka.com/product-image/width=330,quality=93,f=auto/https://partnercentral.kapruka.com/kapruka-pc/assets/images/product/pc00006/hamp0v18p00018/hamp0v18p00018_1.jpg",
    url: "https://www.kapruka.com/buyonline/healthy-and-energy-booster-fit/kid/ef_pc_hamp0v18pod00018p",
  },
];

/**
 * Right 65% "stage". Empty until products arrive, then a large grid of tiles
 * with big imagery and frosted-glass price tags. New tiles animate in (GSAP);
 * already-mounted tiles are left untouched so the grid doesn't re-stagger on
 * every turn.
 */
export function ProductStage({ products, isLoading, onAddToCart, addedIds }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);

  const hasReal = products.length > 0;
  // Featured stand-ins fill the stage until the first real search batch lands,
  // then the normal render path takes over verbatim.
  const display = hasReal ? products : STATIC_FEATURED;

  // The stage REPLACES its contents each batch (not append), so re-animate every
  // real card whenever the batch changes. Keyed on the product-id signature so a
  // new search result staggers in cleanly and stale cards never linger.
  const sig = display.map((p) => p.id || p.name).join("|");
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

  return (
    <section className="product-stage" aria-label="Product results">
      <div className="product-grid" ref={gridRef}>
        {display.map((p) => (
          <StageCard
            key={p.id || p.name}
            product={p}
            onAddToCart={onAddToCart}
            added={addedIds.has(p.id || p.name)}
          />
        ))}
        {/* Skeletons pad only a real in-flight search; the featured stand-ins
            never show a loading state — they just sit there until replaced. */}
        {isLoading && hasReal &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={`sk-${i}`} className="stage-card stage-card-skeleton">
              <div className="skeleton stage-card-img" />
              <div className="stage-card-body">
                <div className="skeleton stage-skel-line" />
                <div className="skeleton stage-skel-line short" />
              </div>
            </div>
          ))}
      </div>
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
