"use client";
import { useRef, useEffect } from "react";
import gsap from "gsap";

interface Props {
  /** True while the matching agent message is being spoken aloud. */
  isSpeaking: boolean;
}

/**
 * The Kapruka "U" mark used as the agent's mouth. When the message it belongs
 * to is being spoken, it flutters — scaleY 1↔1.4, scaleX 1↔0.85 — at a
 * randomised cadence so it reads as talking, not a metronome. When speech
 * stops it snaps back to rest.
 */
export function KaprukaMouth({ isSpeaking }: Props) {
  const el = useRef<HTMLImageElement>(null);
  // Live mirror of isSpeaking so the recursive flutter loop can read the
  // current value without being re-created every render.
  const speakingRef = useRef(isSpeaking);
  const tween = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    speakingRef.current = isSpeaking;
    const node = el.current;
    if (!node) return;

    if (isSpeaking) {
      // One out-and-back cycle at a random duration; on completion, if we are
      // still speaking, schedule the next cycle with a fresh random duration.
      const flutter = () => {
        tween.current = gsap.to(node, {
          scaleY: 1.4,
          scaleX: 0.85,
          duration: gsap.utils.random(0.08, 0.15),
          ease: "sine.inOut",
          transformOrigin: "50% 50%",
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            if (speakingRef.current) flutter();
          },
        });
      };
      flutter();
    } else {
      tween.current?.kill();
      gsap.to(node, { scaleY: 1, scaleX: 1, duration: 0.2, ease: "power2.out" });
    }

    return () => {
      tween.current?.kill();
    };
  }, [isSpeaking]);

  return (
    <img
      ref={el}
      src="/letterU-cropped.svg"
      alt=""
      aria-hidden="true"
      style={{
        width: 28,
        height: "auto",
        alignSelf: "center",
        flexShrink: 0,
        display: "block",
        willChange: "transform",
      }}
    />
  );
}
