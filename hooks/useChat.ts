"use client";
import { useState, useRef } from "react";
import type { ChatItem, ApiMessage, UserProfile, RecipientProfile, Product, ChatState } from "@/lib/types";

let _id = 0;
const uid = () => `ci-${++_id}`;

export function useChat(
  onCartAdd?: (product: Product) => void,
  onCartRemove?: (product: Product) => void,
  // Response-driven state syncs back to the owner (ChatScreen): a delivery check
  // confirms a city, an order confirmation completes checkout. Keeps the
  // externalized ChatState in step with what the server actually resolved.
  onDeliveryCity?: (city: string) => void,
  onOrderComplete?: () => void,
  // Checkout fields the agent captured this turn ([CO_*] markers) → accumulated by
  // the owner into ChatState.checkoutData and echoed back next turn.
  onCheckoutFields?: (fields: Partial<import("@/lib/types").CheckoutData>) => void,
) {
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  // The most recent carousel shown — sent to the API so the agent can answer
  // follow-ups ("what is that book about?") without re-searching.
  const lastShownProducts = useRef<Product[]>([]);
  // GiftMessageCard is a one-shot: render it the FIRST time the agent emits the
  // [GIFT_MESSAGE] marker, never again — even if the agent re-emits the marker
  // after the user has already saved a message. Reset only on a new session.
  const giftMessageShown = useRef(false);
  // OccasionCountdown chip is a one-shot too: render it the FIRST time an
  // [OCCASION_DATE] is detected, never again — the agent re-emits the marker on
  // later turns, which was making the chip reappear randomly. Reset only on a
  // new session.
  const occasionShown = useRef(false);
  // Checkout card is one-shot: only render the FIRST time ORDER_CONFIRMED fires.
  // Prevents a second checkout card (and a second window.open) if the agent
  // re-emits [ORDER_CONFIRMED: true] on a follow-up turn.
  const checkoutShown = useRef(false);
  // Unique ID for this chat session — sent with each request so the server can
  // key its search result cache per session. Generated fresh on every new session.
  const sessionId = useRef<string>("");

  function initWithOnboarding(messages: ApiMessage[]) {
    lastShownProducts.current = [];
    giftMessageShown.current = false;
    occasionShown.current = false;
    checkoutShown.current = false;
    sessionId.current = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    setApiMessages(messages);
    // Show the final onboarding agent message as the chat screen's welcome bubble
    const lastAgent = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAgent) {
      setChatItems([{ id: uid(), type: "agent", text: lastAgent.content }]);
    }
  }

  async function sendMessage(
    text: string,
    userProfile: UserProfile,
    recipientProfile: RecipientProfile,
    cartProducts: Product[] = [],
    opts: { showUserBubble?: boolean; chatState?: ChatState | null } = {}
  ) {
    const { showUserBubble = true, chatState = null } = opts;
    if (!text.trim() || isSendingRef.current) return;
    isSendingRef.current = true;
    setIsSending(true);

    const typingId = uid();
    const skeletonId = uid();

    setChatItems((prev) => [
      ...prev,
      ...(showUserBubble ? [{ id: uid(), type: "user" as const, text }] : []),
      { id: typingId, type: "typing" as const },
      { id: skeletonId, type: "skeleton" as const },
    ]);

    const newApiMessages: ApiMessage[] = [
      ...apiMessages,
      { role: "user", content: text },
    ];
    setApiMessages(newApiMessages);

    // Client-side abort after 22s — prevents infinite loading if server hangs
    const controller = new AbortController();
    const clientTimeout = setTimeout(() => controller.abort(), 22000);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newApiMessages,
          userProfile,
          recipientProfile,
          lastShownProducts: lastShownProducts.current,
          sessionId: sessionId.current,
          chatState,
          // Full cart products (with product_id) so the server can build the
          // create_order payload — ChatState.cartItems only carries name+price.
          cartProducts,
        }),
      });
      clearTimeout(clientTimeout);

      const removePlaceholders = (prev: ChatItem[]) =>
        prev.filter((i) => i.id !== typingId && i.id !== skeletonId);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Network error" }));
        setChatItems((prev) => [
          ...removePlaceholders(prev),
          { id: uid(), type: "agent", text: `Sorry, something went wrong: ${err.error || res.statusText}` },
        ]);
        setApiMessages((prev) => prev.slice(0, -1));
        return;
      }

      const data = await res.json();

      // responseId computed OUTSIDE the updater — same value on both Strict Mode calls.
      // Used as a guard: if the agent item with this id is already in prev, the update
      // was already applied (handles Strict Mode double-invocation and any real double-call).
      const responseId = uid();

      // Dedup WITHIN this response only (MCP returns duplicate rows in a single
      // batch). We intentionally do NOT dedup across the session: products render
      // only on the right-hand stage, which shows the LATEST batch — a session-wide
      // dedup dropped every already-seen product on a repeat search, leaving
      // freshProducts empty so no "products" turn was appended and the stage froze
      // on a stale batch. The stage must reflect every search verbatim.
      let freshProducts: Product[] = [];
      if (data.products?.length) {
        const seenThisBatch = new Set<string>();
        freshProducts = (data.products as Product[]).filter((p) => {
          // id||name key — MCP products frequently have no id field
          // (normaliseProduct sets id:""), so name backstops the dedup key.
          const key = p.id || p.name;
          if (!key || seenThisBatch.has(key)) return false;
          seenThisBatch.add(key);
          return true;
        });
        // Remember this carousel so the next request can answer follow-ups
        // about these items without a re-search.
        if (freshProducts.length) lastShownProducts.current = freshProducts;
      }

      // One-shot gift card: only render when the marker fires AND it has never
      // been shown this session. Decided OUTSIDE the updater (which runs twice
      // under Strict Mode) so the second pass doesn't see an already-flipped
      // flag and drop the card on its very first appearance.
      const showGift = !!data.giftMessage && !giftMessageShown.current;
      if (showGift) giftMessageShown.current = true;

      // One-shot occasion chip: only render the FIRST time a date is detected.
      // Decided OUTSIDE the updater (StrictMode double-invoke safe), same as
      // showGift — otherwise the second pass sees the flipped flag and drops it.
      const showOccasion = !!data.occasion?.targetDate && !occasionShown.current;
      if (showOccasion) occasionShown.current = true;

      // Order confirmed → the server placed a real guest checkout via
      // kapruka_create_order and returned data.checkout (pay-link + locked totals +
      // expiry). The card + auto-open use THAT url — never a product-page deep-link.
      // One-shot guard prevents a second card / second window.open on a re-emit.
      const showCheckout = !!data.orderConfirmed && !!data.checkout?.checkoutUrl && !checkoutShown.current;
      if (showCheckout) checkoutShown.current = true;
      const checkoutItems: Product[] = showCheckout
        ? (cartProducts.length ? cartProducts : lastShownProducts.current)
        : [];
      const checkoutPrimaryUrl = showCheckout ? (data.checkout.checkoutUrl as string) : "";

      setChatItems((prev) => {
        const base = removePlaceholders(prev);
        // Already applied? Guard on responseId, and also on the gift/checkout
        // sentinels for the case where data.message is empty (responseId never
        // gets added then).
        if (base.some((i) => i.id === responseId || i.id === responseId + "-gift" || i.id === responseId + "-checkout" || i.id === responseId + "-nameask")) return base;
        const additions: ChatItem[] = [];
        if (data.message) additions.push({ id: responseId, type: "agent", text: data.message });
        // The name question rides back as its own field → its own agent bubble,
        // visually distinct from the product reply (never appended to it).
        if (data.nameAsk) additions.push({ id: responseId + "-nameask", type: "agent", text: data.nameAsk });
        if (freshProducts.length) {
          additions.push({ id: uid(), type: "products", products: freshProducts, checkoutUrl: data.checkoutUrl });
        }
        // Structured delivery result from the API → render a DeliveryStatusCard.
        if (data.delivery?.city) {
          additions.push({ id: uid(), type: "delivery", delivery: data.delivery });
        }
        // Order tracking result → render a TrackingCard (status + timeline, or
        // the graceful not-found state).
        if (data.tracking?.orderNumber) {
          additions.push({ id: uid(), type: "tracking", tracking: data.tracking });
        }
        // Detected occasion/deadline → render a live countdown chip, but only
        // the first time per session (see showOccasion above).
        if (showOccasion) {
          additions.push({ id: uid(), type: "occasion", occasion: data.occasion });
        }
        // Agent invites a gift message → render an editable greeting card,
        // but only the first time per session (see showGift above).
        if (showGift) {
          const gm = typeof data.giftMessage === "object" ? data.giftMessage : {};
          additions.push({ id: responseId + "-gift", type: "giftMessage", giftMessage: gm });
        }
        // Agent suggests a bundle/hamper → render the grouped mini-card view.
        if (data.bundle?.items?.length) {
          additions.push({ id: uid(), type: "bundle", bundle: data.bundle });
        }
        // Order confirmed → checkout card with the real pay-link + totals
        // (auto-open handled in ChatScreen).
        if (showCheckout) {
          additions.push({ id: responseId + "-checkout", type: "checkout", products: checkoutItems, checkoutUrl: checkoutPrimaryUrl, checkout: data.checkout });
        }
        return [...base, ...additions];
      });

      // Sync externalized ChatState from what the server resolved this turn:
      // a delivery check confirms the city; a real order (create_order succeeded)
      // completes checkout. Checkout fields the agent captured are accumulated too.
      if (data.delivery?.city && onDeliveryCity) onDeliveryCity(data.delivery.city);
      if (data.checkoutFields && onCheckoutFields && Object.keys(data.checkoutFields).length) {
        onCheckoutFields(data.checkoutFields);
      }
      if (data.orderConfirmed && data.checkout && onOrderComplete) onOrderComplete();

      // Agent confirmed adding items → sync them into the cart (dock + checkout).
      // Runs once per response (not in a setState updater) so it's StrictMode-safe.
      if (onCartAdd && Array.isArray(data.addedProducts)) {
        for (const p of data.addedProducts as Product[]) onCartAdd(p);
      }

      // Agent confirmed removing items → remove them from the cart dock.
      if (onCartRemove && Array.isArray(data.removedProducts)) {
        for (const p of data.removedProducts as Product[]) onCartRemove(p);
      }

      // Keep the name ask in conversation history (joined to the reply) so the
      // model's "already asked?" scan sees it and never re-asks — even though it
      // renders as a separate bubble.
      const assistantContent = [data.message, data.nameAsk].filter(Boolean).join(" ");
      if (assistantContent) {
        setApiMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
      } else {
        setApiMessages((prev) => prev.slice(0, -1));
      }
    } catch {
      clearTimeout(clientTimeout);
      setChatItems((prev) => [
        ...prev.filter((i) => i.id !== typingId && i.id !== skeletonId),
        { id: uid(), type: "agent", text: "Connection error. Please try again." },
      ]);
      setApiMessages((prev) => prev.slice(0, -1));
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  function sendSystemMessage(
    text: string,
    userProfile: UserProfile,
    recipientProfile: RecipientProfile,
    cartProducts: Product[] = [],
    chatState: ChatState | null = null
  ) {
    return sendMessage(text, userProfile, recipientProfile, cartProducts, { showUserBubble: false, chatState });
  }

  return { chatItems, apiMessages, isSending, sendMessage, sendSystemMessage, initWithOnboarding };
}
