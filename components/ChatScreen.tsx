"use client";
import { useEffect, useMemo, useRef } from "react";
import { Header } from "./Header";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { ProductStage } from "./ProductStage";
import { CartDock } from "./CartDock";
import { useChat } from "@/hooks/useChat";
import { useCart } from "@/hooks/useCart";
import { useVoiceOutput } from "@/hooks/useVoiceOutput";
import type { UserProfile, RecipientProfile, ApiMessage, Product } from "@/lib/types";

interface Props {
  userProfile: UserProfile;
  recipientProfile: RecipientProfile;
  obMessages: ApiMessage[];
  initialQuery?: string;
}

export function ChatScreen({ userProfile, recipientProfile, obMessages, initialQuery }: Props) {
  const { chatItems, apiMessages, isSending, sendMessage, initWithOnboarding } = useChat();
  const { cart, cartCount, cartTotal, pendingCheckoutUrl, setPendingCheckoutUrl, addToCart, removeFromCart } = useCart();
  const { voiceEnabled, speak, toggleVoice, speakingId } = useVoiceOutput();
  const initialSent = useRef(false);

  useEffect(() => {
    initWithOnboarding(obMessages);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-send the onboarding shopping intent once history is seeded, so the agent
  // actually responds (vs. sitting idle). Waits for apiMessages to populate to avoid
  // a race where sendMessage's closure would miss the onboarding context.
  useEffect(() => {
    if (initialSent.current || !initialQuery) return;
    if (apiMessages.length === 0) return;
    initialSent.current = true;
    sendMessage(initialQuery, userProfile, recipientProfile);
  }, [apiMessages, initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Speak agent messages when they arrive
  useEffect(() => {
    const last = chatItems[chatItems.length - 1];
    if (last?.type === "agent" && last.text) speak(last.text, last.id);
    if (last?.type === "products" && last.checkoutUrl) setPendingCheckoutUrl(last.checkoutUrl);
  }, [chatItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Products live on the right stage, not in the chat column. Flatten every
  // products-turn into one accumulating grid, deduped by id (upstream already
  // dedupes, this is belt-and-suspenders) so the stage grows as picks arrive.
  const stageProducts = useMemo(() => {
    const seen = new Set<string>();
    const out: Product[] = [];
    for (const it of chatItems) {
      if (it.type !== "products" || !it.products) continue;
      for (const p of it.products) {
        const key = p.id || p.name;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
      }
    }
    return out;
  }, [chatItems]);

  function handleSend(text: string) {
    sendMessage(text, userProfile, recipientProfile);
  }

  function handleAddToCart(product: Product) {
    addToCart(product);
    if (!isSending) {
      sendMessage(`I'd like to add the ${product.name} to my cart.`, userProfile, recipientProfile);
    }
  }

  function handleGiftSubmit(text: string) {
    sendMessage(`Please add this gift message to my order: "${text}"`, userProfile, recipientProfile);
  }

  function handleCheckout() {
    if (pendingCheckoutUrl) {
      window.open(pendingCheckoutUrl, "_blank", "noopener");
    } else {
      handleSend("I'm ready to checkout. Please create the order.");
    }
  }

  return (
    <div id="chat-screen">
      <div className="chat-panel">
        <Header voiceEnabled={voiceEnabled} onVoiceToggle={toggleVoice} />
        <MessageList chatItems={chatItems} speakingId={speakingId} onAddToCart={handleAddToCart} onGiftSubmit={handleGiftSubmit} />
        <InputArea onSend={handleSend} isSending={isSending} />
      </div>

      <ProductStage products={stageProducts} isLoading={isSending} onAddToCart={handleAddToCart} />

      <CartDock
        cart={cart}
        cartCount={cartCount}
        cartTotal={cartTotal}
        pendingCheckoutUrl={pendingCheckoutUrl}
        onRemove={removeFromCart}
        onCheckout={handleCheckout}
      />
    </div>
  );
}
