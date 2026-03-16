const CALL_SECURITY_EMOJIS = [
  "🔒",
  "🛡️",
  "🔑",
  "🧩",
  "🌙",
  "⭐",
  "☀️",
  "🌊",
  "🔥",
  "🍀",
  "🍎",
  "🍋",
  "🍇",
  "🥨",
  "🎯",
  "🎲",
  "🎹",
  "🎧",
  "🚀",
  "🛰️",
  "🐳",
  "🦊",
  "🐼",
  "🦉",
  "🐬",
  "🦄",
  "🌈",
  "❄️",
  "⚡",
  "💎",
  "🧿",
  "🧠",
] as const;

function fnv1aHash(value: string) {
  let hash = 0x811c9dc5;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function seededNext(state: number) {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

export function getCallSecurityEmojiFingerprint(params: {
  securityMaterial: string;
  length?: number;
}) {
  const { securityMaterial, length = 4 } = params;
  const normalizedMaterial = securityMaterial.trim();
  if (!normalizedMaterial) {
    return [];
  }

  const seed = `${normalizedMaterial}:webrtc-sec-v2`;
  let state = fnv1aHash(seed);
  const items: string[] = [];

  for (let index = 0; index < length; index += 1) {
    state = seededNext(state ^ ((index + 1) * 2654435761));
    items.push(CALL_SECURITY_EMOJIS[state % CALL_SECURITY_EMOJIS.length]);
  }

  return items;
}
