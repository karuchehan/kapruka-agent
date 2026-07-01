"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./Header";
import { MessageList } from "./MessageList";
import { VoiceTextInput } from "./VoiceTextInput";
import { MachanAvatar } from "./MachanAvatar";
import { Confetti } from "./Confetti";
import { ProductStage } from "./ProductStage";
import { ProductSheet } from "./ProductSheet";
import { CartDock } from "./CartDock";
import { useChat } from "@/hooks/useChat";
import { useCart } from "@/hooks/useCart";
import { useVoiceOutput } from "@/hooks/useVoiceOutput";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { extractBudget } from "@/lib/productFilter";
import type { UserProfile, RecipientProfile, ApiMessage, Product, ChatState, CheckoutStage, CheckoutData } from "@/lib/types";

// User negations that mean "drop out of the checkout flow" — mirrors the
// negation set in system_prompt.md. When the user says any of these while we are
// collecting an address, checkoutStage resets to "idle" so the agent stops
// asking for the delivery address (the loop bug this fix targets).
const NEGATION_RE = /\b(no|nope|cancel|never\s*mind|nevermind|forget it|don'?t worry|nothing|that'?s fine|leave it|not now|stop)\b/i;

interface Props {
  userProfile: UserProfile;
  recipientProfile: RecipientProfile;
  obMessages: ApiMessage[];
  initialQuery?: string;
}

