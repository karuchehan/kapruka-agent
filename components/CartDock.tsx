"use client";
import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { CartItem } from "@/lib/types";

interface Props {
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  pendingCheckoutUrl: string | null;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
}

/**
 * Floating pill dock, fixed bottom-center. Collapsed it shows item count +
 * running total. Hover (or keyboard focus) expands the panel above it with the
 * line items and a checkout button. GSAP drives the expand/collapse.
 */
export function CartDock({ cart, cartCount, cartTotal, pendingCheckoutUrl, onRemove, onCheckout }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRun = useRef(true);

  useGSAP(() => {
    const p = panelRef.current;
    if (!p) return;
    // On mount: force collapsed with no animation. Never auto-open on load.
    if (firstRun.current) {
      firstRun.current = false;
      gsap.set(p, { height: 0, opacity: 0, y: 10 });
      return;
    }
    if (open) {
      gsap.to(p, { height: "auto", opacity: 1, y: 0, duration: 0.32, ease: "power3.out" });
    } else {
      gsap.to(p, { height: 0, opacity: 0, y: 10, duration: 0.24, ease: "power2.in" });
    }
  }, { dependencies: [open] });

  const canCheckout = cart.length > 0 || !!pendingCheckoutUrl;

  return (
    <div
      className="cart-dock"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div ref={panelRef} className="cart-dock-panel" style={{ height: 0, opacity: 0 }}>
        <div className="cart-dock-panel-inner">
          <div className="cart-dock-title">Your Cart</div>
          {cart.length === 0 ? (
            <p className="cart-dock-empty">No items yet — add products from the stage.</p>
          ) : (
            <div className="cart-dock-items">
              {cart.map((item) => (
                <div key={item.product.id} className="cart-dock-item">
                  {item.product.image_url ? (
                    <img className="cart-dock-item-img" src={item.product.image_url} alt={item.product.name} />
                  ) : (
                    <div className="cart-dock-item-img placeholder">🛍️</div>
                  )}
                  <div className="cart-dock-item-info">
                    <div className="cart-dock-item-name">
                      {item.product.name}{item.quantity > 1 ? ` × ${item.quantity}` : ""}
                    </div>
                    <div className="cart-dock-item-price">
                      {item.product.price ? `Rs. ${(item.product.price * item.quantity).toLocaleString()}` : ""}
                    </div>
                  </div>
                  <button
                    className="cart-dock-item-remove"
                    aria-label={`Remove ${item.product.name}`}
                    onClick={() => onRemove(item.product.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className="cart-dock-checkout" disabled={!canCheckout} onClick={onCheckout}>
            {pendingCheckoutUrl ? "Open Checkout" : "Proceed to Checkout"}
          </button>
        </div>
      </div>

      <button className="cart-dock-pill" aria-label="Cart" onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        <span className="cart-dock-count">{cartCount} {cartCount === 1 ? "item" : "items"}</span>
        <span className="cart-dock-divider" aria-hidden="true" />
        <span className="cart-dock-total">Rs. {cartTotal.toLocaleString()}</span>
      </button>
    </div>
  );
}
