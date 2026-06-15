"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ProductStage } from "./ProductStage";
import type { Product } from "@/lib/types";

interface Props {
  products: Product[];
  isLoading: boolean;
  onAddToCart: (product: Product) => void;
  addedIds: Set<string>;
}

type SheetState = "PEEK" | "OPEN";

const PEEK_PX = 72; // height of the handle bar visible when collapsed
const OPEN_VH = 0.85;
const VELOCITY_THRESH = 0.5; // px/ms — a fast flick wins over the distance rule

/**
 * Mobile-only draggable bottom sheet wrapping the SAME ProductStage. Collapsed,
 * a 72px handle bar peeks at the bottom; dragged/tapped open, it covers 85vh
 * with the product grid scrolling inside. Auto-opens when a new product batch
 * arrives. Desktop never mounts this — ChatScreen renders ProductStage directly.
 */
export function ProductSheet({ products, isLoading, onAddToCart, addedIds }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<SheetState>("PEEK");

  // Geometry — recomputed on pointerdown + resize so rotation stays correct.
  const geom = useRef({ height: 0, peekTranslate: 0 });
  const measure = useCallback(() => {
    const h = window.innerHeight * OPEN_VH;
    geom.current = { height: h, peekTranslate: Math.max(h - PEEK_PX, 0) };
    return geom.current;
  }, []);

  // Drag bookkeeping (refs — no re-render per move).
  const drag = useRef({ active: false, startY: 0, startT: 0, lastY: 0, lastT: 0, vY: 0 });

  const animateTo = useCallback((next: SheetState) => {
    const sheet = sheetRef.current;
    const scrim = scrimRef.current;
    if (!sheet) return;
    const { peekTranslate } = geom.current.height ? geom.current : measure();
    const y = next === "OPEN" ? 0 : peekTranslate;
    gsap.to(sheet, { y, duration: 0.42, ease: "power3.out" });
    if (scrim) {
      if (next === "OPEN") scrim.style.pointerEvents = "auto";
      gsap.to(scrim, {
        opacity: next === "OPEN" ? 1 : 0,
        duration: 0.3,
        onComplete: () => { if (next === "PEEK") scrim.style.pointerEvents = "none"; },
      });
    }
  }, [measure]);

  // Initial placement at PEEK with no entrance animation.
  useGSAP(() => {
    const { peekTranslate } = measure();
    if (sheetRef.current) gsap.set(sheetRef.current, { y: peekTranslate });
    if (scrimRef.current) gsap.set(scrimRef.current, { opacity: 0 });
  }, []);

  // Animate + reflect open-state to a root class so CSS can hide the cart dock.
  useGSAP(() => {
    animateTo(state);
    const root = document.documentElement;
    if (state === "OPEN") root.classList.add("sheet-open");
    else root.classList.remove("sheet-open");
    return () => { document.documentElement.classList.remove("sheet-open"); };
  }, { dependencies: [state] });

  // Recompute geometry on resize/orientation; re-snap to current state.
  useEffect(() => {
    const onResize = () => { measure(); animateTo(state); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [state, measure, animateTo]);

  // The sheet only mounts once products exist (gated in ChatScreen) and reveals
  // itself at PEEK — the handle appears automatically, but it never auto-OPENS to
  // full screen. The user taps/drags the handle to expand. This avoids a
  // confusing empty full-screen sheet on first arrival.

  // ── Drag (handle only) ──────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent) {
    const { peekTranslate } = measure();
    void peekTranslate;
    gsap.killTweensOf(sheetRef.current);
    const curY = Number(gsap.getProperty(sheetRef.current, "y")) || 0;
    drag.current = { active: true, startY: e.clientY, startT: curY, lastY: e.clientY, lastT: performance.now(), vY: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    const { peekTranslate } = geom.current;
    const dy = e.clientY - d.startY;
    const next = Math.min(Math.max(d.startT + dy, 0), peekTranslate);
    gsap.set(sheetRef.current, { y: next });
    if (scrimRef.current) {
      scrimRef.current.style.pointerEvents = "auto";
      gsap.set(scrimRef.current, { opacity: peekTranslate ? 1 - next / peekTranslate : 0 });
    }
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) d.vY = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = now;
  }

  function onPointerUp() {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    const { peekTranslate } = geom.current;
    const curY = Number(gsap.getProperty(sheetRef.current, "y")) || 0;
    let target: SheetState;
    if (d.vY > VELOCITY_THRESH) target = "PEEK";
    else if (d.vY < -VELOCITY_THRESH) target = "OPEN";
    else target = curY < peekTranslate * 0.5 ? "OPEN" : "PEEK";
    setState(target);     // sync state + root class via effect
    animateTo(target);    // guarantee snap even if state is unchanged
  }

  const count = products.length;

  return (
    <>
      <div ref={scrimRef} className="product-sheet-scrim" onClick={() => setState("PEEK")} />
      <section className="product-sheet" ref={sheetRef} aria-label="Product results">
        <div
          className="product-sheet-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={() => setState((s) => (s === "PEEK" ? "OPEN" : "PEEK"))}
          role="button"
          aria-label={state === "PEEK" ? "Open products" : "Close products"}
        >
          <span className="product-sheet-grabber" aria-hidden="true" />
          <span className="product-sheet-label">
            🛍 {count > 0 ? `${count} pick${count === 1 ? "" : "s"}` : "Products"}
          </span>
          <span className={`product-sheet-chevron${state === "OPEN" ? " open" : ""}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </span>
        </div>
        <div className="product-sheet-body">
          <ProductStage products={products} isLoading={isLoading} onAddToCart={onAddToCart} addedIds={addedIds} />
        </div>
      </section>
    </>
  );
}