export function ChatScreen({ userProfile, recipientProfile, obMessages, initialQuery }: Props) {
  const { cart, cartCount, cartTotal, pendingCheckoutUrl, setPendingCheckoutUrl, addToCart, addToCartUnique, removeFromCart, removeFromCartByKey } = useCart();
  // Marker-driven adds from the chat flow sync via addToCartUnique (idempotent),
  // so conversational "add the cake" reaches the dock + checkout — not just the
  // stage button. Unique guard also prevents a button click that ALSO triggers an
  // [ADD_TO_CART] round-trip from double-counting.
  // Marker-driven removes use removeFromCartByKey keyed by id||name — handles
  // MCP products whose id field is empty (would never match a removeFromCart call).
  // ── EXTERNALIZED CHAT STATE ────────────────────────────────────────────────
  // Tracked explicitly here (not inferred from history) and injected into every
  // API call as a [STATE] block. cartItems/cartCount derive from the cart;
  // deliveryCity + checkoutStage are driven by user actions and server responses;
  // budgetStated is parsed from the conversation.
  const [deliveryCity, setDeliveryCity] = useState<string | null>(null);
  const [checkoutStage, setCheckoutStage] = useState<CheckoutStage>("idle");
  // Structured checkout fields, accumulated across turns from the agent's [CO_*]
  // markers and echoed back to the server in [STATE] so it knows what's still
  // missing before it can place the create_order guest checkout.
  const [checkoutData, setCheckoutData] = useState<CheckoutData>({});

  const { chatItems, apiMessages, isSending, sendMessage, sendSystemMessage, initWithOnboarding } = useChat(
    addToCartUnique,
    (product) => removeFromCartByKey(product.id || product.name),
    // Server confirmed a delivery city → record it and mark address as confirmed.
    (city) => { setDeliveryCity(city); setCheckoutStage((s) => (s === "complete" ? s : "address_confirmed")); },
    // Order confirmed → checkout is complete.
    () => setCheckoutStage("complete"),
    // Agent captured checkout fields this turn → merge into accumulated state.
    (fields) => setCheckoutData((prev) => ({ ...prev, ...fields })),
  );
  const { voiceEnabled, speak, toggleVoice, speakingId } = useVoiceOutput();
  const isMobile = useMediaQuery("(max-width: 720px)");
  const initialSent = useRef(false);
  const openedCheckout = useRef<Set<string>>(new Set());
  const prevCartCount = useRef(0);
  // Bumped whenever the cart count rises → Machan flashes his laugh. Driven off
  // cartCount so it fires for BOTH the stage button and conversational adds
  // (same event that updates the count), not just one path.
  const [cartCelebrate, setCartCelebrate] = useState(0);
  const prevCartForCelebrate = useRef(0);

  // Snapshot of the products in the cart, passed to sendMessage so the API turn
  // that confirms the order can build the checkout card from real cart items.
  const cartProducts = useMemo(() => cart.map((i) => i.product), [cart]);

  // Build the [STATE] payload for the OUTGOING message. Computed synchronously
  // (not from a memo) so this turn reflects the message being sent right now:
  // budget includes the current text, and a negation drops checkoutStage to
  // "idle" THIS turn — so the agent stops asking for the address immediately,
  // before the async setState lands. The negation side-effect persists it too.
  function buildChatState(outgoingText: string, forceStage?: CheckoutStage): ChatState {
    let stage: CheckoutStage = forceStage ?? checkoutStage;
    if (!forceStage && stage !== "complete" && NEGATION_RE.test(outgoingText)) {
      stage = "idle";
      setCheckoutStage("idle");
    }
    const budgetStated = extractBudget([
      ...apiMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: outgoingText },
    ]);
    return {
      cartItems: cart.map((i) => ({ name: i.product.name, price: i.product.price })),
      cartCount,
      deliveryCity,
      checkoutStage: stage,
      budgetStated,
      checkoutData,
    };
  }

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

  // Pre-warm the chat function + Kapruka MCP on page load. The greeting renders
  // with no API call, so the user's FIRST message would otherwise pay the full
  // cold-start (Vercel boot + MCP initialize). This fire-and-forget GET hits the
  // same serverless function the POST will hit and primes the MCP path — by the
  // time the user reads the greeting and types, both are warm. No Anthropic call,
  // zero cost; failure is ignored.
  useEffect(() => {
    fetch("/api/chat", { method: "GET" }).catch(() => {});
  }, []);

  // Auto-send the onboarding shopping intent once history is seeded, so the agent
  // actually responds (vs. sitting idle). Waits for apiMessages to populate to avoid
  // a race where sendMessage's closure would miss the onboarding context.
  useEffect(() => {
    if (initialSent.current || !initialQuery) return;
    if (apiMessages.length === 0) return;
    initialSent.current = true;
    sendMessage(initialQuery, userProfile, recipientProfile, cartProducts, { chatState: buildChatState(initialQuery) });
  }, [apiMessages, initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cart-add celebration: when the count rises, bump the celebrate signal so
  // Machan flashes his laugh frame. Separate ref from the cart-empty effect so
  // the two don't clobber each other's prev-count tracking.
  useEffect(() => {
    const prev = prevCartForCelebrate.current;
    prevCartForCelebrate.current = cartCount;
    if (cartCount > prev) setCartCelebrate((c) => c + 1);
  }, [cartCount]);

  // Cart-empty detection: when cart drops from non-zero to zero, inject a hidden
  // system message so the agent knows to exit any active checkout flow.
  useEffect(() => {
    const prev = prevCartCount.current;
    prevCartCount.current = cartCount;
    if (prev > 0 && cartCount === 0) {
      // Cart emptied → reset checkout flow state so the agent can't keep
      // collecting an address for an order that no longer has items.
      setCheckoutStage("idle");
      setDeliveryCity(null);
      sendSystemMessage(
        "[SYSTEM] The user has removed all items from the cart. The cart is now empty. Exit any active checkout flow immediately. Acknowledge naturally in one warm sentence and ask what they would like to look for next.",
        userProfile,
        recipientProfile,
        [],
        { cartItems: [], cartCount: 0, deliveryCity: null, checkoutStage: "idle", budgetStated: null }
      );
    }
  }, [cartCount]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // No celebration here — checkout auto-opens a new tab immediately, so any
    // cheer would never be seen. The celebration lives on cart-add (the visible
    // moment) instead. See cartCelebrate.
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
    sendMessage(text, userProfile, recipientProfile, cartProducts, { chatState: buildChatState(text) });
  }

  function handleAddToCart(product: Product) {
    addToCart(product);
    if (!isSending) {
      const msg = `I'd like to add the ${product.name} to my cart.`;
      // cartCount in buildChatState lags this synchronous add by one render, so
      // bump it explicitly for the outgoing state.
      const st = buildChatState(msg);
      sendMessage(msg, userProfile, recipientProfile, cartProducts, {
        chatState: { ...st, cartCount: st.cartCount + 1, cartItems: [...st.cartItems, { name: product.name, price: product.price }] },
      });
    }
  }

  function handleGiftSubmit(text: string) {
    const msg = `Please add this gift message to my order: "${text}"`;
    sendMessage(msg, userProfile, recipientProfile, cartProducts, { chatState: buildChatState(msg) });
  }

  function handleCheckout() {
    // Entering checkout → start collecting the delivery details. NO product-page
    // deep-link any more: checkout runs entirely through the agent, which collects
    // the required fields (name, phone, address, city) and then the server places a
    // real guest checkout via kapruka_create_order and returns the pay-link.
    setCheckoutStage((s) => (s === "complete" ? s : "collecting_address"));
    const msg = "I'm ready to checkout. Please place the order.";
    sendMessage(msg, userProfile, recipientProfile, cartProducts, { chatState: buildChatState(msg, "collecting_address") });
  }

  return (
    <div id="chat-screen">
      <div className="chat-panel">
        <Header voiceEnabled={voiceEnabled} onVoiceToggle={toggleVoice} />
        <MessageList chatItems={chatItems} speakingId={speakingId} onAddToCart={handleAddToCart} onGiftSubmit={handleGiftSubmit} />
        <div id="input-area">
          {/* Machan stands flush on top of the input bar, anchored over the mic.
              pointer-events:none so he never blocks the input. */}
          <div className="machan-floating" aria-hidden="true">
            <Confetti fireKey={cartCelebrate} />
            <MachanAvatar state={isSending ? "thinking" : "idle"} size={isMobile ? 56 : 80} celebrate={cartCelebrate} />
          </div>
          <VoiceTextInput onSend={handleSend} />
        </div>
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
