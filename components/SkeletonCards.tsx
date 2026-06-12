"use client";

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="products-carousel">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton skeleton-img" />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text short" />
        </div>
      ))}
    </div>
  );
}
