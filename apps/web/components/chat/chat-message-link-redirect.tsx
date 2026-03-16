"use client";

import { CHAT_FOCUS_STORAGE_KEY_PREFIX } from "@/lib/chat.constants";
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

  useEffect(() => {
    if (!conversationId || !messageId) {
      router.replace("/");
      return;
    }

    const storageKey = `${CHAT_FOCUS_STORAGE_KEY_PREFIX}:${conversationId}`;
    sessionStorage.setItem(storageKey, messageId);
    router.replace(`/${conversationId}`);
  }, [conversationId, messageId, router]);

  return null;
}
