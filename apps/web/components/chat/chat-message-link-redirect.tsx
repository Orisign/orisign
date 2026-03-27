"use client";

import { CHAT_FOCUS_STORAGE_KEY_PREFIX } from "@/lib/chat.constants";
import { buildConversationPathFromConversation } from "@/lib/chat-routes";
import { useConversationQuery } from "@/hooks/use-chat";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ChatMessageLinkRedirectProps {
  conversationId: string;
  messageId: string;
}

export function ChatMessageLinkRedirect({
  conversationId,
  messageId,
}: ChatMessageLinkRedirectProps) {
  const router = useRouter();
  const conversationQuery = useConversationQuery(conversationId);

  useEffect(() => {
    if (!conversationId || !messageId) {
      router.replace("/");
      return;
    }

    const targetPath =
      buildConversationPathFromConversation(conversationQuery.data?.conversation) ||
      `/${conversationId}`;
    const targetRouteParam = targetPath.slice(1);
    const storageKey = `${CHAT_FOCUS_STORAGE_KEY_PREFIX}:${targetRouteParam}`;
    sessionStorage.setItem(storageKey, messageId);
    router.replace(targetPath);
  }, [conversationId, conversationQuery.data?.conversation, messageId, router]);

  return null;
}
