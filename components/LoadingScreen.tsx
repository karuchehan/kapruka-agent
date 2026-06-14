"use client";
import { useEffect, useRef, useCallback, type CSSProperties } from "react";
import gsap from "gsap";
import * as THREE from "three";

interface Props {
  /** Called once the intro finishes (or immediately on a repeat visit). */
  onDone: () => void;
}

const SESSION_FLAG = "kaprukaLoaded";
const SKIN = "#5B3A29";          // dark skin tone for the hand
const BALLOON = 0xffcc00;        // brand yellow foil

// Group scales: big foil balloon during the intro, then shrunk to letter size
// so it reads as the "u" inside the kapruka wordmark.
const BIG = 0.85;
const LETTER = 0.40;

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "#412973", // brand purple
    zIndex: 9999,
    overflow: "hidden",
  },
  canvas: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    zIndex: 10,
    display: "block",
  },
  // DOM wordmark layer sits above the canvas. The two text halves flank a gap
  // where the 3D U renders (screen centre).
  textWrap: {
    position: "absolute",
    inset: 0,
    zIndex: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    transform: "translateY(2px)", // nudge baseline to the U's optical centre
  },
  word: {
    fontFamily: "var(--font-rounded), system-ui, sans-serif",
    fontWeight: 800,
    fontSize: "clamp(40px, 9vw, 92px)",
    color: "#ffffff",
    letterSpacing: "-0.02em",
    lineHeight: 1,
    opacity: 0,
    willChange: "transform, opacity",
  },
  // Gap that the 3D U occupies between "kapr" and "ka".
  uGap: { width: "clamp(38px, 6.6vw, 70px)", flexShrink: 0 },
  hand: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 110,
    height: 150,
    zIndex: 12,
    willChange: "transform", // centering handled by GSAP x/yPercent (CSS transform would be overwritten)
  },
};

