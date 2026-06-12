"use client";
import { useRef, useState } from "react";
import gsap from "gsap";
import type { Product } from "@/lib/types";

interface Props {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [added, setAdded] = useState(false);
  const [imgError, setImgError] = useState(false);

  function handleMouseEnter() {
    if (cardRef.current) gsap.to(cardRef.current, { y: -4, duration: 0.2, ease: "power2.out" });
  }
  function handleMouseLeave() {
    if (cardRef.current) gsap.to(cardRef.current, { y: 0, duration: 0.2, ease: "power2.out" });
  }

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    onAddToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div
      ref={cardRef}
      className="product-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {product.image_url && !imgError ? (
        <img
          className="product-card-image"
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="product-card-image-placeholder">🛍️</div>
      )}
      <div className="product-card-body">
        <div className="product-card-name">{product.name || "Product"}</div>
        <div className="product-card-price">
          {product.price ? `Rs. ${Number(product.price).toLocaleString()}` : ""}
        </div>
        <button
          className={`product-card-add${added ? " added" : ""}`}
          onClick={handleAdd}
        >
          {added ? "Added ✓" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}
