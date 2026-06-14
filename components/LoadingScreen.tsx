"use client";
import { useEffect, useRef, useCallback, type CSSProperties } from "react";
import gsap from "gsap";
import * as THREE from "three";

interface Props {
  /** Called once the intro finishes (or immediately on a repeat visit). */
  onDone: () => void;
}

const SESSION_FLAG = "kaprukaLoaded";
const BALLOON = 0xffcc00; // brand yellow

// Group scales: a bigger floating balloon during the intro, then shrunk to the
// size the "u" occupies inside the wordmark.
const BIG = 1.0;
const LETTER = 0.66;
// Final vertical offset (world units) of the cup's tips. The cup hangs below
// this by R*LETTER, so tips ≈ the letter-top, bottom ≈ the text baseline —
// the cup spans nearly the full letter height like the real logo.
const BASE_Y = 0.46;

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
  textWrap: {
    position: "absolute",
    inset: 0,
    zIndex: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  word: {
    fontFamily: "var(--font-wordmark), var(--font-rounded), system-ui, sans-serif",
    fontWeight: 700, // Fredoka — heaviest weight available
    fontSize: "clamp(42px, 9.5vw, 98px)",
    color: "#ffffff",
    letterSpacing: "-0.03em",
    lineHeight: 1,
    opacity: 0,
    willChange: "transform, opacity",
  },
  // Gap the "u" cup occupies between "kapr" and "ka".
  uGap: { width: "clamp(42px, 8.4vw, 90px)", flexShrink: 0 },
};

export function LoadingScreen({ onDone }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

    gsap.ticker.lagSmoothing(0); // steady one-shot intro; restored on cleanup

    // ── THREE.JS SCENE ───────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 7);

    // Brighter ambient + softer key → flatter, closer to the logo's flat yellow
    // while keeping a subtle foil highlight.
    scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(-3, 4, 5);
    scene.add(keyLight);
    const hot = new THREE.PointLight(0xffffff, 0.6, 50);
    hot.position.set(2.5, 3, 4);
    scene.add(hot);

    // The Kapruka "u" — a shallow, wide cup: the BOTTOM half of a torus (a half
    // ring). arc=π gives the top half (∩); rotating π about Z flips it to the
    // cup (∪) with the two tube tips pointing up. Wide (2R) and low (R deep).
    const R = 1.0;        // ring radius → cup half-width
    const TUBE = 0.2;     // tube thickness
    const foil = new THREE.MeshStandardMaterial({
      color: BALLOON,
      metalness: 0.3,
      roughness: 0.25,
      emissive: 0x3a2a00,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 1,
    });
    const torus = new THREE.TorusGeometry(R, TUBE, 20, 96, Math.PI);
    const cup = new THREE.Mesh(torus, foil);
    cup.rotation.z = Math.PI; // ∩ → ∪ (tips up)

    // Thin white string for the balloon feel, hanging from the cup's centre.
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const stringGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.4, 8);
    const stringMesh = new THREE.Mesh(stringGeo, stringMat);
    stringMesh.position.y = -0.7;
    const stringPivot = new THREE.Group();
    stringPivot.position.set(0, -R, 0); // bottom of the cup
    stringPivot.add(stringMesh);

    const balloon = new THREE.Group();
    balloon.add(cup, stringPivot);
    balloon.position.set(3, 1.7, 0);
    balloon.scale.setScalar(0.001);
    scene.add(balloon);

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

    // ── GSAP TIMELINE (no hand) ──────────────────────────────────────────
    const ctx = gsap.context(() => {
      // Idle motions — killed when the move starts.
      const bob = gsap.to(balloon.position, {
        y: "+=0.16", duration: 1.3, ease: "sine.inOut", yoyo: true, repeat: -1,
      });
      const sway = gsap.to(stringPivot.rotation, {
        z: 0.16, duration: 1.5, ease: "sine.inOut", yoyo: true, repeat: -1,
      });

      const tl = gsap.timeline({ onComplete: finish });

      // STEP 1 (0–1) — cup balloon pops in top-right, gentle bob.
      tl.to(balloon.scale, { x: BIG, y: BIG, z: BIG, duration: 0.8, ease: "back.out(1.6)" }, 0);

      // STEP 2 (1–2.5) — smooth curved move from top-right to centre.
      tl.add(() => { bob.kill(); sway.kill(); }, 1.0);
      tl.to(balloon.position, { x: 0, y: 0, duration: 1.5, ease: "power2.inOut" }, 1.0);
      tl.to(stringPivot.rotation, { z: 0, duration: 0.6, ease: "power2.out" }, 1.0);

      // STEP 3 (2.5–3.2) — settle bounce, then shrink to letter size + drop to
      // the baseline; string fades as it becomes the wordmark's "u".
      tl.to(balloon.scale, { x: BIG * 1.06, y: BIG * 1.06, z: BIG * 1.06, duration: 0.16, ease: "power1.out" }, 2.5)
        .to(balloon.scale, { x: BIG, y: BIG, z: BIG, duration: 0.16, ease: "power1.in" }, 2.66);
      tl.to(balloon.scale, { x: LETTER, y: LETTER, z: LETTER, duration: 0.7, ease: "power2.inOut" }, 2.85);
      tl.to(balloon.position, { y: BASE_Y, duration: 0.7, ease: "power2.inOut" }, 2.85);
      tl.to(stringMat, { opacity: 0, duration: 0.45, ease: "power1.out" }, 2.85);

      // STEP 4 (3.1–3.9) — "kapr" from left, "ka" from right meet the cup.
      tl.fromTo(leftWord.current, { x: -170, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, 3.1);
      tl.fromTo(rightWord.current, { x: 170, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, 3.1);

      // STEP 5 (3.9–5.4) — hold the assembled wordmark ~1.5s.
      // STEP 6 (5.4–6.1) — fade the whole overlay out → onboarding.
      tl.to(overlay, { opacity: 0, duration: 0.7, ease: "power2.in" }, 5.4);
    }, root);

    // Safety net: timeline completes ~6.1s; if anything stalls, still advance.
    const safety = setTimeout(finish, 8000);

    return () => {
      clearTimeout(safety);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      gsap.ticker.lagSmoothing(500, 33); // restore default
      ctx.revert();
      torus.dispose();
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
    </div>
  );
}
