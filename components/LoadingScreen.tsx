"use client";
import { useEffect, useRef, useCallback, type CSSProperties } from "react";

interface Props {
  /** Called once the intro video finishes (or immediately on a repeat visit). */
  onDone: () => void;
}

const SESSION_FLAG = "kaprukaLoaded";
// Intro source = the cinematic, transcoded from kapruka.mov (HEVC) to H.264 mp4
// for cross-browser muted autoplay. Lives under public/brand/animations/.
const VIDEO_SRC = "/brand/animations/Generate_a_second_cinematic.mp4";

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "#412973", // brand purple — fills letterboxing + covers first-frame load
    zIndex: 9999,
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover", // fill the viewport, crop overflow — no black bars
    display: "block",
  },
};

export function LoadingScreen({ onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);

  // Repeat visit in the same session → skip the intro entirely.
  const skip =
    typeof window !== "undefined" && sessionStorage.getItem(SESSION_FLAG) === "1";

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (typeof window !== "undefined") sessionStorage.setItem(SESSION_FLAG, "1");
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (skip) {
      finish();
      return;
    }
    // Safety net: if autoplay is blocked or 'ended' never fires, advance anyway
    // (video is ~7.2s; allow headroom for load/decode).
    const safety = setTimeout(finish, 9500);
    const v = videoRef.current;
    if (v) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(finish); // autoplay rejected → skip
    }
    return () => clearTimeout(safety);
  }, [skip, finish]);

  if (skip) return null; // avoid a one-frame flash of the video on repeat visits

  return (
    <div style={styles.overlay} aria-hidden="true">
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
        style={styles.video}
      />
    </div>
  );
}
