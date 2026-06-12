"use client";
import { useEffect, useRef } from "react";

export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W: number, H: number, frame = 0;
    const GRID = 48;
    type Dot = { x: number; y: number; phase: number };
    let dots: Dot[] = [];
    let rafId: number;

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
      dots = [];
      for (let x = 0; x < W + GRID; x += GRID) {
        for (let y = 0; y < H + GRID; y += GRID) {
          dots.push({ x, y, phase: Math.random() * Math.PI * 2 });
        }
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      frame++;
      const t = frame * 0.012;
      for (const d of dots) {
        const wave = Math.sin(d.x * 0.012 + t) * Math.cos(d.y * 0.012 + t + d.phase);
        const alpha = (wave + 1) * 0.5 * 0.55;
        const r = 1.5 + wave * 0.8;
        ctx!.beginPath();
        ctx!.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(230,51,41,${alpha})`;
        ctx!.fill();
      }
      rafId = requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    resize();
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas id="bg-canvas" ref={canvasRef} />;
}
