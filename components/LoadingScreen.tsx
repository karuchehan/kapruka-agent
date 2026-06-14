"use client";
import { useRef, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface Props {
  /** Called once the intro finishes (or immediately on a repeat visit). */
  onDone: () => void;
}

const BG = "#2D2E8F";
const SKIN = "#5B3A29"; // dark skin tone for the hand
const SESSION_FLAG = "kaprukaLoaded";

// All motion is GSAP — these style objects only set static layout. Both the
// smile and the full logo are raster PNGs wrapped in SVG, so they are animated
// as <img> elements (transform/opacity), not as vector paths.
const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: BG,
    zIndex: 9999,
    overflow: "hidden",
    display: "block",
  },
  // Smile group is anchored to screen centre; GSAP offsets it to the top-right
  // at start, then animates the offset to 0 so it lands at the exact centre.
  smileGroup: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 120,
    willChange: "transform",
  },
  smileSway: { position: "relative", transformOrigin: "50% 0%" },
  smileImg: { display: "block", width: "100%", height: "auto" },
  // Thin white string hanging from the smile's bottom centre.
  string: {
    position: "absolute",
    top: "100%",
    left: "50%",
    width: 2,
    height: 64,
    background: "#ffffff",
    transformOrigin: "50% 0%",
    marginLeft: -1,
  },
  hand: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 110,
    willChange: "transform",
  },
  logo: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 300,
    maxWidth: "70vw",
    willChange: "transform, opacity",
  },
};

export function LoadingScreen({ onDone }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const smileGroup = useRef<HTMLDivElement>(null);
  const smileSway = useRef<HTMLDivElement>(null);
  const string = useRef<HTMLDivElement>(null);
  const hand = useRef<SVGSVGElement>(null);
  const logo = useRef<HTMLImageElement>(null);

  useGSAP(() => {
    // Repeat visit in the same session → skip the intro entirely.
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_FLAG)) {
      onDone();
      return;
    }

    const W = typeof window !== "undefined" ? window.innerWidth : 1280;
    const H = typeof window !== "undefined" ? window.innerHeight : 800;

    const sg = smileGroup.current!;
    const sw = smileSway.current!;
    const st = string.current!;
    const hd = hand.current!;
    const lg = logo.current!;

    // Start positions — smile small in the top-right, hand below the screen,
    // logo hidden at centre.
    gsap.set(sg, { xPercent: -50, yPercent: -50, x: W * 0.33, y: -H * 0.32, scale: 0.55 });
    gsap.set(hd, { xPercent: -50, yPercent: -50, x: 0, y: H * 0.7 });
    gsap.set(lg, { xPercent: -50, yPercent: -50, opacity: 0, scale: 0.9 });
    gsap.set(st, { opacity: 1, scaleY: 1 });

    // (1) Idle sway — gentle, low amplitude, slow, infinite. Runs on the inner
    // element so it does not fight the arc tween on the group.
    const sway = gsap.to(sw, {
      rotation: 2.2,
      y: 3,
      duration: 2,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      transformOrigin: "50% 0%",
    });

    const tl = gsap.timeline({
      onComplete: () => {
        if (typeof window !== "undefined") sessionStorage.setItem(SESSION_FLAG, "1");
        onDone();
      },
    });

    // (2) After 1.2s idle, the hand rises from below toward screen centre.
    tl.to(hd, { y: H * 0.06, duration: 0.8, ease: "power2.out" }, 1.2);

    // (3) Hand reaches the string → smile arcs from top-right to centre while
    // the hand guides it down. The arc is faked by giving x and y different
    // eases so the path curves. Kill the sway so the smile settles upright.
    tl.add(() => {
      sway.kill();
      gsap.to(sw, { rotation: 0, y: 0, duration: 0.3, ease: "power2.out" });
      gsap.to(st, { opacity: 0, duration: 0.4, ease: "power1.out" }); // hand takes over from the string
    }, "arc");
    tl.to(sg, { x: 0, scale: 1, duration: 1.0, ease: "power2.inOut" }, "arc");
    tl.to(sg, { y: 0, duration: 1.0, ease: "power2.in" }, "arc");
    tl.to(hd, { y: H * 0.16, duration: 1.0, ease: "power2.inOut" }, "arc");

    // (4) Smile settles at centre with a tiny bounce; hand exits downward.
    tl.to(sw, { scale: 1.05, duration: 0.15, ease: "power1.out" })
      .to(sw, { scale: 1, duration: 0.15, ease: "power1.in" });
    tl.to(hd, { y: H * 0.85, duration: 0.5, ease: "power2.in" }, "<");

    // (5) Full logo fades in around the smile. The logo PNG has the smile baked
    // in, so we crossfade: the standalone smile fades out as the logo fades in,
    // and the logo's own smile takes over in place — looks like one mark.
    tl.to(lg, { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" }, ">-0.05")
      .to(sg, { opacity: 0, duration: 0.5, ease: "power2.out" }, "<");

    // (6) Hold, then the whole logo fades out.
    tl.to(lg, { opacity: 0, duration: 0.4, ease: "power2.in" }, ">0.8");
    // (7) onComplete → caller advances to onboarding.
  }, { scope: root });

  return (
    <div ref={root} style={styles.overlay} aria-hidden="true">
      <div ref={smileGroup} style={styles.smileGroup}>
        <div ref={smileSway} style={styles.smileSway}>
          <img src="/kapruka-smile.svg" alt="" style={styles.smileImg} />
          <div ref={string} style={styles.string} />
        </div>
      </div>

      {/* Hand — inline SVG, dark skin tone, minimal, reaching upward. */}
      <HandSvg innerRef={hand} />

      <img ref={logo} src="/kapruka-logo.svg" alt="Kapruka" style={styles.logo} />
    </div>
  );
}

// Minimal upward-reaching hand. Open palm, fingers together, thumb to the side.
function HandSvg({ innerRef }: { innerRef: React.RefObject<SVGSVGElement | null> }) {
  return (
    <svg
      ref={innerRef}
      style={styles.hand}
      viewBox="0 0 110 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* wrist / forearm */}
      <rect x="38" y="92" width="34" height="58" rx="16" fill={SKIN} />
      {/* palm */}
      <path
        d="M30 86c0-10 6-18 25-18s25 8 25 18v10c0 14-11 24-25 24S30 110 30 96z"
        fill={SKIN}
      />
      {/* four fingers reaching up */}
      <rect x="33" y="40" width="11" height="52" rx="5.5" fill={SKIN} />
      <rect x="46" y="30" width="11" height="62" rx="5.5" fill={SKIN} />
      <rect x="59" y="34" width="11" height="58" rx="5.5" fill={SKIN} />
      <rect x="72" y="46" width="11" height="46" rx="5.5" fill={SKIN} />
      {/* thumb */}
      <rect x="20" y="66" width="11" height="34" rx="5.5" transform="rotate(-28 25 83)" fill={SKIN} />
    </svg>
  );
}
