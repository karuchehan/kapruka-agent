"use client";
import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ProductCard } from "./ProductCard";
import type { Product } from "@/lib/types";

interface Props {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

export function ProductCarousel({ products, onAddToCart }: Props) {
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardsRef.current;
    if (!el) return;
    el.scrollLeft = 0; // guarantee first card is fully visible on every mount
    const children = Array.from(el.children) as HTMLElement[];
    gsap.killTweensOf(children);
    gsap.fromTo(
      children,
      { opacity: 0 },
      { opacity: 1, stagger: 0.07, duration: 0.4, ease: "power2.out" }
    );
    return () => { gsap.killTweensOf(children); };
  }, []);

  return (
    <div ref={cardsRef} className="products-carousel">
      {products.map((p, i) => (
        <ProductCard key={`${p.id || p.name}-${i}`} product={p} onAddToCart={onAddToCart} />
      ))}
    </div>
  );
}
