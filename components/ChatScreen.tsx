"use client";
import { useEffect, useMemo, useRef } from "react";
import { Header } from "./Header";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { ProductStage } from "./ProductStage";
import { ProductSheet } from "./ProductSheet";
import { CartDock } from "./CartDock";
import { useChat } from "@/hooks/useChat";
import { useCart } from "@/hooks/useCart";
import { useVoiceOutput } from "@/hooks/useVoiceOutput";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { UserProfile, RecipientProfile, ApiMessage, Product } from "@/lib/types";

interface Props {
  userProfile: UserProfile;
  recipientProfile: RecipientProfile;
  obMessages: ApiMessage[];
  initialQuery?: string;
}

export function ChatScreen({ userProfile, recipientProfile, obMessages, initialQuery }: Props) {
  const { cart, cartCount, cartTotal, pendingCheckoutUrl, setPendingCheckoutUrl, addToCart, addToCartUnique, removeFromCart } = useCart();
  // Marker-driven adds from the chat flow sync via addToCartUnique (idempotent),
  // so conversational "add the cake" reaches the dock + checkout — not just the
  // stage button. Unique guard also prevents a button click that ALSO triggers an
  // [ADD_TO_CART] round-trip from double-counting.
  const { chatItems, apiMessages, isSending, sendMessage, initWithOnboarding } = useChat(addToCartUnique);
  const { voiceEnabled, speak, toggleVoice, speakingId } = useVoiceOutput();
  const isMobile = useMediaQuery("(max-width: 720px)");
  const initialSent = useRef(false);
  const openedCheckout = useRef<Set<string>>(new Set());

  // Snapshot of the products in the cart, passed to sendMessage so the API turn
  // that confirms the order can build the checkout card from real cart items.
  const cartProducts = useMemo(() => cart.map((i) => i.product), [cart]);

  // Keys of products in the cart (id || name — same key the cart dedupes on).
  // Drives each stage card's permanent "Added ✓" state from real cart membership
  // rather than a local timeout, so it never reverts.
  const cartIds = useMemo(
    () => new Set(cart.map((i) => i.product.id || i.product.name)),
    [cart]
  );

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

  // Order confirmed → auto-open the checkout in a new tab, exactly once per
  // checkout item. The ref-Set guard survives StrictMode double-render and any
  // re-render that re-runs this effect with the same item present.
  useEffect(() => {
    const last = chatItems[chatItems.length - 1];
    if (last?.type !== "checkout" || !last.checkoutUrl) return;
    if (openedCheckout.current.has(last.id)) return;
    openedCheckout.current.add(last.id);
    // Open checkout in a BACKGROUND tab — user stays in the agent view.
    // noreferrer (with noopener) discourages focus-stealing; the 100ms defer lets
    // the checkout card paint first so the new tab opens behind it, not in front.
    const url = last.checkoutUrl;
    const t = setTimeout(() => window.open(url, "_blank", "noopener,noreferrer"), 100);
    return () => clearTimeout(t);
  }, [chatItems]);

  // Products live on the right stage, not in the chat column. The stage shows the
  // CURRENT batch only — each new products-turn REPLACES the previous display, so
  // stale picks don't pile up. Walk back to the most recent products-turn and show
  // just that one, deduped by id within the batch.
  const stageProducts = useMemo(() => {
    for (let i = chatItems.length - 1; i >= 0; i--) {
      const it = chatItems[i];
      // Both plain product carousels AND bundle turns feed the stage. A bundle
      // moves its products off into bundle.items server-side (products is emptied
      // when [BUNDLE: true] fires), so if we only read "products" turns the
      // bundle picks the agent just named verbally would never appear on the
      // stage that turn. Read bundle.items too so verbal + visual stay in sync.
      const batch =
        it.type === "products" ? it.products :
        it.type === "bundle"   ? it.bundle?.items :
        null;
      if (!batch?.length) continue;
      const seen = new Set<string>();
      const out: Product[] = [];
      for (const p of batch) {
        const key = p.id || p.name;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
      }
      return out;
    }
    return [];
  }, [chatItems]);

  // Reflect "the mobile peek handle is showing" to a root class so the cart dock
  // and message padding can clear it only when it actually exists.
  useEffect(() => {
    const root = document.documentElement;
    const show = isMobile && stageProducts.length > 0;
    root.classList.toggle("has-products", show);
    return () => root.classList.remove("has-products");
  }, [isMobile, stageProducts.length]);

  function handleSend(text: string) {
    sendMessage(text, userProfile, recipientProfile, cartProducts);
  }

  function handleAddToCart(product: Product) {
    addToCart(product);
    if (!isSending) {
      sendMessage(`I'd like to add the ${product.name} to my cart.`, userProfile, recipientProfile, cartProducts);
    }
  }

  function handleGiftSubmit(text: string) {
    sendMessage(`Please add this gift message to my order: "${text}"`, userProfile, recipientProfile, cartProducts);
  }

  function handleCheckout() {
    // Prefer a real Kapruka product page from the cart; fall back to asking the
    // agent to place the order (which will then emit [ORDER_CONFIRMED]).
    const url = cart.find((i) => i.product.url)?.product.url;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      handleSend("I'm ready to checkout. Please place the order.");
    }
  }

  return (
    <div id="chat-screen">
      <div className="chat-panel">
        <Header voiceEnabled={voiceEnabled} onVoiceToggle={toggleVoice} />
        <MessageList chatItems={chatItems} speakingId={speakingId} onAddToCart={handleAddToCart} onGiftSubmit={handleGiftSubmit} />
        <InputArea onSend={handleSend} isSending={isSending} />
      </div>

      {isMobile ? (
        // Mobile: the sheet (and its peek handle) only exist once products have
        // arrived — until then it's chat full-screen with just the input bar.
        stageProducts.length > 0 ? (
          <ProductSheet products={stageProducts} isLoading={isSending} onAddToCart={handleAddToCart} addedIds={cartIds} />
        ) : null
      ) : (
        <ProductStage products={stageProducts} isLoading={isSending} onAddToCart={handleAddToCart} addedIds={cartIds} />
      )}

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
