"use client";
import { useState, useRef } from "react";
import type { ChatItem, ApiMessage, UserProfile, RecipientProfile, Product } from "@/lib/types";

let _id = 0;
const uid = () => `ci-${++_id}`;

export function useChat(onCartAdd?: (product: Product) => void) {
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  // Product ids already shown in any carousel this session — prevents the same
  // product reappearing in a later message row. Reset only when a new session starts.
  const shownProductIds = useRef<Set<string>>(new Set());
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

  function initWithOnboarding(messages: ApiMessage[]) {
    shownProductIds.current = new Set(); // new session — clear dedupe history
    lastShownProducts.current = [];
    giftMessageShown.current = false;
    occasionShown.current = false;
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
    cartProducts: Product[] = []
  ) {
    if (!text.trim() || isSendingRef.current) return;
    isSendingRef.current = true;
    setIsSending(true);

    const typingId = uid();
    const skeletonId = uid();

    setChatItems((prev) => [
      ...prev,
      { id: uid(), type: "user", text },
      { id: typingId, type: "typing" },
      { id: skeletonId, type: "skeleton" },
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

      // Filter out products already shown anywhere this session, then record the
      // survivors. Done OUTSIDE the updater: setState updaters run twice under
      // Strict Mode, and mutating the ref inside would filter the second pass
      // against an already-populated set and drop the whole carousel.
      let freshProducts: Product[] = [];
      if (data.products?.length) {
        // Reject ids already shown this session AND repeats within THIS response
        // (MCP itself returns duplicate rows) — add to the Set during the filter
        // so the second occurrence of a same-response id is dropped too.
        freshProducts = (data.products as Product[]).filter((p) => {
          // Use id||name as the dedup key — MCP products frequently have no id
          // field, so normaliseProduct sets id:"". All empty-id products would
          // share the key "" and every one after the first would be dropped,
          // making freshProducts empty and leaving the old carousel in the stage.
          const key = p.id || p.name;
          if (!key || shownProductIds.current.has(key)) return false;
          shownProductIds.current.add(key);
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

      // Order confirmed → build a checkout card from the CART (the items the user
      // actually added). Fall back to the last carousel if the cart is empty.
      // URL comes from the product page, never from the model. Decided outside the
      // updater (StrictMode double-invoke safe), same as showGift / freshProducts.
      const showCheckout = !!data.orderConfirmed;
      let checkoutItems: Product[] = [];
      let checkoutPrimaryUrl = "";
      if (showCheckout) {
        checkoutItems = cartProducts.length ? cartProducts : lastShownProducts.current;
        checkoutPrimaryUrl = checkoutItems.find((p) => p.url)?.url || "";
      }

      setChatItems((prev) => {
        const base = removePlaceholders(prev);
        // Already applied? Guard on responseId, and also on the gift/checkout
        // sentinels for the case where data.message is empty (responseId never
        // gets added then).
        if (base.some((i) => i.id === responseId || i.id === responseId + "-gift" || i.id === responseId + "-checkout")) return base;
        const additions: ChatItem[] = [];
        if (data.message) additions.push({ id: responseId, type: "agent", text: data.message });
        if (freshProducts.length) {
          additions.push({ id: uid(), type: "products", products: freshProducts, checkoutUrl: data.checkoutUrl });
        }
        // Structured delivery result from the API → render a DeliveryStatusCard.
        if (data.delivery?.city) {
          additions.push({ id: uid(), type: "delivery", delivery: data.delivery });
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
        // Order confirmed → checkout card (auto-open handled in ChatScreen).
        if (showCheckout) {
          additions.push({ id: responseId + "-checkout", type: "checkout", products: checkoutItems, checkoutUrl: checkoutPrimaryUrl });
        }
        return [...base, ...additions];
      });

      // Agent confirmed adding items → sync them into the cart (dock + checkout).
      // Runs once per response (not in a setState updater) so it's StrictMode-safe.
      if (onCartAdd && Array.isArray(data.addedProducts)) {
        for (const p of data.addedProducts as Product[]) onCartAdd(p);
      }

      if (data.message) {
        setApiMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
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

  return { chatItems, apiMessages, isSending, sendMessage, initWithOnboarding };
}
