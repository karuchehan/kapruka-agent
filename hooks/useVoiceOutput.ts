"use client";
import { useState, useCallback } from "react";

export function useVoiceOutput() {
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("voiceEnabled") === "true";
  });
  // Id of the chat item currently being spoken aloud — drives the talking-mouth
  // animation on that one agent message. null when nothing is speaking.
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const speak = useCallback(
    (text: string, id?: string) => {
      if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      const clean = text
        .replace(/\[PRODUCTS\][\s\S]*?\[\/PRODUCTS\]/g, "")
        .replace(/[*_`#>]/g, "")
        .slice(0, 400);
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "en-US";
      u.rate = 1.05;
      u.pitch = 1;
      const key = id ?? "__speaking__";
      u.onstart = () => setSpeakingId(key);
      u.onend = () => setSpeakingId((cur) => (cur === key ? null : cur));
      u.onerror = () => setSpeakingId((cur) => (cur === key ? null : cur));
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
        setSpeakingId(null);
      }
      return next;
    });
  }, []);

  return { voiceEnabled, speak, toggleVoice, speakingId };
}
