"use client";

import { useRef, useState, useEffect } from "react";

interface Props {
  state: "idle" | "thinking";
  /** Wrapper height in px; images fill it (height 100%, width auto). */
  size?: number;
  /**
   * Increment this to fire a transient laugh reaction (e.g. on cart-add). Each
   * change to a new value flashes the laughing frame for 1.5s, then settles back
   * to idle/thinking — same cross-fade as tap-to-laugh.
   */
  celebrate?: number;
}

// Three mascot frames stacked absolutely; we cross-fade opacity between them and
// add a subtle scale settle so the "thinking" frame feels like it leans in.
// Images are sized to the wrapper height so Machan fits the header exactly —
// the PNG is chest-up, so filling the height makes him look like he's standing
// inside the bar.
//
// Tapping Machan fires a transient "laughing" frame for ~1s, then he fades back
// to his current default (idle, or thinking if the agent is busy) — same
// cross-fade used for idle↔thinking, so it feels of a piece.
export function MachanAvatar({ state, size = 80, celebrate = 0 }: Props) {
  const thinking = state === "thinking";
  const [laughing, setLaughing] = useState(false);
  const laughTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (laughTimer.current) clearTimeout(laughTimer.current); }, []);

  function fireLaugh(ms: number) {
    if (laughTimer.current) clearTimeout(laughTimer.current);
    setLaughing(true);
    laughTimer.current = setTimeout(() => setLaughing(false), ms);
  }

  function handleTap() {
    if (laughing) return; // already laughing — ignore re-taps until it settles
    fireLaugh(1000);
  }

  // Cart-add celebration: parent bumps `celebrate` on the same event that updates
  // the cart count. Skip the mount value (0) so he only laughs on real adds.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    fireLaugh(1500);
  }, [celebrate]);

  const imgStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: "100%",
    width: "auto",
    objectFit: "contain",
    // drop-shadow follows the PNG's alpha cutout (box-shadow would just box him),
    // so this casts a soft shadow off his actual silhouette — grounds him on the
    // bar and gives a subtle sense of depth/presence.
    filter: "drop-shadow(0 6px 9px rgba(0, 0, 0, 0.45)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35))",
    transition: "opacity 500ms ease-in-out, transform 500ms ease-in-out",
    transformOrigin: "bottom center",
  };
  const settle = thinking ? "scale(0.97)" : "scale(1)";

  return (
    <div
      className="machan-avatar"
      // Parent .machan-floating is pointer-events:none so it never blocks the
      // mic/send buttons; opt this child back in so the tap-to-laugh lands here.
      style={{ position: "relative", height: size, width: size, pointerEvents: "auto", cursor: "pointer" }}
      aria-hidden="true"
      onClick={handleTap}
    >
      <img
        src="/brand/logos/machan_idle.png"
        alt=""
        style={{ ...imgStyle, opacity: !thinking && !laughing ? 1 : 0, transform: settle }}
      />
      <img
        src="/brand/logos/machan_thinking.png"
        alt=""
        style={{ ...imgStyle, opacity: thinking && !laughing ? 1 : 0, transform: settle }}
      />
      <img
        src="/brand/logos/laughing.png"
        alt=""
        style={{ ...imgStyle, opacity: laughing ? 1 : 0, transform: laughing ? "scale(1)" : settle }}
      />
    </div>
  );
}
