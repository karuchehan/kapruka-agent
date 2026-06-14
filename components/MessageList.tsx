"use client";
import { useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { DeliveryStatusCard } from "./DeliveryStatusCard";
import { OccasionCountdown } from "./OccasionCountdown";
import { GiftMessageCard } from "./GiftMessageCard";
import { BundleHamperView } from "./BundleHamperView";
import type { ChatItem, Product } from "@/lib/types";

interface Props {
  chatItems: ChatItem[];
  speakingId?: string | null;
  onAddToCart: (product: Product) => void;
  onGiftSubmit: (text: string) => void;
}

export function MessageList({ chatItems, speakingId, onAddToCart, onGiftSubmit }: Props) {
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
            return <MessageBubble key={item.id} role="agent" text={item.text!} isSpeaking={item.id === speakingId} />;
          case "typing":
            return <TypingIndicator key={item.id} />;
          // "skeleton" + "products" render on the right-hand ProductStage now,
          // not in the chat column — skip them here.
          case "skeleton":
          case "products":
            return null;
          case "delivery":
            return <DeliveryStatusCard key={item.id} delivery={item.delivery!} />;
          case "occasion":
            return <OccasionCountdown key={item.id} occasion={item.occasion!} />;
          case "giftMessage":
            return (
              <GiftMessageCard key={item.id} giftMessage={item.giftMessage!} onSubmit={onGiftSubmit} />
            );
          case "bundle":
            return (
              <BundleHamperView key={item.id} bundle={item.bundle!} onAddToCart={onAddToCart} />
            );
          default:
            return null;
        }
      })}
      <div ref={anchorRef} id="scroll-anchor" />
    </main>
  );
}
