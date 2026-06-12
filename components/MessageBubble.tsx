"use client";
import { useRef, useEffect } from "react";
import gsap from "gsap";

interface Props {
  role: "user" | "agent";
  text: string;
}

function sanitize(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

export function MessageBubble({ role, text }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    gsap.killTweensOf(el);
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" });
    return () => { gsap.killTweensOf(el); };
  }, []);

  return (
    <div ref={rowRef} className={`message-row ${role}`}>
      {role === "agent" && (
        <div className="agent-avatar">K</div>
      )}
      <div
        className="message-bubble"
        dangerouslySetInnerHTML={{ __html: sanitize(text) }}
      />
    </div>
  );
}