export function LoadingScreen({ onDone }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hand = useRef<SVGSVGElement>(null);
  const leftWord = useRef<HTMLSpanElement>(null);
  const rightWord = useRef<HTMLSpanElement>(null);
  const doneRef = useRef(false);

  const skip =
    typeof window !== "undefined" && sessionStorage.getItem(SESSION_FLAG) === "1";

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (typeof window !== "undefined") sessionStorage.setItem(SESSION_FLAG, "1");
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (skip) {
      finish();
      return;
    }
    const canvas = canvasRef.current;
    const overlay = root.current;
    if (!canvas || !overlay) return;

    // Use real frame deltas (no lag clamping) so the one-shot intro plays at a
    // steady rate even across a stutter; restored on cleanup.
    gsap.ticker.lagSmoothing(0);

    // ── THREE.JS SCENE ───────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 7);

    // Lights — ambient base + key directional + a point light for the foil hot-spot.
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const hot = new THREE.PointLight(0xffffff, 1.2, 50);
    hot.position.set(2.5, 3, 4);
    scene.add(hot);

    // Inflated letter-U: a fat tube swept along a U-shaped CatmullRom curve,
    // with sphere caps on the two open tips so it reads as a foil balloon.
    const pts = [
      [-1.0, 1.3], [-1.0, 0.2], [-1.0, -0.5],
      [-0.72, -1.05], [0, -1.26], [0.72, -1.05],
      [1.0, -0.5], [1.0, 0.2], [1.0, 1.3],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    const R = 0.42;
    const foil = new THREE.MeshStandardMaterial({
      color: BALLOON,
      metalness: 0.35,
      roughness: 0.22,
      emissive: 0x3a2a00,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 1,
    });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, R, 24, false), foil);
    const capGeo = new THREE.SphereGeometry(R, 24, 24);
    const capL = new THREE.Mesh(capGeo, foil);
    capL.position.set(-1.0, 1.3, 0);
    const capR = new THREE.Mesh(capGeo, foil);
    capR.position.set(1.0, 1.3, 0);

    // Thin white string hanging from the U's bottom centre, pivoting at its top.
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const stringGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.5, 8);
    const stringMesh = new THREE.Mesh(stringGeo, stringMat);
    stringMesh.position.y = -0.75; // hang below the pivot
    const stringPivot = new THREE.Group();
    stringPivot.position.set(0, -1.3, 0);
    stringPivot.add(stringMesh);

    const balloon = new THREE.Group();
    balloon.add(tube, capL, capR, stringPivot);
    balloon.position.set(3, 1.6, 0);
    balloon.scale.setScalar(0.001);
    scene.add(balloon);

    // Render loop (GSAP mutates transforms on its own ticker; we just draw).
    let raf = 0;
    const renderLoop = () => {
      renderer.render(scene, camera);
      raf = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    };
    window.addEventListener("resize", onResize);

    // ── GSAP TIMELINE ────────────────────────────────────────────────────
    const ctx = gsap.context(() => {
      const H = window.innerHeight;

      // Idle motions — killed when the pull starts.
      const bob = gsap.to(balloon.position, {
        y: "+=0.14", duration: 1.3, ease: "sine.inOut", yoyo: true, repeat: -1,
      });
      const sway = gsap.to(stringPivot.rotation, {
        z: 0.14, duration: 1.5, ease: "sine.inOut", yoyo: true, repeat: -1,
      });

      const tl = gsap.timeline({ onComplete: finish });

      // STEP 1 (0–1.5) — balloon pops in top-right.
      tl.to(balloon.scale, { x: BIG, y: BIG, z: BIG, duration: 1.0, ease: "back.out(1.7)" }, 0);

      // STEP 2 (1.5–2.5) — hand rises from below up to just under screen centre
      // (where the U's string hangs). Centred via x/yPercent around top:50%/left:50%.
      gsap.set(hand.current, { xPercent: -50, yPercent: -50, y: H * 0.78 });
      tl.to(hand.current, { y: H * 0.12, duration: 1.1, ease: "power2.out" }, 1.5);

      // STEP 3 (2.5–4) — kill idle, pull the balloon in an arc to centre; hand
      // guides it then exits downward; settle with a small bounce.
      tl.add(() => { bob.kill(); sway.kill(); }, 2.5);
      tl.to(balloon.position, { x: 0, duration: 1.5, ease: "power2.inOut" }, 2.5); // x eases slow
      tl.to(balloon.position, { y: 0, duration: 1.5, ease: "power2.in" }, 2.5);    // y eases late → arc
      tl.to(stringPivot.rotation, { z: 0, duration: 0.5, ease: "power2.out" }, 2.5);
      tl.to(hand.current, { y: H * 0.06, duration: 1.2, ease: "sine.inOut" }, 2.7); // guide up to centre
      tl.to(hand.current, { y: H * 0.85, duration: 0.7, ease: "power2.in" }, 4.0);   // hand exits down
      tl.to(balloon.scale, { x: BIG * 1.06, y: BIG * 1.06, z: BIG * 1.06, duration: 0.16, ease: "power1.out" }, 3.9)
        .to(balloon.scale, { x: BIG, y: BIG, z: BIG, duration: 0.16, ease: "power1.in" }, 4.06);

      // STEP 4 (4–5.5) — wordmark forms: "kapr" from left, "ka" from right; the
      // balloon shrinks to letter size + string fades so it reads as the "u".
      tl.fromTo(leftWord.current, { x: -160, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, 4.3);
      tl.fromTo(rightWord.current, { x: 160, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, 4.3);
      tl.to(balloon.scale, { x: LETTER, y: LETTER, z: LETTER, duration: 0.9, ease: "power2.inOut" }, 4.3);
      tl.to(stringMat, { opacity: 0, duration: 0.5, ease: "power1.out" }, 4.3);

      // STEP 5 (5.5–6.5) — whole logo scales up slightly then the overlay fades.
      const logoUp = gsap.timeline();
      logoUp
        .to([leftWord.current, rightWord.current], { scale: 1.12, duration: 0.9, ease: "power2.in", transformOrigin: "center center" }, 0)
        .to(balloon.scale, { x: LETTER * 1.12, y: LETTER * 1.12, z: LETTER * 1.12, duration: 0.9, ease: "power2.in" }, 0)
        .to(overlay, { opacity: 0, duration: 0.6, ease: "power2.in" }, 0.3);
      tl.add(logoUp, 5.6);
    }, root);

    // Safety net: timeline completes ~6.5s; if anything stalls, still advance.
    const safety = setTimeout(finish, 8000);

    return () => {
      clearTimeout(safety);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      gsap.ticker.lagSmoothing(500, 33); // restore default
      ctx.revert();
      tube.geometry.dispose();
      capGeo.dispose();
      stringGeo.dispose();
      foil.dispose();
      stringMat.dispose();
      renderer.dispose();
    };
  }, [skip, finish]);

  if (skip) return null;

  return (
    <div ref={root} style={styles.overlay} aria-hidden="true">
      <canvas ref={canvasRef} style={styles.canvas} />

      <div style={styles.textWrap}>
        <span ref={leftWord} style={styles.word}>kapr</span>
        <span style={styles.uGap} />
        <span ref={rightWord} style={styles.word}>ka</span>
      </div>

      <HandSvg innerRef={hand} />
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
      <rect x="38" y="92" width="34" height="58" rx="16" fill={SKIN} />
      <path d="M30 86c0-10 6-18 25-18s25 8 25 18v10c0 14-11 24-25 24S30 110 30 96z" fill={SKIN} />
      <rect x="33" y="40" width="11" height="52" rx="5.5" fill={SKIN} />
      <rect x="46" y="30" width="11" height="62" rx="5.5" fill={SKIN} />
      <rect x="59" y="34" width="11" height="58" rx="5.5" fill={SKIN} />
      <rect x="72" y="46" width="11" height="46" rx="5.5" fill={SKIN} />
      <rect x="20" y="66" width="11" height="34" rx="5.5" transform="rotate(-28 25 83)" fill={SKIN} />
    </svg>
  );
}
