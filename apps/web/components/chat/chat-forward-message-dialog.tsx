"use client";

import {
  ConversationMemberResponseDtoRole,
  ConversationMemberResponseDtoState,
  type ConversationResponseDto,
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  getConversationsControllerMyQueryKey,
  useConversationsControllerMy,
  useUsersControllerMe,
} from "@/api/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  type ChatLastMessagePreviewData,
  type ChatMessagesQueryData,
  type ChatMessageDto,
  appendChatMessageToData,
  bumpConversationInListData,
  bumpConversationQueryData,
  getChatLastMessagePreviewQueryKey,
  getChatMessagesQueryKey,
  getConversationQueryKey,
  normalizeChatMessage,
  useChatAuthors,
} from "@/hooks/use-chat";
import { CHAT_FORCE_SCROLL_BOTTOM_EVENT } from "@/lib/chat.constants";
import {
  CHAT_CONVERSATION_TYPE,
  getAvatarGradient,
  getConversationAvatarUrl,
  getConversationInitial,
  getConversationTitle,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
  isDirectConversation,
} from "@/lib/chat";
import { forwardMessage } from "@/lib/forward-message";
import { cn } from "@/lib/utils";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Ripple,
  ScrollArea,
  Skeleton,
  toast,
} from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";

interface ChatForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceConversationId: string;
  message: ChatMessageDto;
}

interface ForwardConversationItem {
  conversation: ConversationResponseDto;
  title: string;
  subtitle: string;
  initial: string;
  avatarUrl: string;
  avatarSeed: string;
  searchValue: string;
}

function getActiveMember(conversation: ConversationResponseDto, userId: string) {
  return (
    (conversation.members ?? []).find(
      (member) =>
        member.userId === userId &&
        member.state === ConversationMemberResponseDtoState.ACTIVE,
    ) ?? null
  );
}

function getDirectPeerId(conversation: ConversationResponseDto, currentUserId: string) {
  if (!isDirectConversation(conversation)) {
    return "";
  }

  return (
    (conversation.members ?? []).find((member) => member.userId !== currentUserId)
      ?.userId ?? ""
  );
}

function canForwardToConversation(
  conversation: ConversationResponseDto,
  sourceConversationId: string,
  currentUserId: string,
) {
  if (!conversation.id || conversation.id === sourceConversationId || !currentUserId) {
    return false;
  }

  const activeMember = getActiveMember(conversation, currentUserId);

  if (conversation.type !== CHAT_CONVERSATION_TYPE.CHANNEL) {
    return Boolean(activeMember || conversation.ownerId === currentUserId);
  }

  const role = activeMember?.role;

  return (
    conversation.ownerId === currentUserId ||
    role === ConversationMemberResponseDtoRole.OWNER ||
    role === ConversationMemberResponseDtoRole.ADMIN ||
    role === ConversationMemberResponseDtoRole.MODERATOR
  );
}

