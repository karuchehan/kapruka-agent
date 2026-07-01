"use client";

import { useRef, useState, useEffect } from "react";

interface Props {
  state: "idle" | "thinking";
  /** Wrapper height in px; images fill it (height 100%, width auto). */
  size?: number;
  /**
   * Increment on cart-add to fire the fists-up celebrate frame for 3s, then
   * settle back to idle/thinking. This is the visible celebratory moment (the
   * checkout auto-opens a new tab, so a checkout cheer is never seen).
   */
  celebrate?: number;
  /**
   * Increment to fire a brief left-right shake (0.4s) on the idle frame — the
   * "nothing here" reaction when the user tries to checkout with an empty cart.
   * No dedicated sad/shrug asset exists, so this reuses idle + a CSS shake.
   */
  shake?: number;
}

// Four mascot frames stacked absolutely; we cross-fade opacity between them and
// add a subtle scale settle so the "thinking" frame feels like it leans in.
// Images are sized to the wrapper height so Machan fits the header exactly —
// the PNG is chest-up, so filling the height makes him look like he's standing
// inside the bar.
//
// Tapping Machan fires a transient "laughing" frame for ~1s. A cart-add fires the
// fists-up "celebrate" frame for 3s (via `celebrate`) — the visible celebratory
// moment. All use the same cross-fade so it's of a piece.
export function MachanAvatar({ state, size = 80, celebrate = 0, shake = 0 }: Props) {
  const thinking = state === "thinking";
  const [laughing, setLaughing] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [shaking, setShaking] = useState(false);
  const laughTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cheerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (laughTimer.current) clearTimeout(laughTimer.current);
    if (cheerTimer.current) clearTimeout(cheerTimer.current);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
  }, []);

  function fireLaugh(ms: number) {
    if (laughTimer.current) clearTimeout(laughTimer.current);
    setLaughing(true);
    laughTimer.current = setTimeout(() => setLaughing(false), ms);
  }

  function handleTap() {
    if (laughing || celebrating) return; // already reacting — ignore re-taps until it settles
    fireLaugh(1000);
  }

  // Cart-add cheer: parent bumps `celebrate` on the same event that updates the
  // cart count. Fires the fists-up frame for 3s (outranks laugh/thinking). Skip
  // the mount value (0) so he only cheers on real adds.
  const firstCart = useRef(true);
  useEffect(() => {
    if (firstCart.current) { firstCart.current = false; return; }
    if (laughTimer.current) clearTimeout(laughTimer.current);
    setLaughing(false);
    if (cheerTimer.current) clearTimeout(cheerTimer.current);
    setCelebrating(true);
    cheerTimer.current = setTimeout(() => setCelebrating(false), 3000);
  }, [celebrate]);

  // Empty-cart-checkout shake: parent bumps `shake` when the server rejects a
  // checkout with nothing in the cart. Fires a brief left-right shake on the
  // idle frame. Skip the mount value (0) so it never fires on first render.
  const firstShake = useRef(true);
  useEffect(() => {
    if (firstShake.current) { firstShake.current = false; return; }
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShaking(true);
    shakeTimer.current = setTimeout(() => setShaking(false), 400);
  }, [shake]);

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
  // Celebrating gets a little pop; thinking settles back slightly; idle rests.
  const settle = celebrating ? "scale(1.04)" : thinking ? "scale(0.97)" : "scale(1)";

  // Precedence: celebrate > laugh > thinking > idle.
  const showIdle = !thinking && !laughing && !celebrating;
  const showThinking = thinking && !laughing && !celebrating;
  const showLaughing = laughing && !celebrating;

  return (
    <div
      className={`machan-avatar${shaking ? " shaking" : ""}`}
      // Parent .machan-floating is pointer-events:none so it never blocks the
      // mic/send buttons; opt this child back in so the tap-to-laugh lands here.
      style={{ position: "relative", height: size, width: size, pointerEvents: "auto", cursor: "pointer" }}
      aria-hidden="true"
      onClick={handleTap}
    >
      <img
        src="/brand/logos/dulith_idle.png"
        alt=""
        style={{ ...imgStyle, opacity: showIdle ? 1 : 0, transform: settle }}
      />
      <img
        src="/brand/logos/dulith_thinking.png"
        alt=""
        style={{ ...imgStyle, opacity: showThinking ? 1 : 0, transform: settle }}
      />
      <img
        src="/brand/logos/dulith_laughing.png"
        alt=""
        style={{ ...imgStyle, opacity: showLaughing ? 1 : 0, transform: showLaughing ? "scale(1)" : settle }}
      />
      <img
        src="/brand/logos/dulith_celebrate.png"
        alt=""
        style={{ ...imgStyle, opacity: celebrating ? 1 : 0, transform: settle }}
      />
    </div>
  );
}
