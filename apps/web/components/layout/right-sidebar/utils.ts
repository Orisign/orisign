"use client";

import {
  type ConversationMemberResponseDtoRole,
  type GetConversationResponseDto,
  type PrivacySettingsResponseDtoBirthDate,
  ConversationMemberResponseDtoRole as ConversationMemberRole,
  PrivacySettingsResponseDtoBirthDate as BirthDatePrivacyType,
} from "@/api/generated";
import {
  CHAT_CONVERSATION_TYPE,
  CHAT_MEDIA_KIND,
  normalizeTimestamp,
  resolveChatMediaKind,
  resolveStorageFileUrl,
} from "@/lib/chat";
import { buildPublicConversationLink } from "@/lib/chat-routes";
import { extractMessageUrls } from "@/lib/chat-message-format";
import type {
  MonthGroup,
  SharedLinkAsset,
  SharedMediaAsset,
} from "./types";

export function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

export function formatDuration(secondsValue: number) {
  const safe =
    Number.isFinite(secondsValue) && secondsValue > 0
      ? Math.floor(secondsValue)
      : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function buildWaveform(seed: string, bars = 36) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return Array.from({ length: bars }, (_, index) => {
    const value = Math.abs(Math.sin((hash + index * 37) * 0.00018));
    return Math.round(22 + value * 78);
  });
}

export function resolveMediaEntries(
  items: Array<{
    messageId: string;
    authorId: string;
    text: string;
    createdAt: number;
    mediaKeys: string[];
  }>,
): SharedMediaAsset[] {
  const all = items.flatMap((item) =>
    item.mediaKeys
      .filter(Boolean)
      .map((mediaKey, index) => ({
        id: `${item.messageId}:${index}:${mediaKey}`,
        messageId: item.messageId,
        mediaKey,
        url: resolveStorageFileUrl(mediaKey),
        kind: resolveChatMediaKind(mediaKey),
        createdAt: item.createdAt,
        authorId: item.authorId,
        text: item.text,
      })),
  );

  return all
    .filter((entry) => Boolean(entry.url))
    .sort((left, right) => right.createdAt - left.createdAt);
}

export function resolveLinkEntries(
  items: Array<{
    messageId: string;
    authorId: string;
    text: string;
    createdAt: number;
  }>,
): SharedLinkAsset[] {
  const links = items.flatMap((item) =>
    extractMessageUrls(item.text, 5).map((url) => ({
      id: `${item.messageId}:${url}`,
      messageId: item.messageId,
      url,
      createdAt: item.createdAt,
      authorId: item.authorId,
    })),
  );

  return uniqueById(links).sort((left, right) => right.createdAt - left.createdAt);
}

export function buildMonthGroups<T>(
  items: T[],
  getTimestamp: (item: T) => number,
  locale: string,
): MonthGroup<T>[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  });
  const groups = new Map<string, MonthGroup<T>>();

  items.forEach((item) => {
    const normalized = normalizeTimestamp(getTimestamp(item));
    const date = normalized ? new Date(normalized) : null;
    const key = date ? `${date.getFullYear()}-${date.getMonth()}` : "undated";
    const label = date ? formatter.format(date) : "";
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(item);
      return;
    }

    groups.set(key, {
      key,
      label,
      items: [item],
    });
  });

  return [...groups.values()];
}

export function isChannelConversation(
  conversation: GetConversationResponseDto["conversation"] | null | undefined,
) {
  return conversation?.type === CHAT_CONVERSATION_TYPE.CHANNEL;
}

export function isGroupConversation(
  conversation: GetConversationResponseDto["conversation"] | null | undefined,
) {
  return conversation?.type === CHAT_CONVERSATION_TYPE.GROUP;
}

export function isBirthDateVisible(
  birthDatePrivacy: PrivacySettingsResponseDtoBirthDate | undefined,
) {
  return (
    birthDatePrivacy === BirthDatePrivacyType.ALL ||
    birthDatePrivacy === BirthDatePrivacyType.CONTACTS
  );
}

export function getMemberRoleRank(role: ConversationMemberResponseDtoRole | undefined) {
  switch (role) {
    case ConversationMemberRole.OWNER:
      return 1;
    case ConversationMemberRole.ADMIN:
      return 2;
    case ConversationMemberRole.MODERATOR:
      return 3;
    case ConversationMemberRole.MEMBER:
      return 4;
    case ConversationMemberRole.SUBSCRIBER:
      return 5;
    default:
      return 99;
  }
}

export function normalizePublicLink(username: string | null | undefined) {
  return buildPublicConversationLink(username);
}

export const RIGHT_SIDEBAR_TRANSITION = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1] as const,
};

export const RIGHT_SIDEBAR_TAB_CONTENT_CLASS =
  "px-3 pb-5 pt-3";

export const SIDEBAR_FALLBACK_AVATAR_CLASS =
  "bg-linear-to-br from-primary to-accent text-primary-foreground";

export const VIDEO_PREVIEW_CONTROL_BUTTON_CLASS =
  "inline-flex size-11 items-center justify-center border-0 bg-transparent p-0 text-primary outline-none ring-0 transition-colors duration-150 hover:text-primary/80 active:text-primary/70 focus-visible:text-primary [&_svg]:size-7";

export const RIGHT_SIDEBAR_SCREEN_ORDER = [
  "info",
  "manage-overview",
  "manage-channel-type",
  "manage-invite-links",
  "manage-invite-link-create",
  "manage-invite-link-detail",
  "manage-reactions",
  "manage-admin-messages",
  "manage-discussion",
  "manage-discussion-create",
  "manage-admins",
  "manage-members",
  "add-members",
] as const;

export const RIGHT_SIDEBAR_TAB_ORDER = [
  "media",
  "files",
  "links",
  "voice",
] as const;

export const CHAT_MEDIA_PREVIEWABLE_KINDS = new Set([
  CHAT_MEDIA_KIND.IMAGE,
  CHAT_MEDIA_KIND.VIDEO,
  CHAT_MEDIA_KIND.RING,
]);
