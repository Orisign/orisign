"use client";

import {
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  SendMessageRequestDtoKind,
  getConversationsControllerMyQueryKey,
  useMessagesControllerDelete,
  useMessagesControllerSend,
} from "@/api/generated";
import {
  type ChatMessagesQueryData,
  bumpConversationInListData,
  bumpConversationQueryData,
  getChatMessagesQueryKey,
  getConversationQueryKey,
  removeChatMessageFromData,
  useChatAuthors,
  useConversationQuery,
} from "@/hooks/use-chat";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { useChatBlockStatus, useSetChatBlock } from "@/hooks/use-chat-block";
import { ChatHeader } from "./chat-header";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SendMessageForm } from "./send-message-form";
import { ChatMessageList } from "./chat-message-list";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Button, toast } from "@repo/ui";
import { AnimatePresence, motion } from "motion/react";
import { FiTrash2, FiX } from "react-icons/fi";
import { SPRING_LAYOUT, fadeScale } from "@/lib/animations";
import { CHAT_FOCUS_STORAGE_KEY_PREFIX } from "@/lib/chat.constants";
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
import type { ChatEditTarget, ChatReplyTarget } from "./chat.types";
import { useDirectCall } from "@/hooks/use-direct-call";
import { ChatCallWindow } from "./chat-call-window";
import { createCallLogMessageText } from "@/lib/call-log-message";

interface ChatPageProps {
  conversationId: string;
  focusMessageId?: string | null;
}

const EMPTY_MESSAGE_SELECTION = new Set<string>();

