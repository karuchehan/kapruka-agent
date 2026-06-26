"use client";

interface Props {
  state: "idle" | "thinking";
  /** Wrapper height in px; images fill it (height 100%, width auto). */
  size?: number;
}

// Two mascot frames stacked absolutely; we cross-fade opacity between them and
// add a subtle scale settle so the "thinking" frame feels like it leans in.
// Images are sized to the wrapper height so Machan fits the header exactly —
// the PNG is chest-up, so filling the height makes him look like he's standing
// inside the bar.
export function MachanAvatar({ state, size = 80 }: Props) {
  const thinking = state === "thinking";
  const imgStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: "100%",
    width: "auto",
    objectFit: "contain",
    transition: "opacity 500ms ease-in-out, transform 500ms ease-in-out",
    transformOrigin: "bottom center",
  };
  return (
    <div
      className="machan-avatar"
      style={{ position: "relative", height: size, width: size }}
      aria-hidden="true"
    >
      <img
        src="/brand/logos/machan_idle.png"
        alt=""
        style={{ ...imgStyle, opacity: thinking ? 0 : 1, transform: thinking ? "scale(0.97)" : "scale(1)" }}
      />
      <img
        src="/brand/logos/machan_thinking.png"
        alt=""
        style={{ ...imgStyle, opacity: thinking ? 1 : 0, transform: thinking ? "scale(0.97)" : "scale(1)" }}
      />
    </div>
  );
}
