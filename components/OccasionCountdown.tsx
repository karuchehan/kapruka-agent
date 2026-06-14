"use client";
import { useRef, useState, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { OccasionInfo } from "@/lib/types";

interface Props {
  occasion: OccasionInfo;
}

function remainingLabel(targetIso: string): string {
  const target = new Date(targetIso).getTime();
  if (isNaN(target)) return "";
  const diffMs = target - Date.now();
  if (diffMs <= 0) return "Today!";

  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `in ${days} day${days === 1 ? "" : "s"}`;
  if (hours >= 1) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  return `in ${mins} min${mins === 1 ? "" : "s"}`;
}

export function OccasionCountdown({ occasion }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState(() => remainingLabel(occasion.targetDate));

  // Recompute every minute so the countdown stays live without churn.
  useEffect(() => {
    const tick = () => setLabel(remainingLabel(occasion.targetDate));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [occasion.targetDate]);

  useGSAP(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
      );
    }
  }, []);

  if (!label) return null;

  return (
    <div ref={ref} className="occasion-chip" role="status">
      {occasion.emoji && <span className="occasion-emoji" aria-hidden="true">{occasion.emoji}</span>}
      <span className="occasion-label">{occasion.label}</span>
      <span className="occasion-countdown">{label}</span>
    </div>
  );
}
