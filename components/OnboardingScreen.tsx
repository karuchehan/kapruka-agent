"use client";
import { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import type { UserProfile, ApiMessage } from "@/lib/types";

interface Props {
  onComplete: (userProfile: UserProfile, obMessages: ApiMessage[], initialQuery: string) => void;
}

const STEPS = [
  "Hey! Just a few quick things so I can give you better recommendations. What's your name?",
  null as string | null,
  "And are you male or female?",
];

interface Bubble {
  id: number;
  role: "agent" | "user";
  text: string;
}

let bubbleId = 0;

export function OnboardingScreen({ onComplete }: Props) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>({ name: "", age: null, gender: "" });
  const msgsRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const inputRowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addBubble(role: "agent" | "user", text: string) {
    setBubbles((prev) => [...prev, { id: ++bubbleId, role, text }]);
  }

  // Set exact top/bottom of messages container from measured logo position.
  // Called on logo load (primary) and via rAF on mount (cached-image fallback).
  function positionMessages() {
    const el = msgsRef.current;
    const logo = logoRef.current;
    const inputRow = inputRowRef.current;
    if (!el || !logo) return;
    const parent = el.offsetParent as HTMLElement | null;
    if (!parent) return;
    const logoRect = logo.getBoundingClientRect();
    if (logoRect.height === 0) return; // image not yet loaded
    const parentRect = parent.getBoundingClientRect();
    const msgTop = Math.round(logoRect.bottom + 20 - parentRect.top);
    el.style.top = `${msgTop}px`;
    const inputH = inputRow ? (inputRow.offsetHeight || 52) : 52;
    el.style.bottom = `${80 + inputH + 16}px`;
  }

  useEffect(() => {
    const raf = requestAnimationFrame(positionMessages);
    setTimeout(() => addBubble("agent", STEPS[0]!), 400);
    inputRef.current?.focus();
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fade in new bubble, then scroll container to bottom so newest is always visible
  useEffect(() => {
    const el = msgsRef.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const last = items[items.length - 1];
    if (last) {
      gsap.killTweensOf(last);
      gsap.fromTo(last, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.38, ease: "power2.out" });
    }
    el.scrollTop = el.scrollHeight;
  }, [bubbles]);

  function handleSubmit() {
    const val = inputValue.trim();
    if (!val) return;
    addBubble("user", val);
    setInputValue("");

    if (step === 0) {
      const name = val.split(" ")[0];
      setProfile((p) => ({ ...p, name }));
      setStep(1);
      const msg = `Nice to meet you, ${name}! How old are you?`;
      STEPS[1] = msg;
      setTimeout(() => addBubble("agent", msg), 500);

    } else if (step === 1) {
      const age = parseInt(val);
      if (isNaN(age) || age < 1 || age > 120) {
        setTimeout(() => addBubble("agent", "Just your age as a number — how old are you?"), 500);
        return;
      }
      setProfile((p) => ({ ...p, age }));
      setStep(2);
      setTimeout(() => addBubble("agent", STEPS[2]!), 500);

    } else if (step === 2) {
      const lower = val.toLowerCase();
      let gender = val;
      if (lower.includes("male") || lower.includes("man") || lower.includes("boy") || lower === "m") gender = "male";
      else if (lower.includes("female") || lower.includes("woman") || lower.includes("girl") || lower === "f") gender = "female";

      const finalProfile = { ...profile, gender };
      const shoppingMsg = `Perfect! So what are we shopping for today, ${profile.name}?`;
      const obMessages: ApiMessage[] = [
        { role: "assistant", content: STEPS[0]! },
        { role: "user", content: finalProfile.name },
        { role: "assistant", content: STEPS[1]! },
        { role: "user", content: String(finalProfile.age ?? "") },
        { role: "assistant", content: STEPS[2]! },
        { role: "user", content: finalProfile.gender },
        { role: "assistant", content: shoppingMsg },
      ];
      setTimeout(() => onComplete(finalProfile, obMessages, ""), 700);
    }
  }

  return (
    <div id="onboarding-screen">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={logoRef} src="/brand/logos/kapruka-main-cropped.svg" alt="Kapruka" className="onboarding-logo" onLoad={positionMessages} />
      <div className="onboarding-inner">
        <div id="onboarding-messages" ref={msgsRef} role="log" aria-live="polite">
          {bubbles.map((b) => (
            <div key={b.id} className={`ob-bubble ${b.role}`}>{b.text}</div>
          ))}
        </div>
        <div className="onboarding-input-row" ref={inputRowRef}>
          <input
            ref={inputRef}
            type="text"
            id="onboarding-input"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Type here…"
            aria-label="Your answer"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          <button id="onboarding-send" aria-label="Send" onClick={handleSubmit}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
