"use client";
import { useEffect } from "react";
import { Header } from "./Header";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { CartPanel } from "./CartPanel";
import { useChat } from "@/hooks/useChat";
import { useCart } from "@/hooks/useCart";
import { useVoiceOutput } from "@/hooks/useVoiceOutput";
import type { UserProfile, RecipientProfile, ApiMessage } from "@/lib/types";

interface Props {
  userProfile: UserProfile;
  recipientProfile: RecipientProfile;
  obMessages: ApiMessage[];
}

export function ChatScreen({ userProfile, recipientProfile, obMessages }: Props) {
  const { chatItems, isSending, sendMessage, initWithOnboarding } = useChat();
  const { cart, cartCount, cartTotal, isCartOpen, pendingCheckoutUrl, setPendingCheckoutUrl, addToCart, removeFromCart, openCart, closeCart } = useCart();
  const { voiceEnabled, speak, toggleVoice } = useVoiceOutput();

  useEffect(() => {
    initWithOnboarding(obMessages);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Speak agent messages when they arrive
  useEffect(() => {
    const last = chatItems[chatItems.length - 1];
    if (last?.type === "agent" && last.text) speak(last.text);
    if (last?.type === "products" && last.checkoutUrl) setPendingCheckoutUrl(last.checkoutUrl);
  }, [chatItems]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSend(text: string) {
    sendMessage(text, userProfile, recipientProfile);
  }

  function handleAddToCart(product: import("@/lib/types").Product) {
    addToCart(product);
    if (!isSending) {
      sendMessage(`I'd like to add the ${product.name} to my cart.`, userProfile, recipientProfile);
    }
  }

  function handleCheckout() {
    if (pendingCheckoutUrl) {
      window.open(pendingCheckoutUrl, "_blank", "noopener");
    } else {
      handleSend("I'm ready to checkout. Please create the order.");
      closeCart();
    }
  }

  return (
    <div id="chat-screen">
      <Header
        voiceEnabled={voiceEnabled}
        onVoiceToggle={toggleVoice}
        cartCount={cartCount}
        onCartOpen={openCart}
      />
      <MessageList chatItems={chatItems} onAddToCart={handleAddToCart} />
      <InputArea onSend={handleSend} isSending={isSending} />
      <CartPanel
        isOpen={isCartOpen}
        cart={cart}
        cartTotal={cartTotal}
        pendingCheckoutUrl={pendingCheckoutUrl}
        onClose={closeCart}
        onRemove={removeFromCart}
        onCheckout={handleCheckout}
      />
    </div>
  );
}
