"use client";
import { useEffect, useState } from "react";

// Brand-only palette — accent gold + deep purple.
const COLORS = ["#FFD000", "#402970"];

interface Piece {
  id: number;
  cx: number;   // horizontal drift (px)
  cpy: number;  // peak height (negative = up)
  cey: number;  // end height (falls back down)
  rot: number;  // total rotation (deg)
  delay: number;
  size: number;
  color: string;
}

// One upward burst of ~28 pieces from the origin. Trajectories are randomized
// per burst; positions are baked into CSS custom props and the whole thing is
// driven by one keyframe (arc up, then fall + fade). No layout, only transforms,
// so it can never create scroll/overflow.
function makeBurst(seed: number): Piece[] {
  const n = 28;
  const out: Piece[] = [];
  for (let i = 0; i < n; i++) {
    // Spread mostly upward: ±58° around straight up.
    const angle = (-90 + (Math.random() * 116 - 58)) * (Math.PI / 180);
    const dist = 80 + Math.random() * 120;
    const cx = Math.cos(angle) * dist;
    const cpy = Math.sin(angle) * dist - 30;          // peak (up)
    const cey = cpy + 150 + Math.random() * 130;      // then fall past origin
    out.push({
      id: seed * 100 + i,
      cx,
      cpy,
      cey,
      rot: Math.random() * 720 - 360,
      delay: Math.random() * 0.08,
      size: 6 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
    });
  }
  return out;
}

/**
 * Fires a confetti burst each time `fireKey` changes to a new positive value.
 * Clears itself after 2s. Renders nothing when idle. Meant to be dropped inside
 * a positioned, pointer-events:none container (e.g. .machan-floating) so it
 * originates from Machan and bursts up over the chat.
 */
export function Confetti({ fireKey }: { fireKey: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (fireKey <= 0) return;
    setPieces(makeBurst(fireKey));
    const t = setTimeout(() => setPieces([]), 2000);
    return () => clearTimeout(t);
  }, [fireKey]);

  if (!pieces.length) return null;

  return (
    <div className="confetti-origin" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            animationDelay: `${p.delay}s`,
            // Custom props consumed by the confetti-fly keyframe.
            ["--cx" as string]: `${p.cx}px`,
            ["--cpy" as string]: `${p.cpy}px`,
            ["--cey" as string]: `${p.cey}px`,
            ["--crot" as string]: `${p.rot}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
