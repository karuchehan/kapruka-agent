"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Product, CheckoutResult } from "@/lib/types";

interface Props {
  products: Product[];
  checkoutUrl?: string;
  checkout?: CheckoutResult;
}

// Format an LKR amount as "Rs. 4,500".
function money(n: number, currency = "LKR"): string {
  const sym = currency === "LKR" ? "Rs." : currency + " ";
  return `${sym}${Math.round(n).toLocaleString("en-US")}`;
}

// Whole minutes remaining until the pay-link expires (create_order locks the price
// for ~60 min). Never negative; returns null when we can't parse the timestamp.
function minutesLeft(expiresAt?: string): number | null {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.round((t - Date.now()) / 60000));
}

/**
 * Order confirmation card shown after the server places a real guest checkout via
 * kapruka_create_order. ChatScreen auto-opens the pay-link in a new tab; this card
 * is the visible confirmation + manual fallback (popup blockers) and shows the
 * locked price breakdown (items + delivery) and the link expiry.
 */
export function CheckoutCard({ products, checkoutUrl, checkout }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (ref.current) {
      gsap.fromTo(ref.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
    }
  }, []);

  const url = checkout?.checkoutUrl || checkoutUrl || "";
  const currency = checkout?.currency || "LKR";
  const mins = minutesLeft(checkout?.expiresAt);
  const itemNames = products.filter((p) => p.name).map((p) => p.name);

  return (
    <div ref={ref} className="checkout-card" role="status">
      <div className="checkout-card-head">
        <span className="checkout-card-spark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span className="checkout-card-title">Your order is ready to pay</span>
      </div>

      {checkout ? (
        <div className="checkout-card-summary">
          {itemNames.length > 0 && (
            <div className="checkout-card-items">
              {itemNames.map((n, i) => (
                <span key={i} className="checkout-card-item-name">{n}</span>
              ))}
            </div>
          )}
          <div className="checkout-card-line">
            <span>Items</span><span>{money(checkout.itemsTotal, currency)}</span>
          </div>
          <div className="checkout-card-line">
            <span>Delivery</span><span>{money(checkout.deliveryFee, currency)}</span>
          </div>
          {checkout.addonsTotal > 0 && (
            <div className="checkout-card-line">
              <span>Add-ons</span><span>{money(checkout.addonsTotal, currency)}</span>
            </div>
          )}
          <div className="checkout-card-line checkout-card-total">
            <span>Total</span><span>{money(checkout.grandTotal, currency)}</span>
          </div>
        </div>
      ) : (
        <p className="checkout-card-sub">
          If a new tab didn&apos;t open, tap below to complete your order on Kapruka.
        </p>
      )}

      {url && (
        <a className="checkout-card-cta" href={url} target="_blank" rel="noopener noreferrer">
          Complete payment on Kapruka →
        </a>
      )}

      {mins !== null && (
        <p className="checkout-card-expiry">
          {mins > 0
            ? `Price locked — this link expires in about ${mins} min.`
            : "This checkout link has expired — ask me to place the order again."}
        </p>
      )}
    </div>
  );
}
