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
  null as string | null,
];

const QUICKSTART = [
  { emoji: "🎂", label: "Birthday gift" },
  { emoji: "💐", label: "Flowers" },
  { emoji: "🎁", label: "Hamper" },
  { emoji: "📦", label: "Track order" },
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
  const inputRef = useRef<HTMLInputElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  function addBubble(role: "agent" | "user", text: string) {
    setBubbles((prev) => [...prev, { id: ++bubbleId, role, text }]);
  }

  useEffect(() => {
    setTimeout(() => addBubble("agent", STEPS[0]!), 400);
    inputRef.current?.focus();
  }, []);

  // Scroll to bottom when bubbles change
  useEffect(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles]);

  // GSAP on new bubbles
  useEffect(() => {
    const el = msgsRef.current;
    if (!el) return;
    const last = el.lastElementChild as HTMLElement | null;
    if (last) {
      gsap.killTweensOf(last);
      gsap.fromTo(last, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.38, ease: "power2.out" });
    }
  }, [bubbles]);

  // GSAP staggered entrance on quick-start chips when they mount (step 3)
  useEffect(() => {
    if (step !== 3 || !chipsRef.current) return;
    const chips = chipsRef.current.children;
    gsap.fromTo(
      chips,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", stagger: 0.06, delay: 0.6 }
    );
  }, [step]);

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

      setProfile((p) => ({ ...p, gender }));
      const msg = `Perfect! So what are we shopping for today, ${profile.name}?`;
      STEPS[3] = msg;
      setStep(3);
      setTimeout(() => addBubble("agent", msg), 500);

    } else if (step === 3) {
      submitShopping(val);
    }
  }

  // Final intake answer (typed or via a quick-start chip).
  // Seed history ends at the closing agent question; the shopping intent is passed
  // as initialQuery so ChatScreen auto-sends it (agent actually responds).
  function submitShopping(text: string) {
    const finalProfile = { ...profile };
    const obMessages: ApiMessage[] = [
      { role: "assistant", content: STEPS[0]! },
      { role: "user", content: finalProfile.name },
      { role: "assistant", content: STEPS[1]! },
      { role: "user", content: String(finalProfile.age ?? "") },
      { role: "assistant", content: STEPS[2]! },
      { role: "user", content: finalProfile.gender },
      { role: "assistant", content: STEPS[3]! },
    ];
    setTimeout(() => onComplete(finalProfile, obMessages, text), 700);
  }

  function handleChip(label: string) {
    if (step !== 3) return;
    addBubble("user", label);
    setInputValue("");
    submitShopping(label);
  }

  return (
    <div id="onboarding-screen">
      <div className="onboarding-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logos/kapruka-logo.svg" alt="Kapruka" className="onboarding-logo" />
        <div className="brand-lockup">
          <div className="brand-dot" />
          <span className="brand-name">Kapruka</span>
        </div>
        <p className="onboarding-tagline">What would you like to send today?</p>
        <div id="onboarding-messages" ref={msgsRef} role="log" aria-live="polite">
          {bubbles.map((b) => (
            <div key={b.id} className={`ob-bubble ${b.role}`}>{b.text}</div>
          ))}
        </div>
        {step === 3 && (
          <div className="quickstart-chips" ref={chipsRef}>
            {QUICKSTART.map((c) => (
              <button
                key={c.label}
                type="button"
                className="chip"
                onClick={() => handleChip(c.label)}
              >
                <span className="chip-emoji">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        )}
        <div className="onboarding-input-row">
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
