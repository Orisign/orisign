"use client";

import {
  ConversationMemberResponseDtoRole,
  ConversationMemberResponseDtoState,
  ConversationResponseDtoType,
  type ConversationResponseDto,
  type ListMyConversationsResponseDto,
  type SendMessageRequestDtoKind,
  type UserResponseDto,
} from "@/api/generated";
import type { ChatMessageDto } from "@/hooks/use-chat";
import { buildApiUrl } from "@/lib/app-config";
import { buildConversationPath, normalizeConversationUsername } from "@/lib/chat-routes";
import { customFetch } from "@/lib/fetcher";

export interface SendDirectMessageInput {
  targetUserId: string;
  kind: SendMessageRequestDtoKind;
  text?: string;
  replyToId?: string;
  mediaKeys?: string[];
  entitiesJson?: string;
  replyMarkupJson?: string;
  attachmentsJson?: string;
  sourceBotId?: string;
  metadataJson?: string;
  locale?: string;
}

export interface SendDirectMessageResponse {
  ok?: boolean;
  conversation?: ConversationResponseDto | null;
  message?: Partial<ChatMessageDto> | null;
}

function isActiveMember(member: { state?: string; userId?: string } | null | undefined) {
  return Boolean(
    member?.userId &&
      (!member.state || member.state === ConversationMemberResponseDtoState.ACTIVE),
  );
}

export function buildUserDirectPath(user: Pick<UserResponseDto, "id" | "username"> | null | undefined) {
  const username = normalizeConversationUsername(user?.username);
  if (username) {
    return `/@${username}`;
  }

  return user?.id ? `/${user.id}` : "/";
}

export function buildDirectConversationPath(
  conversation: ConversationResponseDto | null | undefined,
  peerUser: Pick<UserResponseDto, "id" | "username"> | null | undefined,
) {
  const peerUsername = normalizeConversationUsername(peerUser?.username);
  if (peerUsername) {
    return `/@${peerUsername}`;
  }

  return buildConversationPath({ conversationId: conversation?.id });
}

export function findDirectConversationWithUser(
  conversations: ConversationResponseDto[] | null | undefined,
  targetUserId: string | null | undefined,
  currentUserId?: string | null,
) {
  const normalizedTargetUserId = targetUserId?.trim() ?? "";
  const normalizedCurrentUserId = currentUserId?.trim() ?? "";

  if (!normalizedTargetUserId) {
    return null;
  }

  return (
    (conversations ?? []).find((conversation) => {
      if (conversation.type !== ConversationResponseDtoType.DM) {
        return false;
      }

      const activeMembers = (conversation.members ?? []).filter(isActiveMember);
      const hasTarget = activeMembers.some(
        (member) => member.userId === normalizedTargetUserId,
      );
      const hasCurrent =
        !normalizedCurrentUserId ||
        activeMembers.some((member) => member.userId === normalizedCurrentUserId);

      return hasTarget && hasCurrent;
    }) ?? null
  );
}

export function createVirtualDirectConversation(params: {
  currentUser: Pick<UserResponseDto, "id">;
  peerUser: Pick<UserResponseDto, "id">;
}): ConversationResponseDto {
  const now = Date.now();

  return {
    id: "",
    type: ConversationResponseDtoType.DM,
    title: "",
    about: "",
    ownerId: params.currentUser.id,
    isPublic: false,
    username: "",
    avatarKey: "",
    notificationsEnabled: true,
    discussionConversationId: "",
    discussionChannelId: "",
    members: [params.currentUser.id, params.peerUser.id]
      .filter(Boolean)
      .map((userId) => ({
        userId,
        role: ConversationMemberResponseDtoRole.MEMBER,
        state: ConversationMemberResponseDtoState.ACTIVE,
        joinedAt: now,
      })),
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertConversationInListData(
  data: ListMyConversationsResponseDto | undefined,
  conversation: ConversationResponseDto | null | undefined,
  updatedAt = Date.now(),
) {
  if (!data || !conversation?.id) {
    return data;
  }

  const nextConversation = {
    ...conversation,
    updatedAt: Math.max(conversation.updatedAt ?? 0, updatedAt),
  };
  const conversations = (data.conversations ?? []).filter(
    (entry) => entry.id !== nextConversation.id,
  );

  return {
    ...data,
    conversations: [nextConversation, ...conversations],
  };
}

export async function sendDirectMessage(
  input: SendDirectMessageInput,
): Promise<SendDirectMessageResponse> {
  return customFetch<SendDirectMessageResponse>(buildApiUrl("/messages/send-direct"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}
