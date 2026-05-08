"use client";

import {
  type CreateConversationRequestDto,
  CreateConversationRequestDtoType,
  getConversationsControllerMyQueryKey,
  useConversationsControllerCreate,
  useUsersControllerMe,
} from "@/api/generated";
import { CreateConversationUserRow } from "@/components/chat/create-conversation-user-row";
import { AvatarUploadButton } from "@/components/shared/avatar-upload-button";
import { EmojiInput } from "@/components/ui/emoji-input";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
  SidebarPageTitle,
} from "@/components/ui/sidebar-page";
import { useChatAuthors } from "@/hooks/use-chat";
import { sidebarStore } from "@/store/sidebar/sidebar.store";
import { buildConversationPathFromConversation } from "@/lib/chat-routes";
import { uploadConversationAvatar } from "@/lib/upload-conversation-avatar";
import { createCreateChannelSchema } from "@/schemas/chat/create-channel.schema";
import { createCreateGroupSchema } from "@/schemas/chat/create-group.schema";
import type { SidebarRoute } from "@/store/sidebar/sidebar-state.types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Field, Input } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";

interface CreateConversationDetailsSidebarProps {
  route: Extract<SidebarRoute, { screen: "create-conversation-details" }>;
}

type GroupFormValues = {
  title: string;
};

type ChannelFormValues = {
  title: string;
  username?: string;
  about?: string;
};

type CreateConversationPayloadWithAvatar = CreateConversationRequestDto & {
  avatarKey?: string;
};

