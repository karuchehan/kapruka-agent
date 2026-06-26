"use client";
import { useRef, useState, useCallback } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MachanAvatar } from "./MachanAvatar";

interface Props {
  onSend: (text: string) => void;
  isSending: boolean;
}

export function InputArea({ onSend, isSending }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useMediaQuery("(max-width: 720px)");

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function handleSend() {
    const text = value.trim();
    if (!text || isSending) return;
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    onSend(text);
  }

  const handleVoiceResult = useCallback((text: string) => {
    setValue(text);
    requestAnimationFrame(autoResize);
  }, []);

  const handleAutoSubmit = useCallback(() => {
    if (textareaRef.current?.value.trim()) {
      handleSend();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { isListening, toggle: toggleMic } = useVoiceInput({
    onResult: handleVoiceResult,
    onAutoSubmit: handleAutoSubmit,
  });

  return (
    <div id="input-area">
      {/* Machan stands flush on top of the input bar, anchored over the mic +
          send buttons on the right. pointer-events:none so he never blocks them. */}
      <div className="machan-floating" aria-hidden="true">
        <MachanAvatar state={isSending ? "thinking" : "idle"} size={isMobile ? 56 : 80} />
      </div>
      <div className="input-inner">
        <textarea
          ref={textareaRef}
          id="chat-input"
          rows={1}
          placeholder="What are you looking for today?"
          aria-label="Message input"
          autoComplete="off"
          value={value}
          onChange={(e) => { setValue(e.target.value); autoResize(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          id="mic-btn"
          aria-label="Voice input"
          className={isListening ? "listening" : ""}
          onClick={toggleMic}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
        </button>
        <button
          id="send-btn"
          aria-label="Send message"
          disabled={isSending || !value.trim()}
          onClick={handleSend}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
