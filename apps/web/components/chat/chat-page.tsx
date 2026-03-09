"use client";

import { useChatAuthors, useConversationQuery } from "@/hooks/use-chat";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { ChatHeader } from "./chat-header";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SendMessageForm } from "./send-message-form";
import { ChatMessageList } from "./chat-message-list";
import type { ChatReplyTarget } from "./chat.types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTranslations } from "next-intl";
import {
  getAvatarGradient,
  getConversationAvatarUrl,
  getConversationInitial,
  getConversationTitle,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
  isDirectConversation,
} from "@/lib/chat";

interface ChatPageProps {
  conversationId: string;
}

export function ChatPage({ conversationId }: ChatPageProps) {
  const t = useTranslations("chat.header");
  const conversationQuery = useConversationQuery(conversationId);
  const { user: currentUser } = useCurrentUser();
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
  const isDirect = isDirectConversation(conversation);
  const peerId = isDirect
    ? (conversation?.members ?? []).find((member) => member.userId !== currentUser?.id)
        ?.userId
    : undefined;
  const { data: usersMap } = useChatAuthors(peerId ? [peerId] : []);
  const peerUser = peerId ? (usersMap?.[peerId] ?? null) : null;
  const title = isDirect
    ? getUserDisplayName(peerUser, t("directFallback"))
    : (conversation ? getConversationTitle(conversation) : "");
  const subtitle = isDirect ? (peerUser?.username ? `@${peerUser.username}` : "") : "";
  const avatarUrl = isDirect
    ? getUserAvatarUrl(peerUser)
    : getConversationAvatarUrl(conversation);
  const avatarFallback = isDirect
    ? getUserInitial(peerUser, title || "#")
    : (conversation ? getConversationInitial(conversation) : "#");
  const avatarSeed = getAvatarGradient(peerId ?? conversationId);
  const replyTarget =
    replyState.conversationId === conversationId ? replyState.target : null;

  return (
    <div className="chat-wallpaper relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <ChatHeader
        conversationId={conversationId}
        title={title}
        members={conversation?.members.length ?? 0}
        subtitle={subtitle}
        avatarUrl={avatarUrl}
        avatarFallback={avatarFallback}
        avatarSeed={avatarSeed}
        isDirect={isDirect}
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
