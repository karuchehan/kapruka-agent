"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Product } from "@/lib/types";

interface Props {
  products: Product[];
  checkoutUrl?: string;
}

/**
 * Confirmation card shown when an order is confirmed. ChatScreen auto-opens the
 * primary checkout URL in a new tab; this card is the visible confirmation +
 * manual fallback (popup blockers) — each cart item links to its Kapruka page.
 */
export function CheckoutCard({ products, checkoutUrl }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (ref.current) {
      gsap.fromTo(ref.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
    }
  }, []);

  const items = products.filter((p) => p.url);

  return (
    <div ref={ref} className="checkout-card" role="status">
      <div className="checkout-card-head">
        <span className="checkout-card-spark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span className="checkout-card-title">Opening your checkout…</span>
      </div>
      <p className="checkout-card-sub">
        If a new tab didn&apos;t open, tap a link below to complete your order on Kapruka.
      </p>
      {items.length > 0 ? (
        <div className="checkout-card-links">
          {items.map((p) => (
            <a
              key={p.id || p.name}
              className="checkout-card-link"
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="checkout-card-link-name">{p.name}</span>
              <span className="checkout-card-link-go" aria-hidden="true">View on Kapruka →</span>
            </a>
          ))}
        </div>
      ) : checkoutUrl ? (
        <a className="checkout-card-link" href={checkoutUrl} target="_blank" rel="noopener noreferrer">
          <span className="checkout-card-link-go">Open checkout →</span>
        </a>
      ) : null}
    </div>
  );
}
