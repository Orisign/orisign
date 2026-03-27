import type { ConversationResponseDto } from "@/api/generated";

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

export function decodeConversationLocator(value: string | null | undefined) {
  const trimmedValue = value?.trim() ?? "";
  if (!trimmedValue) {
    return "";
  }

  try {
    return decodeURIComponent(trimmedValue);
  } catch {
    return trimmedValue;
  }
}

export function normalizeConversationUsername(username: string | null | undefined) {
  return decodeConversationLocator(username).replace(/^@+/, "");
}

export function isUsernameConversationLocator(locator: string | null | undefined) {
  return decodeConversationLocator(locator).startsWith("@");
}

export function buildConversationPath(input: {
  conversationId?: string | null;
  username?: string | null;
}) {
  const username = normalizeConversationUsername(input.username);
  if (username) {
    return `/@${username}`;
  }

  const conversationId = decodeConversationLocator(input.conversationId);
  return conversationId ? `/${conversationId}` : "/";
}

export function buildConversationPathFromConversation(
  conversation: ConversationResponseDto | null | undefined,
) {
  return buildConversationPath({
    conversationId: conversation?.id,
    username: conversation?.username,
  });
}

export function buildPublicConversationLink(username: string | null | undefined) {
  const normalizedUsername = normalizeConversationUsername(username);
  if (!normalizedUsername) {
    return "";
  }

  const baseUrl = trimTrailingSlashes(
    (process.env.NEXT_PUBLIC_APP_URL ?? "").trim(),
  );

  if (!baseUrl) {
    return normalizedUsername;
  }

  return `${baseUrl}/${normalizedUsername}`;
}
