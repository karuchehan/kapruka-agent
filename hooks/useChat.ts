"use client";
import { useState, useRef } from "react";
import type { ChatItem, ApiMessage, UserProfile, RecipientProfile } from "@/lib/types";

let _id = 0;
const uid = () => `ci-${++_id}`;

export function useChat() {
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);

  function initWithOnboarding(messages: ApiMessage[]) {
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

      setChatItems((prev) => {
        const base = removePlaceholders(prev);
        if (base.some((i) => i.id === responseId)) return base; // already applied
        const additions: ChatItem[] = [];
        if (data.message) additions.push({ id: responseId, type: "agent", text: data.message });
        if (data.products?.length) {
          additions.push({ id: uid(), type: "products", products: data.products, checkoutUrl: data.checkoutUrl });
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
