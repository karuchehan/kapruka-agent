"use client";

interface Props {
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
  cartCount: number;
  onCartOpen: () => void;
}

export function Header({ voiceEnabled, onVoiceToggle, cartCount, onCartOpen }: Props) {
  return (
    <header id="chat-header">
      <div className="header-brand">
        <div className="brand-dot small" />
        <span className="brand-name small">kapruka</span>
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
        <button id="cart-icon-btn" aria-label="Open cart" onClick={onCartOpen}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          {cartCount > 0 && <span id="cart-count">{cartCount}</span>}
        </button>
      </div>
    </header>
  );
}
