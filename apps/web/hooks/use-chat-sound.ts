"use client";

import {
  initChatSoundManager,
  primeChatSoundManager,
  setChatSoundMuted,
  setChatSoundVolume,
} from "@/lib/chat-sound-manager";
import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const CHAT_SOUND_DEFAULT_VOLUME = 0.65;

interface ChatSoundStoreState {
  muted: boolean;
  volume: number;
  setMuted: (nextValue: boolean) => void;
  toggleMuted: () => void;
  setVolume: (nextValue: number) => void;
}

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return CHAT_SOUND_DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, value));
}

const useChatSoundStore = create<ChatSoundStoreState>()(
  persist(
    (set) => ({
      muted: false,
      volume: CHAT_SOUND_DEFAULT_VOLUME,
      setMuted: (nextValue) => set({ muted: Boolean(nextValue) }),
      toggleMuted: () => set((state) => ({ muted: !state.muted })),
      setVolume: (nextValue) => set({ volume: clampVolume(nextValue) }),
    }),
    {
      name: "chat-sound",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        muted: state.muted,
        volume: state.volume,
      }),
    },
  ),
);

export function useChatSound() {
  const muted = useChatSoundStore((state) => state.muted);
  const volume = useChatSoundStore((state) => state.volume);
  const setMuted = useChatSoundStore((state) => state.setMuted);
  const toggleMuted = useChatSoundStore((state) => state.toggleMuted);
  const setVolume = useChatSoundStore((state) => state.setVolume);

  useEffect(() => {
    initChatSoundManager();
    primeChatSoundManager();
  }, []);

  useEffect(() => {
    setChatSoundMuted(muted);
  }, [muted]);

  useEffect(() => {
    setChatSoundVolume(volume);
  }, [volume]);

  return {
    muted,
    volume,
    setMuted,
    toggleMuted,
    setVolume,
  };
}
