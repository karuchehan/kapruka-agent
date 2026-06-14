"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { BundleInfo, Product } from "@/lib/types";

interface Props {
  bundle: BundleInfo;
  onAddToCart: (product: Product) => void;
}

export function BundleHamperView({ bundle, onAddToCart }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = rowRef.current;
    if (!el) return;
    gsap.fromTo(
      el.children,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, stagger: 0.06, duration: 0.3, ease: "power2.out" }
    );
  }, []);

  function handleAddAll() {
    bundle.items.forEach((p) => onAddToCart(p));
  }

  return (
    <div className="bundle-hamper">
      <div className="bundle-title">{bundle.title}</div>
      <div className="bundle-row" ref={rowRef}>
        {bundle.items.map((p, i) => (
          <div className="bundle-mini-card" key={`${p.id || p.name}-${i}`}>
            {p.image_url ? (
              <img className="bundle-mini-img" src={p.image_url} alt={p.name} loading="lazy" />
            ) : (
              <div className="bundle-mini-img-placeholder">🎁</div>
            )}
            <div className="bundle-mini-name">{p.name}</div>
            <div className="bundle-mini-price">
              {p.price ? `Rs. ${Number(p.price).toLocaleString()}` : ""}
            </div>
          </div>
        ))}
        <div className="bundle-total">
          <span className="bundle-total-label">Bundle total</span>
          <span className="bundle-total-amount">Rs. {Number(bundle.total).toLocaleString()}</span>
          <button className="bundle-add-all" onClick={handleAddAll}>
            Add bundle
          </button>
        </div>
      </div>
    </div>
  );
}
