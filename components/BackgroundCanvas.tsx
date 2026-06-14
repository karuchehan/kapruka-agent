"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Subtle drifting purple particle field. Raw three.js (no R3F) rendered into
 * the existing #bg-canvas (CSS keeps it fixed, behind everything, at low
 * opacity). ~2500 points slowly drift + the whole field parallaxes a touch with
 * the pointer. Honours prefers-reduced-motion (renders one static frame).
 */
const COUNT = 2500;

// Purple-family palette + an occasional gold sparkle to echo the brand accent.
const PALETTE = [
  new THREE.Color("#412973"), // deep brand purple
  new THREE.Color("#6B4FA0"),
  new THREE.Color("#8B6FC8"),
  new THREE.Color("#A98FE0"),
  new THREE.Color("#FFCC00"), // gold — rare, see weighting below
];

/** Soft round sprite so points glow instead of reading as hard squares. */
function makeSprite(): THREE.Texture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 60;

    // Point cloud — random positions in a wide, shallow box; per-point colour
    // weighted toward purple, gold only ~6% of the time.
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const drift = new Float32Array(COUNT); // per-point phase for the drift wave
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 160;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      drift[i] = Math.random() * Math.PI * 2;
      const gold = Math.random() < 0.06;
      const col = gold ? PALETTE[4] : PALETTE[Math.floor(Math.random() * 4)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const sprite = makeSprite();
    const material = new THREE.PointsMaterial({
      size: 1.4,
      map: sprite,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geom, material);
    scene.add(points);

    // Pointer parallax — eased toward the target each frame.
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    function onPointer(e: PointerEvent) {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    }

    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }

    let rafId = 0;
    const clock = new THREE.Clock();
    const basePos = positions.slice(); // immutable copy for the drift offset

    function frame() {
      const t = clock.getElapsedTime();
      // Gentle vertical drift per point.
      const arr = geom.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < COUNT; i++) {
        arr.array[i * 3 + 1] = basePos[i * 3 + 1] + Math.sin(t * 0.3 + drift[i]) * 2.2;
      }
      arr.needsUpdate = true;

      points.rotation.y = t * 0.02;

      // Ease camera toward pointer for a subtle parallax.
      current.x += (target.x - current.x) * 0.04;
      current.y += (target.y - current.y) * 0.04;
      camera.position.x = current.x * 6;
      camera.position.y = -current.y * 4;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    if (!reduceMotion) {
      window.addEventListener("pointermove", onPointer);
      frame();
    } else {
      renderer.render(scene, camera); // single static frame
    }

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(rafId);
      geom.dispose();
      material.dispose();
      sprite.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas id="bg-canvas" ref={canvasRef} />;
}
