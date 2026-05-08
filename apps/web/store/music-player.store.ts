import { create } from "zustand";

export type MusicRepeatMode = "off" | "all" | "one";

export interface MusicTrack {
  key: string;
  url: string;
  title: string;
  artist: string;
  size?: number;
  duration?: number;
  conversationId: string;
  messageId: string;
}

interface MusicPlayerState {
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  library: MusicTrack[];
  isPlaying: boolean;
  repeatMode: MusicRepeatMode;
  volume: number;
  currentTime: number;
  duration: number;
  playTrack: (track: MusicTrack, queue?: MusicTrack[]) => void;
  registerTracks: (tracks: MusicTrack[]) => void;
  unregisterTracks: (keys: string[]) => void;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  close: () => void;
  previous: () => void;
  next: (wrap?: boolean) => void;
  cycleRepeatMode: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlayingState: (isPlaying: boolean) => void;
  setPlaybackPosition: (currentTime: number, duration?: number) => void;
}

const repeatModeOrder: MusicRepeatMode[] = ["off", "all", "one"];
const MUSIC_PLAYER_STORAGE_KEY = "orisign:music-player";

type PersistedMusicPlayerState = Pick<
  MusicPlayerState,
  "currentTrack" | "queue" | "library" | "repeatMode" | "volume"
>;

const defaultPersistedState: PersistedMusicPlayerState = {
  currentTrack: null,
  queue: [],
  library: [],
  repeatMode: "off",
  volume: 1,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isRepeatMode(value: unknown): value is MusicRepeatMode {
  return repeatModeOrder.includes(value as MusicRepeatMode);
}

function clampVolume(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultPersistedState.volume;
  }

  return Math.min(1, Math.max(0, value));
}

function isMusicTrack(value: unknown): value is MusicTrack {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.key === "string" &&
    typeof value.url === "string" &&
    typeof value.title === "string" &&
    typeof value.artist === "string" &&
    typeof value.conversationId === "string" &&
    typeof value.messageId === "string" &&
    (typeof value.size === "undefined" || typeof value.size === "number") &&
    (typeof value.duration === "undefined" || typeof value.duration === "number")
  );
}

function normalizeTracks(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isMusicTrack);
}

function mergeTracks(tracks: MusicTrack[]) {
  const byKey = new Map<string, MusicTrack>();

  tracks.forEach((track) => {
    byKey.set(track.key, track);
  });

  return Array.from(byKey.values());
}

function loadPersistedMusicPlayerState(): PersistedMusicPlayerState {
  if (typeof window === "undefined") {
    return defaultPersistedState;
  }

  try {
    const rawState = window.localStorage.getItem(MUSIC_PLAYER_STORAGE_KEY);
    if (!rawState) {
      return defaultPersistedState;
    }

    const parsed = JSON.parse(rawState) as unknown;
    if (!isRecord(parsed)) {
      return defaultPersistedState;
    }

    const currentTrack = isMusicTrack(parsed.currentTrack)
      ? parsed.currentTrack
      : null;
    const queue = normalizeTracks(parsed.queue);
    const library = mergeTracks([
      ...normalizeTracks(parsed.library),
      ...queue,
      ...(currentTrack ? [currentTrack] : []),
    ]);

    return {
      currentTrack,
      queue: queue.length ? queue : (currentTrack ? [currentTrack] : []),
      library,
      repeatMode: isRepeatMode(parsed.repeatMode)
        ? parsed.repeatMode
        : defaultPersistedState.repeatMode,
      volume: clampVolume(parsed.volume),
    };
  } catch {
    return defaultPersistedState;
  }
}

function persistMusicPlayerState(state: PersistedMusicPlayerState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      MUSIC_PLAYER_STORAGE_KEY,
      JSON.stringify({
        currentTrack: state.currentTrack,
        queue: state.queue,
        library: state.library,
        repeatMode: state.repeatMode,
        volume: state.volume,
      }),
    );
  } catch {
    // Ignore storage failures so playback controls keep working.
  }
}

function findTrackIndex(queue: MusicTrack[], track: MusicTrack | null) {
  if (!track) return -1;
  return queue.findIndex((item) => item.key === track.key);
}