export function ChatPage({ conversationId, focusMessageId }: ChatPageProps) {
  const tHeader = useTranslations("chat.header");
  const tSelection = useTranslations("chat.selection");
  const tSendForm = useTranslations("chat.sendMessageForm");
  const conversationQuery = useConversationQuery(conversationId);
  const { user: currentUser } = useCurrentUser();
  useChatRealtime(conversationId, currentUser?.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const composerVariants = fadeScale;
  const [replyState, setReplyState] = useState<{
    conversationId: string;
    target: ChatReplyTarget | null;
  }>({
    conversationId,
    target: null,
  });
  const [editState, setEditState] = useState<{
    conversationId: string;
    target: ChatEditTarget | null;
  }>({
    conversationId,
    target: null,
  });
  const [selectionState, setSelectionState] = useState<{
    conversationId: string;
    ids: Set<string>;
  }>({
    conversationId,
    ids: new Set<string>(),
  });
  const [resolvedFocusMessageId] = useState<string | null>(() => {
    if (focusMessageId) {
      return focusMessageId;
    }

    if (typeof window === "undefined") {
      return null;
    }

    const storageKey = `${CHAT_FOCUS_STORAGE_KEY_PREFIX}:${conversationId}`;
    const storedMessageId = sessionStorage.getItem(storageKey);
    if (storedMessageId) {
      sessionStorage.removeItem(storageKey);
      return storedMessageId;
    }

    return null;
  });
  const selectedMessageIds =
    selectionState.conversationId === conversationId
      ? selectionState.ids
      : EMPTY_MESSAGE_SELECTION;
  const isSelectionMode = selectedMessageIds.size > 0;
  const selectedCount = selectedMessageIds.size;

  const { mutateAsync: deleteMessage, isPending: isDeletingSelected } =
    useMessagesControllerDelete();
  const { mutate: sendMessage } = useMessagesControllerSend();
  const { mutateAsync: setUserBlock, isPending: isSettingPeerBlock } = useSetChatBlock();

  useEffect(() => {
    if (conversationQuery.isPending) return;
    if (conversationQuery.data?.conversation) return;

    router.replace("/");
  }, [conversationQuery.data?.conversation, conversationQuery.isPending, router]);

  const exitSelectionMode = useCallback(() => {
    setSelectionState({
      conversationId,
      ids: new Set(),
    });
  }, [conversationId]);

  const startSelectionMode = useCallback((messageId: string) => {
    if (!messageId) return;

    setReplyState((currentState) => ({
      ...currentState,
      conversationId,
      target: null,
    }));
    setEditState((currentState) => ({
      ...currentState,
      conversationId,
      target: null,
    }));
    setSelectionState({
      conversationId,
      ids: new Set([messageId]),
    });
  }, [conversationId]);

  const toggleMessageSelection = useCallback((messageId: string) => {
    if (!messageId) return;

    setSelectionState((currentState) => {
      const nextSelection =
        currentState.conversationId === conversationId
          ? new Set(currentState.ids)
          : new Set<string>();

      if (nextSelection.has(messageId)) {
        nextSelection.delete(messageId);
      } else {
        nextSelection.add(messageId);
      }

      return {
        conversationId,
        ids: nextSelection,
      };
    });
  }, [conversationId]);

  const handleDeleteSelected = useCallback(async () => {
    const idsToDelete = Array.from(selectedMessageIds);

    if (idsToDelete.length === 0 || isDeletingSelected) return;

    try {
      const response = await deleteMessage({
        data: {
          conversationId,
          messageIds: idsToDelete,
        },
      });
      const failedIds = (response.failedMessageIds ?? []).filter(Boolean);
      const failedIdsSet = new Set(failedIds);
      const responseDeletedIds = (response.deletedMessageIds ?? []).filter(Boolean);
      const deletedIds =
        responseDeletedIds.length > 0
          ? responseDeletedIds
          : idsToDelete.filter((messageId) => !failedIdsSet.has(messageId));

      if (deletedIds.length > 0) {
        queryClient.setQueryData<ChatMessagesQueryData>(
          getChatMessagesQueryKey(conversationId),
          (currentData) =>
            deletedIds.reduce<ChatMessagesQueryData | undefined>(
              (nextData, messageId) => removeChatMessageFromData(nextData, messageId),
              currentData,
            ),
        );

        const nextTimestamp = Date.now();

        queryClient.setQueryData<GetConversationResponseDto>(
          getConversationQueryKey(conversationId),
          (currentData) => bumpConversationQueryData(currentData, nextTimestamp),
        );

        queryClient.setQueriesData<ListMyConversationsResponseDto>(
          { queryKey: getConversationsControllerMyQueryKey() },
          (currentData) =>
            bumpConversationInListData(currentData, conversationId, nextTimestamp),
        );
      }

      if (failedIds.length === 0) {
        exitSelectionMode();
        return;
      }

      setSelectionState({
        conversationId,
        ids: new Set(failedIds),
      });
    } catch {
      setSelectionState({
        conversationId,
        ids: new Set(idsToDelete),
      });
    }
  }, [
    conversationId,
    deleteMessage,
    exitSelectionMode,
    isDeletingSelected,
    queryClient,
    selectedMessageIds,
  ]);

  const conversation = conversationQuery.data?.conversation ?? null;
  const isDirect = isDirectConversation(conversation);
  const peerId = isDirect
    ? (conversation?.members ?? []).find((member) => member.userId !== currentUser?.id)
        ?.userId
    : undefined;
  const { data: usersMap } = useChatAuthors(peerId ? [peerId] : []);
  const { data: blockStatus } = useChatBlockStatus(isDirect ? peerId : null);
  const peerUser = peerId ? (usersMap?.[peerId] ?? null) : null;
  const title = isDirect
    ? getUserDisplayName(peerUser, tHeader("directFallback"))
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
  const editTarget =
    editState.conversationId === conversationId ? editState.target : null;
  const isPeerBlockedByCurrentUser = Boolean(isDirect && blockStatus?.blocked);
  const isCurrentUserBlockedByPeer = Boolean(isDirect && blockStatus?.blockedByTarget);
  const isCallBlocked = isPeerBlockedByCurrentUser || isCurrentUserBlockedByPeer;

  const handleUnblockPeer = useCallback(async () => {
    if (!peerId || !isDirect || isSettingPeerBlock) return;

    try {
      await setUserBlock({
        targetUserId: peerId,
        blocked: false,
      });
    } catch {
      toast({
        title: tSendForm("unblockError"),
        type: "error",
      });
    }
  }, [isDirect, isSettingPeerBlock, peerId, setUserBlock, tSendForm]);

  const directCall = useDirectCall({
    enabled: isDirect,
    conversationId,
    onCallSummary: (summary) => {
      sendMessage({
        data: {
          conversationId,
          kind: SendMessageRequestDtoKind.NUMBER_1,
          text: createCallLogMessageText({
            status: summary.status,
            durationSeconds: summary.durationSeconds,
            endedAt: summary.endedAt,
          }),
        },
      });
    },
  });

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
        directPeerId={peerId}
        isPeerBlockedByCurrentUser={isPeerBlockedByCurrentUser}
        onStartCall={() => {
          if (!isCallBlocked) {
            void directCall.startCall();
          }
        }}
        onEndCall={directCall.endCall}
        callActive={directCall.isInCall}
        callDisabled={isCallBlocked}
      />

      <ChatCallWindow
        state={directCall.state}
        error={directCall.error}
        title={title}
        avatarUrl={avatarUrl}
        avatarFallback={avatarFallback}
        securityMaterial={directCall.securityMaterial}
        onAccept={() => void directCall.acceptIncomingCall()}
        onReject={directCall.rejectIncomingCall}
        onEnd={directCall.endCall}
        onDismissError={directCall.dismissError}
      />

      <ChatMessageList
        conversationId={conversationId}
        conversation={conversation}
        focusMessageId={resolvedFocusMessageId}
        selectionMode={isSelectionMode}
        selectedMessageIds={selectedMessageIds}
        onStartSelectMessage={startSelectionMode}
        onToggleMessageSelect={toggleMessageSelection}
        onReply={(message) => {
          setEditState({
            conversationId,
            target: null,
          });
          setReplyState({
            conversationId,
            target: message,
          });
        }}
        onEdit={(message) => {
          setReplyState({
            conversationId,
            target: null,
          });
          setEditState({
            conversationId,
            target: message,
          });
        }}
      />

      <div className="shrink-0 px-4 py-4">
        <div className="mx-auto w-full max-w-3xl">
          <motion.div
            layout
            transition={{
              layout: SPRING_LAYOUT,
            }}
            className="overflow-hidden"
          >
            <AnimatePresence mode="sync" initial={false}>
              {isSelectionMode ? (
                <motion.div
                  key="selection-mode"
                  layout
                  layoutId="chat-composer-shell"
                  variants={composerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-border/70 bg-background/90 p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-xl"
                      onClick={exitSelectionMode}
                    >
                      <FiX className="size-4" />
                    </Button>

                    <p className="text-sm font-semibold text-foreground">
                      {tSelection("selected", { count: selectedCount })}
                    </p>

                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="ml-auto size-9 rounded-xl"
                      onClick={() => void handleDeleteSelected()}
                      disabled={selectedCount === 0 || isDeletingSelected}
                    >
                      <FiTrash2 className="size-4" />
                    </Button>
                  </div>
                </motion.div>
              ) : (
                isPeerBlockedByCurrentUser ? (
                  <motion.div
                    key="unblock-peer"
                    layout
                    layoutId="chat-composer-shell"
                    variants={composerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Button
                      type="button"
                      className="h-14 w-full rounded-2xl text-base font-semibold"
                      onClick={() => void handleUnblockPeer()}
                      disabled={!peerId || isSettingPeerBlock}
                    >
                      {tSendForm("unblockAction")}
                    </Button>
                  </motion.div>
                ) : (
                <motion.div
                  key="send-message-form"
                  layout
                  layoutId="chat-composer-shell"
                  variants={composerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <SendMessageForm
                    conversationId={conversationId}
                    isBlockedByCurrentUser={isPeerBlockedByCurrentUser}
                    isBlockedByPeer={isCurrentUserBlockedByPeer}
                    replyTarget={replyTarget}
                    editTarget={editTarget}
                    onCancelReply={() =>
                      setReplyState({
                        conversationId,
                        target: null,
                      })
                    }
                    onCancelEdit={() =>
                      setEditState({
                        conversationId,
                        target: null,
                      })
                    }
                  />
                </motion.div>
                )
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
