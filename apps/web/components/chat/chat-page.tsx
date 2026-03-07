"use client";

import { useConversationsControllerGet } from "@/api/generated";
import { ChatHeader } from "./chat-header";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SendMessageForm } from "./send-message-form";
import { useTranslations } from "next-intl";

interface ChatPageProps {
  conversationId: string;
}

export function ChatPage({ conversationId }: ChatPageProps) {
  const t = useTranslations("chat.page");
  const { mutate, data } = useConversationsControllerGet();
  const router = useRouter();

  useEffect(() => {
    mutate(
      {
        data: {
          conversationId: conversationId,
        },
      },
      {
        onSuccess: (response) => {
          if (!response?.conversation) {
            router.replace("/");
          }
        },
      },
    );
  }, [conversationId, mutate, router]);

  const conversation = data?.conversation;

  return (
    <div className="-m-6 relative flex h-[calc(100%+3rem)] min-h-0 flex-col overflow-hidden">
      <ChatHeader
        conversationId={conversation?.id ?? ""}
        title={conversation?.title ?? ""}
        members={conversation?.members.length ?? 0}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-24">
        <p className="text-sm text-muted-foreground">{t("placeholder")}</p>
      </div>

      <div className="absolute bottom-0 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 bg-background/90 px-4 py-3">
        <SendMessageForm conversationId={conversation?.id ?? ""} />
      </div>
    </div>
  );
}