export function CreateConversationDetailsSidebar({
  route,
}: CreateConversationDetailsSidebarProps) {
  const t = useTranslations("createConversation.details");
  const ts = useTranslations("validation.createConversation");
  const { pop, reset } = sidebarStore();
  const me = useUsersControllerMe();
  const currentUser = me.data?.user ?? null;
  const router = useRouter();
  const queryClient = useQueryClient();
  const memberIds = route.memberIds;
  const isChannel = route.type === "channel";
  const selectedUsersQuery = useChatAuthors(memberIds);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatar, setAvatar] = useState<{
    key: string;
    previewUrl: string;
  } | null>(null);

  const users = useMemo(
    () =>
      memberIds
        .map((id) => selectedUsersQuery.data?.[id] ?? null)
        .filter((user): user is NonNullable<typeof user> => Boolean(user)),
    [memberIds, selectedUsersQuery.data],
  );

  const defaultGroupTitle = useMemo(() => {
    const names = [
      currentUser?.firstName,
      ...users.map((user) => user.firstName).filter(Boolean),
    ].filter(Boolean);

    return names.slice(0, 3).join(" & ");
  }, [currentUser?.firstName, users]);

  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(createCreateGroupSchema((key) => ts(`group.${key}`))),
    defaultValues: {
      title: "",
    },
  });

  const channelForm = useForm<ChannelFormValues>({
    resolver: zodResolver(createCreateChannelSchema((key) => ts(`channel.${key}`))),
    defaultValues: {
      title: "",
      username: "",
      about: "",
    },
  });

  useEffect(() => {
    if (!isChannel && !groupForm.getValues("title") && defaultGroupTitle) {
      groupForm.setValue("title", defaultGroupTitle, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [defaultGroupTitle, groupForm, isChannel]);

  const { mutate: createConversation, isPending } = useConversationsControllerCreate({
    mutation: {
      onSuccess: async (response) => {
        await queryClient.invalidateQueries({
          queryKey: getConversationsControllerMyQueryKey(),
        });

        reset();

        if (response.conversation) {
          router.push(buildConversationPathFromConversation(response.conversation));
        }
      },
    },
  });

  function submitGroup(values: GroupFormValues) {
    createConversation({
      data: {
        type: CreateConversationRequestDtoType.GROUP,
        title: values.title.trim(),
        memberIds,
        avatarKey: avatar?.key || undefined,
      } as CreateConversationPayloadWithAvatar,
    });
  }

  function submitChannel(values: ChannelFormValues) {
    const username = (values.username ?? "").trim();
    const about = (values.about ?? "").trim();

    createConversation({
      data: {
        type: CreateConversationRequestDtoType.CHANNEL,
        title: values.title.trim(),
        username: username || undefined,
        about: about || undefined,
        isPublic: Boolean(username),
        avatarKey: avatar?.key || undefined,
      } as CreateConversationPayloadWithAvatar,
    });
  }

  async function handleAvatarUpload(file: File) {
    if (!file || isAvatarUploading) return;

    setIsAvatarUploading(true);

    try {
      const response = await uploadConversationAvatar(file);
      const key = response.key;
      if (!key) {
        return;
      }

      setAvatar({
        key,
        previewUrl: response.url || key,
      });
    } finally {
      setIsAvatarUploading(false);
    }
  }

  return (
    <SidebarPage className="h-full pb-24">
      <SidebarPageHeader className="justify-start gap-3">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={pop}>
          <ArrowLeft className="size-6" strokeWidth={2.8} />
        </Button>
        <SidebarPageTitle>{t(isChannel ? "titleChannel" : "titleGroup")}</SidebarPageTitle>
      </SidebarPageHeader>

      <SidebarPageContent className="gap-5">
        <div className="flex w-full justify-center pt-4">
          <div className="relative flex size-32 items-center justify-center overflow-hidden rounded-full bg-muted text-primary">
            {avatar?.previewUrl ? (
              <img
                src={avatar.previewUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : null}
            <AvatarUploadButton
              className="absolute inset-0 flex items-center justify-center"
              buttonClassName="h-13 w-13 rounded-full p-1"
              disabled={isAvatarUploading}
              ariaLabel={t(isChannel ? "uploadChannelAvatar" : "uploadGroupAvatar")}
              onUpload={handleAvatarUpload}
            />
          </div>
        </div>

        {isChannel ? (
          <form
            onSubmit={channelForm.handleSubmit(submitChannel)}
            className="flex flex-col gap-4"
          >
            <Controller
              control={channelForm.control}
              name="title"
              render={({ field }) => (
                <Field>
                  <Input
                    {...field}
                    placeholder={t("fields.titlePlaceholderChannel")}
                    className="h-14 rounded-2xl"
                  />
                </Field>
              )}
            />

            <Controller
              control={channelForm.control}
              name="username"
              render={({ field }) => (
                <Field>
                  <Input
                    {...field}
                    placeholder={t("fields.usernamePlaceholder")}
                    className="h-14 rounded-2xl"
                  />
                </Field>
              )}
            />

            <Controller
              control={channelForm.control}
              name="about"
              render={({ field }) => (
                <Field>
                  <EmojiInput
                    placeholder={t("fields.aboutPlaceholder")}
                    className="rounded-2xl"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    showEmojiPicker
                    autoGrow
                    maxHeight={220}
                    submitOnEnter={false}
                  />
                </Field>
              )}
            />

            <Button
              type="submit"
              size="icon"
              disabled={isPending || isAvatarUploading}
              className="absolute bottom-4 right-4 z-40 size-14 rounded-full shadow-none [&_svg]:size-7"
            >
              <ArrowRight className="size-7" strokeWidth={2.8} />
            </Button>
          </form>
        ) : (
          <>
            <form
              onSubmit={groupForm.handleSubmit(submitGroup)}
              className="flex flex-col gap-4"
            >
              <Controller
                control={groupForm.control}
                name="title"
                render={({ field }) => (
                  <Field>
                    <Input
                      {...field}
                      placeholder={t("fields.titlePlaceholderGroup")}
                      className="h-14 rounded-2xl"
                    />
                  </Field>
                )}
              />

              <div className="space-y-3">
                <p className="px-1 text-sm font-bold text-primary">
                  {t("membersCount", { count: users.length })}
                </p>

                <div className="flex flex-col gap-0.5">
                  {users.map((user) => (
                    <CreateConversationUserRow
                      key={user.id}
                      conversationSeed="create:group"
                      user={user}
                      subtitle={user.username ? `@${user.username}` : t("recently")}
                      checked
                      showCheckbox={false}
                      interactive={false}
                      onToggle={() => {}}
                    />
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                size="icon"
                disabled={isPending || isAvatarUploading}
                className="absolute bottom-4 right-4 z-40 size-14 rounded-full shadow-none [&_svg]:size-7"
              >
                <ArrowRight className="size-7" strokeWidth={2.8} />
              </Button>
            </form>
          </>
        )}
      </SidebarPageContent>
    </SidebarPage>
  );
}
