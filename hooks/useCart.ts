"use client";
import { useState } from "react";
import type { CartItem, Product } from "@/lib/types";

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  // Add only if not already present (by id). Used for marker-driven syncs from
  // the chat flow, which can re-resolve the same item — and to avoid double-adds
  // when a stage-button click ALSO produces an [ADD_TO_CART] marker round-trip.
  function addToCartUnique(product: Product) {
    setCart((prev) => {
      const key = product.id || product.name;
      if (prev.some((i) => (i.product.id || i.product.name) === key)) return prev;
      return [...prev, { product, quantity: 1 }];
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + (i.product.price || 0) * i.quantity, 0);

  return {
    cart,
    cartCount,
    cartTotal,
    isCartOpen,
    pendingCheckoutUrl,
    setPendingCheckoutUrl,
    addToCart,
    addToCartUnique,
    removeFromCart,
    openCart: () => setIsCartOpen(true),
    closeCart: () => setIsCartOpen(false),
  };
}
