"use client";
import { useRef, useState, useCallback } from "react";

interface SR {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
interface SRResult { isFinal: boolean; 0: { transcript: string } }
interface SREvent { resultIndex: number; results: SRResult[] & { length: number } }

interface VoiceInputOptions {
  onResult: (text: string) => void;
  onAutoSubmit: () => void;
}

export function useVoiceInput({ onResult, onAutoSubmit }: VoiceInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SR | null>(null);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SRCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SRCtor) return;

    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    finalTranscriptRef.current = "";
    onResult("");

    const recognition: SR = new SRCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (e: SREvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscriptRef.current += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      onResult(finalTranscriptRef.current || interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscriptRef.current.trim()) {
        autoSubmitTimerRef.current = setTimeout(onAutoSubmit, 1200);
      }
    };

    recognition.onerror = () => setIsListening(false);

    try { recognition.start(); } catch {}
  }, [onResult, onAutoSubmit]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  return { isListening, toggle };
}
