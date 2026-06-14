"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { DeliveryInfo } from "@/lib/types";

interface Props {
  delivery: DeliveryInfo;
}

export function DeliveryStatusCard({ delivery }: Props) {
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

  return (
    <div ref={ref} className="delivery-card" role="status">
      <span className="delivery-pin" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </span>
      <span className="delivery-city">{delivery.city}</span>
      <span className="delivery-arrow" aria-hidden="true">→</span>
      {delivery.available ? (
        <span className="delivery-status ok">
          <span className="delivery-tick" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="delivery-eta">{delivery.etaLabel}</span>
        </span>
      ) : (
        <span className="delivery-status no">
          <span className="delivery-cross" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </span>
          <span className="delivery-eta">No delivery to this area</span>
        </span>
      )}
    </div>
  );
}
