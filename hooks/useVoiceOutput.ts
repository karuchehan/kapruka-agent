"use client";
import { useState, useCallback } from "react";

export function useVoiceOutput() {
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("voiceEnabled") === "true";
  });

  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/\[PRODUCTS\][\s\S]*?\[\/PRODUCTS\]/g, "")
        .replace(/[*_`#>]/g, "")
        .slice(0, 400);
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "en-US";
      u.rate = 1.05;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    },
    [voiceEnabled]
  );

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("voiceEnabled", String(next));
      if (!next && typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
      return next;
    });
  }, []);

  return { voiceEnabled, speak, toggleVoice };
}
