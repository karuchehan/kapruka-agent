"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { TrackingInfo } from "@/lib/types";

interface Props {
  tracking: TrackingInfo;
}

// Canonical 4-step journey shown as a horizontal stepper. `stage` (0–3, or -1
// for cancelled) comes pre-computed from the server.
const STEPS = ["Received", "Preparing", "On the way", "Delivered"];

export function TrackingCard({ tracking }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
      );
    }
  }, []);

  // Graceful "no such order" state — no timeline, just a clear not-found note.
  if (!tracking.found) {
    return (
      <div ref={ref} className="tracking-card tracking-card--notfound" role="status">
        <div className="tracking-head">
          <span className="tracking-icon tracking-icon--warn" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <div className="tracking-headtext">
            <span className="tracking-title">No order found</span>
            <span className="tracking-order">{tracking.orderNumber}</span>
          </div>
        </div>
      </div>
    );
  }

  const cancelled = tracking.stage < 0;
  const current = cancelled ? -1 : tracking.stage;

  return (
    <div ref={ref} className="tracking-card" role="status">
      <div className="tracking-head">
        <span
          className={`tracking-icon ${cancelled ? "tracking-icon--warn" : "tracking-icon--ok"}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 3h1.6a1 1 0 0 1 .9.55L21 8v8a1 1 0 0 1-1 1h-1" />
            <path d="M3 6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v11H4a1 1 0 0 1-1-1z" />
            <circle cx="7.5" cy="18.5" r="1.6" />
            <circle cx="17.5" cy="18.5" r="1.6" />
          </svg>
        </span>
        <div className="tracking-headtext">
          <span className="tracking-order">Order {tracking.orderNumber}</span>
          <span className={`tracking-badge ${cancelled ? "is-cancelled" : current >= 3 ? "is-delivered" : "is-active"}`}>
            {tracking.statusDisplay}
          </span>
        </div>
      </div>

      {!cancelled && (
        <div className="tracking-stepper" aria-hidden="true">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`tracking-step ${i < current ? "done" : i === current ? "active" : ""}`}
            >
              <span className="tracking-dot">
                {i < current ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : null}
              </span>
              <span className="tracking-step-label">{label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="tracking-facts">
        {tracking.recipientCity && (
          <span className="tracking-fact">
            <span className="tracking-fact-k">To</span>
            <span className="tracking-fact-v">{tracking.recipientCity}</span>
          </span>
        )}
        {tracking.deliveryDate && (
          <span className="tracking-fact">
            <span className="tracking-fact-k">Delivery</span>
            <span className="tracking-fact-v">{tracking.deliveryDate}</span>
          </span>
        )}
        {tracking.amount && (
          <span className="tracking-fact">
            <span className="tracking-fact-k">Total</span>
            <span className="tracking-fact-v">{tracking.amount}</span>
          </span>
        )}
      </div>

      {tracking.latestStep && (
        <p className="tracking-latest">{tracking.latestStep}</p>
      )}
    </div>
  );
}
