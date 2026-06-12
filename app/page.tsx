"use client";
import { useState, useRef } from "react";
import gsap from "gsap";
import { BackgroundCanvas } from "@/components/BackgroundCanvas";
import { OnboardingScreen } from "@/components/OnboardingScreen";
import { ChatScreen } from "@/components/ChatScreen";
import type { UserProfile, RecipientProfile, ApiMessage } from "@/lib/types";

const DEFAULT_PROFILE: UserProfile = { name: "", age: null, gender: "" };
const DEFAULT_RECIPIENT: RecipientProfile = { age: null, gender: "", relationship: "" };

export default function Home() {
  const [phase, setPhase] = useState<"onboarding" | "chat">("onboarding");
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [obMessages, setObMessages] = useState<ApiMessage[]>([]);
  const obRef = useRef<HTMLDivElement>(null);

  function handleOnboardingComplete(profile: UserProfile, messages: ApiMessage[]) {
    setUserProfile(profile);
    setObMessages(messages);

    // Fade out onboarding, then switch
    if (obRef.current) {
      gsap.to(obRef.current, {
        opacity: 0,
        duration: 0.5,
        ease: "power2.in",
        onComplete: () => setPhase("chat"),
      });
    } else {
      setPhase("chat");
    }
  }

  return (
    <>
      <BackgroundCanvas />
      {phase === "onboarding" && (
        <div ref={obRef}>
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        </div>
      )}
      {phase === "chat" && (
        <ChatScreen
          userProfile={userProfile}
          recipientProfile={DEFAULT_RECIPIENT}
          obMessages={obMessages}
        />
      )}
    </>
  );
}
