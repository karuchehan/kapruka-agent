"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { CartItem } from "@/lib/types";

interface Props {
  isOpen: boolean;
  cart: CartItem[];
  cartTotal: number;
  pendingCheckoutUrl: string | null;
  onClose: () => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
}

export function CartPanel({ isOpen, cart, cartTotal, pendingCheckoutUrl, onClose, onRemove, onCheckout }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    if (!panel || !overlay) return;

    if (isOpen) {
      overlay.style.pointerEvents = "all";
      gsap.to(overlay, { opacity: 1, duration: 0.25 });
      gsap.fromTo(panel, { x: "100%" }, { x: "0%", duration: 0.35, ease: "power3.out" });
    } else {
      gsap.to(overlay, { opacity: 0, duration: 0.25, onComplete: () => { overlay.style.pointerEvents = "none"; } });
      gsap.to(panel, { x: "100%", duration: 0.3, ease: "power3.in" });
    }
  }, { dependencies: [isOpen] });

  return (
    <>
      <div
        ref={overlayRef}
        id="cart-overlay"
        style={{ opacity: 0, pointerEvents: "none" }}
        onClick={onClose}
      />
      <aside ref={panelRef} id="cart-panel" aria-label="Shopping cart" style={{ transform: "translateX(100%)" }}>
        <div id="cart-panel-header">
          <h2>Your Cart</h2>
          <button id="cart-close" aria-label="Close cart" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {cart.length === 0 ? (
          <div id="cart-empty-state">
            <p>Your cart is empty</p>
            <p className="subtle">Add products during the conversation</p>
          </div>
        ) : (
          <div id="cart-items-list">
            {cart.map((item) => (
              <div key={item.product.id} className="cart-item">
                {item.product.image_url ? (
                  <img
                    className="cart-item-img"
                    src={item.product.image_url}
                    alt={item.product.name}
                  />
                ) : (
                  <div className="cart-item-img-placeholder">🛍️</div>
                )}
                <div className="cart-item-info">
                  <div className="cart-item-name">
                    {item.product.name}{item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </div>
                  <div className="cart-item-price">
                    {item.product.price
                      ? `Rs. ${(item.product.price * item.quantity).toLocaleString()}`
                      : ""}
                  </div>
                </div>
                <button
                  className="cart-item-remove"
                  aria-label={`Remove ${item.product.name}`}
                  onClick={() => onRemove(item.product.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div id="cart-footer">
          <div id="cart-total-row">
            <span>Total</span>
            <span id="cart-total-amount">Rs. {cartTotal.toLocaleString()}</span>
          </div>
          <button
            id="checkout-btn"
            disabled={cart.length === 0 && !pendingCheckoutUrl}
            onClick={onCheckout}
          >
            Proceed to Checkout
          </button>
        </div>
      </aside>
    </>
  );
}
