"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { gsap } from "gsap";

type Mode = "collapsed" | "text" | "voice";

interface Props {
  /** Fired when the user submits typed text (Enter / send). Optional. */
  onSend?: (text: string) => void;
  /** Placeholder shown in the resting input. */
  placeholder?: string;
}

/**
 * Self-contained text input with a mic that morphs into a voice "listening" pill.
 *
 * Three mutually exclusive modes, one state var:
 *   - collapsed: resting input + mic on the right
 *   - text:      input focused, X clears/collapses, outside tap snaps back
 *   - voice:     dark pill expands leftward from the mic, mic→checkmark morph
 *
 * Animation is GSAP (pill width / 360° rotate / mic↔check crossfade) plus a CSS
 * wave for the dots. No real speech recognition — visual only.
 */
export function VoiceTextInput({ onSend, placeholder = "What are you looking for today?" }: Props) {
  const [mode, setMode] = useState<Mode>("collapsed");
  const [value, setValue] = useState("");
  const animating = useRef(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const micWrapRef = useRef<HTMLDivElement>(null);   // rotates; holds mic + check
  const micIconRef = useRef<HTMLSpanElement>(null);
  const checkIconRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);   // X + dots + label, fades in
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  // ---- voice enter -------------------------------------------------------
  const enterVoice = useCallback(() => {
    if (animating.current || mode === "voice") return;
    animating.current = true;
    setMode("voice");

    // pill is always mounted; run on next frame so layout is settled.
    requestAnimationFrame(() => {
      tlRef.current?.kill();
      const tl = gsap.timeline({ onComplete: () => { animating.current = false; } });

      tl.set(pillRef.current, { width: 0 })
        .set(micWrapRef.current, { rotation: 0 })
        .set(micIconRef.current, { opacity: 1 })
        .set(checkIconRef.current, { opacity: 0 })
        .set(contentRef.current, { opacity: 0 })
        // 1. width expansion — deliberate, leftward (right-anchored)
        .to(pillRef.current, { width: "100%", duration: 0.65, ease: "power2.inOut" }, 0)
        // 2. mic rotates 360°, crossfades to checkmark
        .to(micWrapRef.current, { rotation: 360, duration: 0.48, ease: "power2.inOut" }, 0)
        .to(micIconRef.current, { opacity: 0, duration: 0.48 * 0.45, ease: "none" }, 0)
        .to(checkIconRef.current, { opacity: 1, duration: 0.48 * 0.45, ease: "none" }, 0.48 * 0.55)
        // 3. inner content staggers in AFTER the pill has begun opening
        .to(contentRef.current, { opacity: 1, duration: 0.2, ease: "power1.out" }, 0.15);

      tlRef.current = tl;
    });
  }, [mode]);

  // ---- voice exit (X or checkmark) --------------------------------------
  const exitVoice = useCallback(() => {
    if (animating.current && tlRef.current?.isActive()) return;
    animating.current = true;
    tlRef.current?.kill();

    const tl = gsap.timeline({
      onComplete: () => {
        animating.current = false;
        setMode("collapsed");
        gsap.set(micWrapRef.current, { rotation: 0 });
        gsap.set(micIconRef.current, { opacity: 1 });
        gsap.set(checkIconRef.current, { opacity: 0 });
      },
    });

    // fade content out FIRST, then shrink the pill back to the right
    tl.to([contentRef.current, checkIconRef.current], { opacity: 0, duration: 0.15, ease: "power1.in" })
      .to(micIconRef.current, { opacity: 1, duration: 0.15 }, "<")
      .to(micWrapRef.current, { rotation: 0, duration: 0.4, ease: "power2.inOut" }, "<")
      .to(pillRef.current, { width: 0, duration: 0.45, ease: "power2.inOut" }, "<");

    tlRef.current = tl;
  }, []);

  // ---- text mode ---------------------------------------------------------
  const collapseFromText = useCallback(() => {
    inputRef.current?.blur();
    setMode("collapsed");
  }, []);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text) return;
    onSend?.(text);
    setValue("");
    inputRef.current?.blur();
    setMode("collapsed");
  }, [value, onSend]);

  useEffect(() => () => { tlRef.current?.kill(); }, []);

  const showPlaceholder = value.length === 0;

  return (
    <div className="vti-root">
      {/* Outside-tap catcher — only live in text mode, sits BEHIND the bar so a
          tap anywhere on the background snaps the input closed instantly. */}
      {mode === "text" && (
        <div className="vti-overlay" onMouseDown={collapseFromText} aria-hidden="true" />
      )}

      <div className="vti-bar" data-mode={mode}>
        {/* Custom placeholder — faded (not native) so it transitions smoothly. */}
        <span className="vti-placeholder" style={{ opacity: showPlaceholder ? 1 : 0 }}>
          {placeholder}
        </span>

        <input
          ref={inputRef}
          className="vti-input"
          type="text"
          value={value}
          aria-label="Message input"
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => mode === "collapsed" && setMode("text")}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
            if (e.key === "Escape") collapseFromText();
          }}
        />

        {/* Right action button — mic (collapsed) / X (text). Hidden under pill in voice. */}
        <button
          type="button"
          className="vti-action"
          aria-label={mode === "text" ? "Clear" : "Voice input"}
          onClick={() => {
            if (mode === "text") { setValue(""); collapseFromText(); }
            else enterVoice();
          }}
        >
          {mode === "text" ? <XIcon /> : <MicIcon />}
        </button>

        {/* Voice pill — always mounted, width driven by GSAP. Grows leftward. */}
        <div className="vti-pill" ref={pillRef} aria-hidden={mode !== "voice"}>
          <div className="vti-pill-content" ref={contentRef}>
            <button type="button" className="vti-pill-cancel" aria-label="Cancel" onClick={exitVoice}>
              <XIcon />
            </button>
            <div className="vti-dots" aria-hidden="true">
              <span /><span /><span />
            </div>
            <span className="vti-listening">Listening…</span>
          </div>

          {/* mic ↔ check, anchored right, rotates as the pill opens */}
          <div className="vti-mic-wrap" ref={micWrapRef}>
            <button type="button" className="vti-pill-confirm" aria-label="Confirm" onClick={exitVoice}>
              <span className="vti-icon-layer" ref={micIconRef}><MicIcon /></span>
              <span className="vti-icon-layer" ref={checkIconRef} style={{ opacity: 0 }}><CheckIcon /></span>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .vti-root {
          position: relative;
          width: 100%;
        }
        /* Behind the bar (lower z) so outside taps register but the bar stays usable. */
        .vti-overlay {
          position: fixed;
          inset: 0;
          z-index: 1;
          background: transparent;
        }
        .vti-bar {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 8px 8px 18px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 14px;
          transition: border-color 0.22s ease;
          overflow: hidden; /* clips the pill to the bar's rounded shape */
        }
        .vti-bar[data-mode="text"] { border-color: rgba(255, 204, 0, 0.5); }

        .vti-placeholder {
          position: absolute;
          left: 18px;
          top: 50%;
          transform: translateY(-50%);
          color: #6b5a50;
          font-size: 15px;
          pointer-events: none;
          transition: opacity 0.22s ease;
        }
        .vti-input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          outline: none;
          color: #f5f0ec;
          font-size: 15px;
          font-family: inherit;
        }
        .vti-action {
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: none;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          color: #a09080;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease;
        }
        .vti-action:hover { background: rgba(255, 204, 0, 0.14); color: #FFCC00; }

        /* ---- voice pill ---- */
        .vti-pill {
          position: absolute;
          top: 0;
          right: 0;
          height: 100%;
          width: 0;
          overflow: hidden;
          align-self: flex-end;
          background: #241f1b;
          border-radius: 14px;
          z-index: 3;
          display: flex;
          align-items: center;
        }
        .vti-pill-content {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          height: 100%;
          padding: 0 56px 0 8px; /* right pad clears the anchored mic/check */
          white-space: nowrap;
        }
        .vti-pill-cancel,
        .vti-pill-confirm {
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: none;
          border-radius: 10px;
          background: transparent;
          cursor: pointer;
        }
        .vti-pill-cancel { color: #a09080; }
        .vti-pill-cancel:hover { color: #f5f0ec; }

        .vti-listening {
          color: #f5f0ec;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.2px;
        }

        /* mic/check anchored to the right edge of the pill */
        .vti-mic-wrap {
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
        }
        .vti-pill-confirm {
          position: relative;
          color: #FFCC00;
        }
        .vti-icon-layer {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
        }

        /* ---- wave dots ---- */
        .vti-dots {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .vti-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #FFCC00;
          opacity: 0.2;
          animation: vtiWave 0.7s ease-in-out infinite;
        }
        .vti-dots span:nth-child(2) { animation-delay: 0.2s; }
        .vti-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes vtiWave {
          0%, 100% { opacity: 0.2; transform: translateY(0); }
          50%      { opacity: 1;   transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}

/* ---- icons ---- */
function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
