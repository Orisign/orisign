"use client";

import type { ExcludedChatType, IncludedChatType } from "@/lib/chat-folders";
import { create } from "zustand";

interface ChatFolderDraft {
  name: string;
  includedChatIds: string[];
  excludedChatIds: string[];
  includedTypes: IncludedChatType[];
  excludedTypes: ExcludedChatType[];
  inviteLink?: string;
}

interface ChatFolderDraftStore {
  draft: ChatFolderDraft | null;
  initDraft: (name?: string) => void;
  setName: (name: string) => void;
  patchDraft: (patch: Partial<ChatFolderDraft>) => void;
  clearDraft: () => void;
}

function createEmptyDraft(name = ""): ChatFolderDraft {
  return {
    name,
    includedChatIds: [],
    excludedChatIds: [],
    includedTypes: [],
    excludedTypes: [],
    inviteLink: undefined,
  };
}

export const useChatFolderDraftStore = create<ChatFolderDraftStore>((set) => ({
  draft: null,
  initDraft: (name) =>
    set((state) => ({
      draft: state.draft ?? createEmptyDraft(name),
    })),
  setName: (name) =>
    set((state) => ({
      draft: state.draft ? { ...state.draft, name } : createEmptyDraft(name),
    })),
  patchDraft: (patch) =>
    set((state) => {
      const draft = state.draft ?? createEmptyDraft();
      return { draft: { ...draft, ...patch } };
    }),
  clearDraft: () => set({ draft: null }),
}));