export function ChatForwardMessageDialog({
  open,
  onOpenChange,
  sourceConversationId,
  message,
}: ChatForwardMessageDialogProps) {
  const t = useTranslations("chat.messages.forwardDialog");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(
    () => new Set(),
  );
  const me = useUsersControllerMe();
  const currentUser = me.data?.user ?? null;
  const currentUserId = currentUser?.id ?? "";
  const conversationsQuery = useConversationsControllerMy(undefined, {
    query: {
      queryKey: getConversationsControllerMyQueryKey(),
      staleTime: 60_000,
    },
  });
  const conversations = useMemo(
    () => conversationsQuery.data?.conversations ?? [],
    [conversationsQuery.data?.conversations],
  );
  const directPeerIds = useMemo(
    () =>
      conversations
        .map((conversation) => getDirectPeerId(conversation, currentUserId))
        .filter(Boolean),
    [conversations, currentUserId],
  );
  const { data: usersMap } = useChatAuthors(directPeerIds);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const items = useMemo<ForwardConversationItem[]>(() => {
    return conversations
      .filter((conversation) =>
        canForwardToConversation(conversation, sourceConversationId, currentUserId),
      )
      .map((conversation) => {
        const isDirect = isDirectConversation(conversation);
        const peerId = getDirectPeerId(conversation, currentUserId);
        const peerUser = peerId ? (usersMap?.[peerId] ?? null) : null;
        const title = isDirect
          ? getUserDisplayName(peerUser, t("unknownAuthor"))
          : getConversationTitle(conversation);
        const subtitle = resolveConversationSubtitle(conversation, {
          isDirect,
          peerUsername: peerUser?.username ?? "",
          labels: {
            direct: t("direct"),
            channel: t("channel"),
            group: t("group"),
            supergroup: t("supergroup"),
          },
        });
        const initial = isDirect
          ? getUserInitial(peerUser, title)
          : getConversationInitial(conversation);
        const avatarUrl = isDirect
          ? getUserAvatarUrl(peerUser)
          : getConversationAvatarUrl(conversation);
        const avatarSeed = peerId || conversation.id;
        const searchValue = [title, subtitle, conversation.username, peerUser?.username]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();

        return {
          conversation,
          title,
          subtitle,
          initial,
          avatarUrl,
          avatarSeed,
          searchValue,
        };
      })
      .filter((item) => !normalizedSearch || item.searchValue.includes(normalizedSearch));
  }, [conversations, currentUserId, normalizedSearch, sourceConversationId, t, usersMap]);

  function resetDialogState() {
    setSearch("");
    setSelectedConversationIds(new Set());
  }

  function closeDialog() {
    resetDialogState();
    onOpenChange(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetDialogState();
    }

    onOpenChange(nextOpen);
  }

  const selectedCount = selectedConversationIds.size;
  const selectedTargets = useMemo(
    () => [...selectedConversationIds],
    [selectedConversationIds],
  );

  const { mutateAsync: sendForward, isPending } = useMutation({
    mutationFn: async (targetConversationIds: string[]) => {
      const results = await Promise.allSettled(
        targetConversationIds.map(async (targetConversationId) => ({
          targetConversationId,
          response: await forwardMessage({
            sourceConversationId,
            messageId: message.id,
            targetConversationId,
          }),
        })),
      );
      const forwarded = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const failedCount = results.length - forwarded.length;

      if (forwarded.length === 0) {
        throw new Error("forward failed");
      }

      return {
        forwarded,
        failedCount,
      };
    },
    onSuccess: ({ forwarded, failedCount }) => {
      forwarded.forEach(({ response, targetConversationId }) => {
        const forwardedMessage = normalizeChatMessage(response.message);
        const updatedAt = forwardedMessage?.createdAt || Date.now();

        if (forwardedMessage) {
          queryClient.setQueryData<ChatMessagesQueryData>(
            getChatMessagesQueryKey(targetConversationId),
            (currentData) => appendChatMessageToData(currentData, forwardedMessage),
          );
          queryClient.setQueryData<ChatLastMessagePreviewData>(
            getChatLastMessagePreviewQueryKey(targetConversationId),
            { message: forwardedMessage },
          );
        }

        queryClient.setQueryData<GetConversationResponseDto>(
          getConversationQueryKey(targetConversationId),
          (currentData) => bumpConversationQueryData(currentData, updatedAt),
        );
        queryClient.setQueriesData<ListMyConversationsResponseDto>(
          { queryKey: getConversationsControllerMyQueryKey() },
          (currentData) =>
            bumpConversationInListData(currentData, targetConversationId, updatedAt),
        );

        window.requestAnimationFrame(() => {
          window.dispatchEvent(
            new CustomEvent(CHAT_FORCE_SCROLL_BOTTOM_EVENT, {
              detail: { conversationId: targetConversationId },
            }),
          );
        });
      });

      toast({
        title:
          failedCount > 0
            ? t("forwardedPartial", {
                count: forwarded.length,
                failedCount,
              })
            : t("forwarded", { count: forwarded.length }),
        type: failedCount > 0 ? "warning" : "info",
      });
      closeDialog();
    },
    onError: () => {
      toast({
        title: t("forwardError"),
        type: "error",
      });
    },
  });

  function toggleConversation(targetConversationId: string) {
    if (isPending || !targetConversationId) {
      return;
    }

    setSelectedConversationIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(targetConversationId)) {
        nextIds.delete(targetConversationId);
      } else {
        nextIds.add(targetConversationId);
      }

      return nextIds;
    });
  }

  async function handleForward() {
    if (isPending || selectedTargets.length === 0) {
      return;
    }

    try {
      await sendForward(selectedTargets);
    } catch {
      // The mutation onError handler shows the user-facing error.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[min(40.625rem,calc(100vh-2rem))] w-[min(26.25rem,calc(100vw-1rem))] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-border/70 p-0 shadow-2xl sm:rounded-2xl">
        <DialogHeader className="border-b border-border/70 px-5 pb-3 pt-4 text-left">
          <DialogTitle className="pr-12 text-[17px] leading-6">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("description")}
          </DialogDescription>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            autoFocus
            leftSlot={<FiSearch className="size-4" />}
            wrapperClassName="mt-2 h-10 rounded-full border-0 bg-muted/80 px-4"
            className="text-sm"
          />
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1" viewportClassName="px-2 py-2">
          {conversationsQuery.isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="flex h-16 items-center gap-3 rounded-xl px-3">
                  <Skeleton className="size-11 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-1">
              {items.map((item) => {
                const isSelected = selectedConversationIds.has(item.conversation.id);

                return (
                  <Ripple key={item.conversation.id} asChild className="w-full rounded-xl">
                    <div
                      role="button"
                      tabIndex={isPending ? -1 : 0}
                      aria-disabled={isPending}
                      className={cn(
                        "flex h-16 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                        isPending && "cursor-not-allowed opacity-70",
                      )}
                      onClick={() => toggleConversation(item.conversation.id)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") {
                          return;
                        }

                        event.preventDefault();
                        toggleConversation(item.conversation.id);
                      }}
                      aria-label={t("selectChat", { title: item.title })}
                    >
                      <Avatar
                        size="lg"
                        className={cn(
                          !item.avatarUrl
                            ? cn(
                                "text-white",
                                `bg-linear-to-br ${getAvatarGradient(item.avatarSeed)}`,
                              )
                            : "",
                        )}
                      >
                        {item.avatarUrl ? <AvatarImage src={item.avatarUrl} alt="" /> : null}
                        <AvatarFallback
                          className={!item.avatarUrl ? "bg-transparent text-white" : ""}
                        >
                          {item.initial}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold leading-5">
                          {item.title}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {item.subtitle}
                        </p>
                      </div>

                      <Checkbox
                        checked={isSelected}
                        disabled={isPending}
                        onCheckedChange={() => toggleConversation(item.conversation.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="size-5 rounded-full"
                        aria-label={t("selectChat", { title: item.title })}
                      />
                    </div>
                  </Ripple>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-64 items-center justify-center px-8 text-center text-sm text-muted-foreground">
              {normalizedSearch ? t("emptySearch") : t("empty")}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-4 pb-4 pt-2 sm:space-x-0">
          <Button
            type="button"
            className="h-14 w-full rounded-xl text-base"
            disabled={isPending || selectedCount === 0}
            onClick={() => void handleForward()}
          >
            {t("send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function resolveConversationSubtitle(
  conversation: ConversationResponseDto,
  options: {
    isDirect: boolean;
    peerUsername: string;
    labels: {
      direct: string;
      channel: string;
      group: string;
      supergroup: string;
    };
  },
) {
  if (options.isDirect) {
    return options.peerUsername ? `@${options.peerUsername}` : options.labels.direct;
  }

  if (conversation.username) {
    return `@${conversation.username}`;
  }

  if (conversation.type === CHAT_CONVERSATION_TYPE.CHANNEL) {
    return options.labels.channel;
  }

  if (conversation.type === CHAT_CONVERSATION_TYPE.SUPERGROUP) {
    return options.labels.supergroup;
  }

  return options.labels.group;
}
