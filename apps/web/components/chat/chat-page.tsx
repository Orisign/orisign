"use client";

import { useConversationQuery } from "@/hooks/use-chat";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { ChatHeader } from "./chat-header";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SendMessageForm } from "./send-message-form";
import { ChatMessageList } from "./chat-message-list";
import type { ChatReplyTarget } from "./chat.types";

interface ChatPageProps {
  conversationId: string;
}

export function ChatPage({ conversationId }: ChatPageProps) {
  const conversationQuery = useConversationQuery(conversationId);
  useChatRealtime(conversationId);
  const router = useRouter();
  const [replyState, setReplyState] = useState<{
    conversationId: string;
    target: ChatReplyTarget | null;
  }>({
    conversationId,
    target: null,
  });

  useEffect(() => {
    if (conversationQuery.isPending) return;
    if (conversationQuery.data?.conversation) return;

    router.replace("/");
  }, [conversationQuery.data?.conversation, conversationQuery.isPending, router]);

  const conversation = conversationQuery.data?.conversation ?? null;
  const replyTarget =
    replyState.conversationId === conversationId ? replyState.target : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <ChatHeader
        conversationId={conversationId}
        title={conversation?.title ?? ""}
        members={conversation?.members.length ?? 0}
      />

      <ChatMessageList
        conversationId={conversationId}
        conversation={conversation}
        onReply={(message) =>
          setReplyState({
            conversationId,
            target: message,
          })
        }
      />

      <div className="shrink-0 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-3xl">
          <SendMessageForm
            conversationId={conversationId}
            replyTarget={replyTarget}
            onCancelReply={() =>
              setReplyState({
                conversationId,
                target: null,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
