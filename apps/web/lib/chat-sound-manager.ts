"use client";

export type ChatSoundType = "send" | "receive" | "read";

const CHAT_SOUND_POOL_SIZE = 4;
const CHAT_SOUND_FALLBACK_VOLUME = 0.65;
const CHAT_SOUND_MIN_INTERVAL_MS: Record<ChatSoundType, number> = {
  send: 60,
  receive: 90,
  read: 140,
};

const CHAT_SOUND_SRC: Record<ChatSoundType, string> = {
  send: "/assets/audio/message_sent.mp3",
  receive: "/assets/audio/message_sent.mp3",
  read: "/assets/audio/message_sent.mp3",
};

const chatSoundPools = new Map<ChatSoundType, HTMLAudioElement[]>();
const chatSoundPoolIndexes = new Map<ChatSoundType, number>();
const chatSoundLastPlayedAt = new Map<ChatSoundType, number>();

let isChatSoundManagerInitialized = false;
let isChatSoundMuted = false;
let chatSoundVolume = CHAT_SOUND_FALLBACK_VOLUME;
let isChatSoundWarmupBound = false;
let isChatSoundWarmupDone = false;

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return CHAT_SOUND_FALLBACK_VOLUME;
  return Math.min(1, Math.max(0, value));
}

function createSoundPool(src: string) {
  return Array.from({ length: CHAT_SOUND_POOL_SIZE }, () => {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    audio.load();
    return audio;
  });
}

function runChatSoundWarmup() {
  if (typeof window === "undefined" || isChatSoundWarmupDone) return;

  const warmupAudio = chatSoundPools.get("send")?.[0] ?? new Audio(CHAT_SOUND_SRC.send);
  warmupAudio.preload = "auto";
  warmupAudio.setAttribute("playsinline", "true");
  warmupAudio.muted = true;
  warmupAudio.volume = 0;

  void warmupAudio
    .play()
    .then(() => {
      warmupAudio.pause();
      warmupAudio.currentTime = 0;
      warmupAudio.muted = false;
      warmupAudio.volume = chatSoundVolume;
      isChatSoundWarmupDone = true;
    })
    .catch(() => undefined);
}

function unbindWarmupListeners() {
  if (typeof window === "undefined") return;
  window.removeEventListener("pointerdown", handleChatSoundWarmupInteraction, true);
  window.removeEventListener("keydown", handleChatSoundWarmupInteraction, true);
  window.removeEventListener("touchstart", handleChatSoundWarmupInteraction, true);
  isChatSoundWarmupBound = false;
}

function handleChatSoundWarmupInteraction() {
  runChatSoundWarmup();
  unbindWarmupListeners();
}

export function initChatSoundManager() {
  if (isChatSoundManagerInitialized || typeof window === "undefined") {
    return;
  }

  (Object.keys(CHAT_SOUND_SRC) as ChatSoundType[]).forEach((type) => {
    chatSoundPools.set(type, createSoundPool(CHAT_SOUND_SRC[type]));
    chatSoundPoolIndexes.set(type, 0);
    chatSoundLastPlayedAt.set(type, 0);
  });

  isChatSoundManagerInitialized = true;
}

export function primeChatSoundManager() {
  if (typeof window === "undefined") return;

  initChatSoundManager();

  if (isChatSoundWarmupDone || isChatSoundWarmupBound) {
    return;
  }

  window.addEventListener("pointerdown", handleChatSoundWarmupInteraction, true);
  window.addEventListener("keydown", handleChatSoundWarmupInteraction, true);
  window.addEventListener("touchstart", handleChatSoundWarmupInteraction, true);
  isChatSoundWarmupBound = true;
}

export function setChatSoundMuted(nextValue: boolean) {
  isChatSoundMuted = Boolean(nextValue);
}

export function setChatSoundVolume(nextValue: number) {
  chatSoundVolume = clampVolume(nextValue);
}

export function getChatSoundSettings() {
  return {
    muted: isChatSoundMuted,
    volume: chatSoundVolume,
  };
}

export function playChatSound(type: ChatSoundType) {
  if (typeof window === "undefined") return;

  initChatSoundManager();
  if (!isChatSoundWarmupDone) {
    runChatSoundWarmup();
  }

  if (isChatSoundMuted || chatSoundVolume <= 0) {
    return;
  }

  const now = Date.now();
  const lastPlayedAt = chatSoundLastPlayedAt.get(type) ?? 0;
  const minInterval = CHAT_SOUND_MIN_INTERVAL_MS[type];

  if (now - lastPlayedAt < minInterval) {
    return;
  }

  chatSoundLastPlayedAt.set(type, now);

  const pool = chatSoundPools.get(type);
  if (!pool || pool.length === 0) {
    return;
  }

  const nextIndex = (chatSoundPoolIndexes.get(type) ?? 0) % pool.length;
  chatSoundPoolIndexes.set(type, nextIndex + 1);

  const audio = pool[nextIndex];
  audio.pause();
  audio.currentTime = 0;
  audio.volume = chatSoundVolume;

  void audio.play().catch(() => {
    const fallback = new Audio(CHAT_SOUND_SRC[type]);
    fallback.preload = "auto";
    fallback.setAttribute("playsinline", "true");
    fallback.volume = chatSoundVolume;
    void fallback.play().catch(() => undefined);
  });
}
