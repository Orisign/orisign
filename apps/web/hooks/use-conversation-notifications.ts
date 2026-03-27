"use client";

import {
  conversationsControllerUpdateNotifications,
  type GetConversationResponseDto,
} from "@/api/generated";
import { getConversationQueryKey } from "@/hooks/use-chat";
import { toast } from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

function updateConversationNotificationsInCache(
  data: GetConversationResponseDto | undefined,
  notificationsEnabled: boolean,
) {
  if (!data?.conversation) {
    return data;
  }

  return {
    ...data,
    conversation: {
      ...data.conversation,
      notificationsEnabled,
    },
  };
}

export function useConversationNotifications(
  conversationId: string,
  serverValue: boolean | null | undefined,
  enabled = true,
) {
  const t = useTranslations("rightSidebar.members");
  const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    Boolean(serverValue ?? true),
  );

  useEffect(() => {
    setNotificationsEnabled(Boolean(serverValue ?? true));
  }, [conversationId, serverValue]);

  const mutation = useMutation({
    mutationFn: (nextValue: boolean) =>
      conversationsControllerUpdateNotifications({
        conversationId,
        notificationsEnabled: nextValue,
      }),
    onMutate: async (nextValue) => {
      const previousConversation = queryClient.getQueryData<GetConversationResponseDto>(
        getConversationQueryKey(conversationId),
      );

      setNotificationsEnabled(nextValue);
      queryClient.setQueryData<GetConversationResponseDto>(
        getConversationQueryKey(conversationId),
        (currentData) =>
          updateConversationNotificationsInCache(currentData, nextValue),
      );

      return { previousConversation };
    },
    onError: (_error, _nextValue, context) => {
      setNotificationsEnabled(
        Boolean(context?.previousConversation?.conversation?.notificationsEnabled ?? true),
      );
      queryClient.setQueryData<GetConversationResponseDto>(
        getConversationQueryKey(conversationId),
        context?.previousConversation,
      );
      toast({
        title: t("notificationsUpdateError"),
        type: "error",
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: getConversationQueryKey(conversationId),
      });
    },
  });

  return {
    notificationsEnabled,
    canToggleNotifications: enabled && Boolean(conversationId),
    isUpdatingNotifications: mutation.isPending,
    toggleNotifications: (nextValue: boolean) => {
      if (!enabled || !conversationId || mutation.isPending) {
        return;
      }

      mutation.mutate(nextValue);
    },
  };
}
