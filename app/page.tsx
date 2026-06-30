"use client";
import { ChatScreen } from "@/components/ChatScreen";
import type { UserProfile, RecipientProfile, ApiMessage } from "@/lib/types";

// No pre-chat onboarding gate. The user lands directly in the chat. We seed a
// single hardcoded assistant greeting as the conversation's first turn: it is
// shown instantly as the welcome bubble (no API call needed on load) AND seeded
// into apiMessages so the agent knows it has already greeted and won't repeat it.
// The greeting leads with a Sri Lankan personality beat and invites
// self-shopping — no gift framing, no demographic questions up front. Name, age,
// and gender are gathered conversationally later (see directives/system_prompt.md).
const DEFAULT_PROFILE: UserProfile = { name: "", age: null, gender: "" };
const DEFAULT_RECIPIENT: RecipientProfile = { age: null, gender: "", relationship: "" };

const GREETING = "Ayubowan! What are we shopping for today?";

export default function Home() {
  const obMessages: ApiMessage[] = [{ role: "assistant", content: GREETING }];

  return (
    <ChatScreen
      userProfile={DEFAULT_PROFILE}
      recipientProfile={DEFAULT_RECIPIENT}
      obMessages={obMessages}
      initialQuery=""
    />
  );
}
