"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export function TypingIndicator() {
  const dot0 = useRef<HTMLSpanElement>(null);
  const dot1 = useRef<HTMLSpanElement>(null);
  const dot2 = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const dots = [dot0.current, dot1.current, dot2.current].filter(Boolean);
    gsap.to(dots, {
      scaleY: 1.7,
      duration: 0.35,
      repeat: -1,
      yoyo: true,
      stagger: 0.15,
      ease: "power1.inOut",
    });
  }, []);

  return (
    <div className="message-row agent">
      <div className="agent-avatar">K</div>
      <div className="typing-dots">
        <span ref={dot0} />
        <span ref={dot1} />
        <span ref={dot2} />
      </div>
    </div>
  );
}
