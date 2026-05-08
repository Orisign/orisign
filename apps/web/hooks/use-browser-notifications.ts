"use client";

import {
  type ConversationResponseDto,
  type ListMyConversationsResponseDto,
  getConversationsControllerMyQueryKey,
} from "@/api/generated";
import { apiWsSubscribe } from "@/lib/api-ws";
import {
  formatChatListMessagePreview,
  getConversationTitle,
} from "@/lib/chat";
import {
  buildConversationPathFromConversation,
  decodeConversationLocator,
} from "@/lib/chat-routes";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

const NOTIFICATION_SW_PATH = "/notification-sw.js";

interface BrowserNotificationMessage {
  conversationId?: string;
  messageId?: string;
  authorId?: string;
  text?: string;
  mediaKeys?: string[];
  createdAt?: number;
}

interface ChatListRealtimeEvent {
  type?: string;
  reason?: string;
  actorId?: string;
  conversationId?: string;
  notification?: BrowserNotificationMessage;
}

function resolveConversationIdFromPathname(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "c") {
    return decodeConversationLocator(segments[1] ?? null) || null;
  }

  return decodeConversationLocator(segments[0] ?? null) || null;
}

function findConversation(
  data: ListMyConversationsResponseDto | undefined,
  conversationId: string,
) {
  return (data?.conversations ?? []).find(
    (conversation) => conversation.id === conversationId,
  );
}

function shouldShowNotification(params: {
  enabled: boolean;
  currentUserId?: string;
  event: ChatListRealtimeEvent;
  conversation: ConversationResponseDto | undefined;
  activeConversationId: string | null;
}) {
  const message = params.event.notification;
  if (!params.enabled || !message) return false;
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  if (params.event.type !== "chat-list.invalidate") return false;
  if (params.event.reason !== "message.sent") return false;
  if (!params.currentUserId || message.authorId === params.currentUserId) return false;
  if (params.conversation && !params.conversation.notificationsEnabled) return false;

  return (
    document.visibilityState !== "visible" ||
    params.activeConversationId !== message.conversationId
  );
}

export function showBrowserNotification(
  title: string,
  options?: NotificationOptions,
) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return Promise.resolve(null);
  }

  if (Notification.permission !== "granted") {
    return Promise.resolve(null);
  }

  if ("serviceWorker" in navigator) {
    return navigator.serviceWorker
      .register(NOTIFICATION_SW_PATH)
      .then((registration) => {
        return registration.showNotification(title, {
          ...options,
          requireInteraction: false,
        });
      })
      .then(() => null)
      .catch(() => new Notification(title, options));
  }

  return Promise.resolve(new Notification(title, options));
}

export function useBrowserNotifications(currentUserId?: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("chat.list");
  const enabled = useGeneralSettingsStore(
    (state) => state.browserNotificationsEnabled,
  );
  const shownMessagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = apiWsSubscribe((payload) => {
      const event = payload as ChatListRealtimeEvent;
      const message = event.notification;
      const conversationId = message?.conversationId ?? event.conversationId ?? "";
      if (!conversationId) return;

      const conversationsData =
        queryClient.getQueryData<ListMyConversationsResponseDto>(
          getConversationsControllerMyQueryKey(),
        );
      const conversation = findConversation(conversationsData, conversationId);
      const activeConversationId = resolveConversationIdFromPathname(pathname);

      if (
        !shouldShowNotification({
          enabled,
          currentUserId,
          event,
          conversation,
          activeConversationId,
        })
      ) {
        return;
      }

      const messageId = message?.messageId ?? "";
      if (messageId && shownMessagesRef.current.has(messageId)) {
        return;
      }

      if (messageId) {
        shownMessagesRef.current.add(messageId);
      }

      const body = formatChatListMessagePreview(
        {
          text: message?.text ?? "",
          mediaKeys: message?.mediaKeys ?? [],
        },
        {
          callLabels: {
            title: t("call.title"),
            separator: "·",
            status: {
              completed: t("call.status.completed"),
              declined: t("call.status.declined"),
              canceled: t("call.status.canceled"),
              failed: t("call.status.failed"),
            },
          },
          mediaLabels: {
            photo: t("media.photo"),
            music: t("media.music"),
            file: t("media.file"),
            attachment: t("media.attachment"),
          },
        },
      );
      void showBrowserNotification(
        conversation ? getConversationTitle(conversation) : "Orisign",
        {
          body: body || t("newMessage"),
          tag: messageId || conversationId,
          data: {
            url: conversation
              ? buildConversationPathFromConversation(conversation)
              : "/",
          },
        },
      ).then((notification) => {
        if (!notification) return;

        notification.onclick = () => {
          window.focus();
          if (conversation) {
            router.push(buildConversationPathFromConversation(conversation));
          }
          notification.close();
        };
      });
    });

    return unsubscribe;
  }, [currentUserId, enabled, pathname, queryClient, router, t]);
}
