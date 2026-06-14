"use client";
import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { GiftMessageInfo } from "@/lib/types";

interface Props {
  giftMessage: GiftMessageInfo;
  onSubmit: (text: string) => void;
}

export function GiftMessageCard({ giftMessage, onSubmit }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(giftMessage.prefill ?? "");
  const [saved, setSaved] = useState(false);

  useGSAP(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 14, rotate: -4 },
        { opacity: 1, y: 0, rotate: -1, duration: 0.45, ease: "power3.out" }
      );
    }
  }, []);

  function handleSave() {
    const val = text.trim();
    if (!val || saved) return;
    setSaved(true);
    onSubmit(val);
  }

  return (
    <div ref={ref} className="gift-card">
      <div className="gift-card-label">Gift message</div>
      <textarea
        className="gift-card-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write something warm…"
        rows={3}
        disabled={saved}
        aria-label="Gift message"
      />
      <button
        className="gift-card-save"
        onClick={handleSave}
        disabled={saved || !text.trim()}
      >
        {saved ? "Added to your order ✓" : "Add gift message"}
      </button>
    </div>
  );
}
