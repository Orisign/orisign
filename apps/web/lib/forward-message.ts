"use client";

import type { ChatMessageDto } from "@/hooks/use-chat";
import { buildApiUrl } from "@/lib/app-config";
import { customFetch } from "@/lib/fetcher";

export interface ForwardMessageInput {
  sourceConversationId: string;
  messageId: string;
  targetConversationId: string;
}

export interface ForwardMessageResponse {
  ok?: boolean;
  message?: Partial<ChatMessageDto> | null;
}

export async function forwardMessage(input: ForwardMessageInput) {
  return customFetch<ForwardMessageResponse>(buildApiUrl("/messages/forward"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}
