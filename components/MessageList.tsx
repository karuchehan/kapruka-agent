"use client";
import { useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { SkeletonCards } from "./SkeletonCards";
import { ProductCarousel } from "./ProductCarousel";
import { DeliveryStatusCard } from "./DeliveryStatusCard";
import { OccasionCountdown } from "./OccasionCountdown";
import type { ChatItem, Product } from "@/lib/types";

interface Props {
  chatItems: ChatItem[];
  onAddToCart: (product: Product) => void;
}

export function MessageList({ chatItems, onAddToCart }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on every chatItems update — direct scrollTop avoids
  // scrollIntoView() disturbing the horizontal scroll of product carousels
  useEffect(() => {
    const t = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
      }
    }, 100);
    return () => clearTimeout(t);
  }, [chatItems]);

  return (
    <main
      ref={containerRef}
      id="messages-container"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {chatItems.map((item) => {
        switch (item.type) {
          case "user":
            return <MessageBubble key={item.id} role="user" text={item.text!} />;
          case "agent":
            return <MessageBubble key={item.id} role="agent" text={item.text!} />;
          case "typing":
            return <TypingIndicator key={item.id} />;
          case "skeleton":
            return <SkeletonCards key={item.id} />;
          case "products":
            return (
              <ProductCarousel
                key={item.id}
                products={item.products!}
                onAddToCart={onAddToCart}
              />
            );
          case "delivery":
            return <DeliveryStatusCard key={item.id} delivery={item.delivery!} />;
          case "occasion":
            return <OccasionCountdown key={item.id} occasion={item.occasion!} />;
          default:
            return null;
        }
      })}
      <div ref={anchorRef} id="scroll-anchor" />
    </main>
  );
}
