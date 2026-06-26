"use client";

interface Props {
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
}

export function Header({ voiceEnabled, onVoiceToggle }: Props) {
  return (
    <header id="chat-header">
      <div className="header-brand">
        <img
          className="header-logo"
          src="/brand/logos/kapruka-main-cropped.svg"
          alt="Kapruka"
        />
      </div>
      <div className="header-actions">
        <button id="voice-toggle" aria-label="Toggle voice" onClick={onVoiceToggle}>
          {voiceEnabled ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
          <span id="voice-pulse" />
        </button>
      </div>
    </header>
  );
}
