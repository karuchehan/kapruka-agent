"use client";
import { useState, useRef } from "react";
import type { ChatItem, ApiMessage, UserProfile, RecipientProfile, Product } from "@/lib/types";

let _id = 0;
const uid = () => `ci-${++_id}`;

export function useChat() {
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

  function initWithOnboarding(messages: ApiMessage[]) {
    shownProductIds.current = new Set(); // new session — clear dedupe history
    lastShownProducts.current = [];
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
    recipientProfile: RecipientProfile
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
          if (shownProductIds.current.has(p.id)) return false;
          shownProductIds.current.add(p.id);
          return true;
        });
        // Remember this carousel so the next request can answer follow-ups
        // about these items without a re-search.
        if (freshProducts.length) lastShownProducts.current = freshProducts;
      }

      setChatItems((prev) => {
        const base = removePlaceholders(prev);
        if (base.some((i) => i.id === responseId)) return base; // already applied
        const additions: ChatItem[] = [];
        if (data.message) additions.push({ id: responseId, type: "agent", text: data.message });
        if (freshProducts.length) {
          additions.push({ id: uid(), type: "products", products: freshProducts, checkoutUrl: data.checkoutUrl });
        }
        // Structured delivery result from the API → render a DeliveryStatusCard.
        if (data.delivery?.city) {
          additions.push({ id: uid(), type: "delivery", delivery: data.delivery });
        }
        return [...base, ...additions];
      });

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