function selectTrackByOffset(
  currentTrack: MusicTrack | null,
  queue: MusicTrack[],
  offset: 1 | -1,
  wrap: boolean,
) {
  if (queue.length === 0) return currentTrack;

  const currentIndex = findTrackIndex(queue, currentTrack);
  if (currentIndex < 0) {
    return queue[0] ?? currentTrack;
  }

  const nextIndex = currentIndex + offset;
  if (nextIndex >= 0 && nextIndex < queue.length) {
    return queue[nextIndex] ?? currentTrack;
  }

  if (!wrap) {
    return currentTrack;
  }

  return offset > 0 ? (queue[0] ?? currentTrack) : (queue.at(-1) ?? currentTrack);
}

export const musicPlayerStore = create<MusicPlayerState>()((set, get) => {
  const persistedState = loadPersistedMusicPlayerState();
  const persistCurrentState = () => persistMusicPlayerState(get());

  return {
    currentTrack: persistedState.currentTrack,
    queue: persistedState.queue,
    library: persistedState.library,
    isPlaying: false,
    repeatMode: persistedState.repeatMode,
    volume: persistedState.volume,
    currentTime: 0,
    duration: 0,
    playTrack: (track, queue) => {
      set((state) => {
        const nextQueue = queue?.length
          ? queue
          : (state.library.length ? state.library : [track]);

        return {
          currentTrack: track,
          queue: nextQueue.some((item) => item.key === track.key)
            ? nextQueue
            : [track, ...nextQueue],
          library: mergeTracks([...state.library, track, ...nextQueue]),
          isPlaying: true,
          currentTime: 0,
          duration: 0,
        };
      });
      persistCurrentState();
    },
    registerTracks: (tracks) => {
      if (tracks.length === 0) {
        return;
      }

      set((state) => ({
        library: mergeTracks([...state.library, ...tracks]),
      }));
    },
    unregisterTracks: (keys) => {
      if (keys.length === 0) {
        return;
      }

      set((state) => {
        const keySet = new Set(keys);
        const library = state.library.filter((track) => !keySet.has(track.key));

        return {
          library,
        };
      });
    },
    pause: () =>
      set(() => ({
        isPlaying: false,
      })),
    resume: () =>
      set((state) => ({
        isPlaying: Boolean(state.currentTrack),
      })),
    toggle: () =>
      set((state) => ({
        isPlaying: state.currentTrack ? !state.isPlaying : false,
      })),
    close: () => {
      set(() => ({
        currentTrack: null,
        queue: [],
        isPlaying: false,
        currentTime: 0,
        duration: 0,
      }));
      persistCurrentState();
    },
    previous: () => {
      set((state) => {
        const previousTrack = selectTrackByOffset(state.currentTrack, state.queue, -1, true);

        return {
          currentTrack: previousTrack,
          isPlaying: Boolean(previousTrack),
          currentTime: 0,
          duration: previousTrack?.key === state.currentTrack?.key ? state.duration : 0,
        };
      });
      persistCurrentState();
    },
    next: (wrap = true) => {
      set((state) => {
        const nextTrack = selectTrackByOffset(state.currentTrack, state.queue, 1, wrap);
        const isSameTrack = Boolean(
          state.currentTrack?.key && nextTrack?.key === state.currentTrack.key,
        );

        return {
          currentTrack: nextTrack,
          isPlaying: Boolean(nextTrack) && !(isSameTrack && !wrap),
          currentTime: 0,
          duration: nextTrack?.key === state.currentTrack?.key ? state.duration : 0,
        };
      });
      persistCurrentState();
    },
    cycleRepeatMode: () => {
      set((state) => {
        const currentIndex = repeatModeOrder.indexOf(state.repeatMode);
        return {
          repeatMode: repeatModeOrder[(currentIndex + 1) % repeatModeOrder.length] ?? "off",
        };
      });
      persistCurrentState();
    },
    setVolume: (volume) => {
      set(() => ({
        volume: clampVolume(volume),
      }));
      persistCurrentState();
    },
    toggleMute: () => {
      set((state) => ({
        volume: state.volume > 0 ? 0 : 1,
      }));
      persistCurrentState();
    },
    setPlayingState: (isPlaying) =>
      set((state) => ({
        isPlaying: state.currentTrack ? isPlaying : false,
      })),
    setPlaybackPosition: (currentTime, duration) =>
      set((state) => ({
        currentTime: state.currentTrack ? currentTime : 0,
        duration: typeof duration === "number" ? duration : state.duration,
      })),
  };
});
