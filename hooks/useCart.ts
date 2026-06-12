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
    removeFromCart,
    openCart: () => setIsCartOpen(true),
    closeCart: () => setIsCartOpen(false),
  };
}
