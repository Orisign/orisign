"use client";

import {
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  type UpdateMemberRoleRequestDtoRole,
  CreateConversationRequestDtoType,
  UpdateMemberRoleRequestDtoRole as UpdateMemberRoleRole,
  conversationsControllerAddMembers,
  conversationsControllerCreate,
  conversationsControllerRemoveMember,
  conversationsControllerUpdateRole,
  getConversationsControllerMyQueryKey,
  useMessagesControllerDelete,
} from "@/api/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatMessageLinkPreview } from "@/components/chat/chat-message-link-preview";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CHAT_SHARED_MEDIA_FILTER,
  type ChatSharedMediaFilter,
  useChatSharedMedia,
} from "@/hooks/use-chat-shared-media";
import {
  type ChatMessagesQueryData,
  bumpConversationInListData,
  bumpConversationQueryData,
  getChatMessagesQueryKey,
  getConversationQueryKey,
  removeChatMessageFromData,
  useConversationQuery,
  useChatAuthors,
} from "@/hooks/use-chat";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRightSidebar } from "@/hooks/use-right-sidebar";
import { useSidebar } from "@/hooks/use-sidebar";
import { useUsersList } from "@/hooks/use-users-list";
import {
  CHAT_CONVERSATION_TYPE,
  CHAT_MEDIA_KIND,
  formatTimestampTime,
  getAvatarGradient,
  getConversationAvatarUrl,
  getConversationInitial,
  getConversationSubtitle,
  getConversationTitle,
  getMediaLabel,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
  isDirectConversation,
  resolveChatMediaKind,
  resolveStorageFileUrl,
} from "@/lib/chat";
import { extractMessageUrls, stripMessageFormatting } from "@/lib/chat-message-format";
import { CHAT_SELECT_EVENT, CHAT_SELECT_STORAGE_KEY_PREFIX } from "@/lib/chat.constants";
import { downloadMediaByKey } from "@/lib/download-media";
import { cn } from "@/lib/utils";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import {
  RIGHT_SIDEBAR_TAB,
  type RightSidebarTab,
} from "@/store/right-sidebar/right-sidebar.types";
import { Button, Input, Ripple, Skeleton, Switch, Tabs, TabsList, TabsTrigger, toast } from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import { type MouseEvent, type ReactNode, memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IoAdd,
  IoAtOutline,
  IoClose,
  IoChevronBack,
  IoChevronForward,
  IoCreateOutline,
  IoDownloadOutline,
  IoDocumentTextOutline,
  IoInformationCircleOutline,
  IoLinkOutline,
  IoPause,
  IoPlay,
  IoRemove,
  IoNotificationsOutline,
  IoTrashOutline,
  IoVolumeHigh,
  IoVolumeMute,
  IoPeopleOutline,
  IoSearch,
} from "react-icons/io5";
import {
  FiCheck,
  FiCheckCircle,
  FiCopy,
  FiDownload,
  FiExternalLink,
  FiEdit2,
  FiMessageCircle,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";

interface RightSidebarProps {
  conversationId: string;
}

interface SharedMediaAsset {
  id: string;
  messageId: string;
  mediaKey: string;
  url: string;
  kind: string;
  createdAt: number;
  authorId: string;
  text: string;
}

interface SharedLinkAsset {
  id: string;
  messageId: string;
  url: string;
  createdAt: number;
  authorId: string;
}

interface SharedMessageEntry {
  messageId: string;
  authorId: string;
}

interface SidebarPreviewState {
  messageId: string;
  mediaKey: string;
  url: string;
  kind: string;
  layoutId: string;
}

interface RightSidebarContextAction {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  variant?: "default" | "destructive";
}

const SIDEBAR_TAB_FILTER_MAP: Partial<Record<RightSidebarTab, ChatSharedMediaFilter>> = {
  [RIGHT_SIDEBAR_TAB.MEDIA]: CHAT_SHARED_MEDIA_FILTER.MEDIA,
  [RIGHT_SIDEBAR_TAB.FILES]: CHAT_SHARED_MEDIA_FILTER.FILES,
  [RIGHT_SIDEBAR_TAB.LINKS]: CHAT_SHARED_MEDIA_FILTER.LINKS,
  [RIGHT_SIDEBAR_TAB.VOICE]: CHAT_SHARED_MEDIA_FILTER.VOICE,
};

const MEMBER_ROLE_LABEL_KEY: Record<number, string> = {
  1: "memberRole.owner",
  2: "memberRole.admin",
  3: "memberRole.moderator",
  4: "memberRole.member",
  5: "memberRole.subscriber",
};

const TAB_ORDER: RightSidebarTab[] = [
  RIGHT_SIDEBAR_TAB.MEDIA,
  RIGHT_SIDEBAR_TAB.FILES,
  RIGHT_SIDEBAR_TAB.LINKS,
  RIGHT_SIDEBAR_TAB.VOICE,
  RIGHT_SIDEBAR_TAB.MEMBERS,
];

type RightSidebarScreen = "info" | "members" | "add-members";

const SCREEN_ORDER: RightSidebarScreen[] = ["info", "members", "add-members"];
const SCREEN_TRANSITION = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1] as const,
};
const VIDEO_PREVIEW_CONTROL_BUTTON_CLASS =
  "inline-flex size-11 items-center justify-center border-0 bg-transparent p-0 text-primary outline-none ring-0 transition-colors duration-150 hover:text-primary/80 active:text-primary/70 focus-visible:text-primary [&_svg]:size-7";

const RightSidebarContextMenuContent = memo(function RightSidebarContextMenuContent({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          "z-50 max-h-(--radix-context-menu-content-available-height) min-w-32 overflow-y-auto overflow-x-hidden rounded-md bg-popover px-1.5 py-1 text-popover-foreground origin-[--radix-context-menu-content-transform-origin] [will-change:transform,opacity] data-[state=open]:animate-[dropdown-in_180ms_cubic-bezier(.22,.8,.2,1)] data-[state=closed]:animate-[dropdown-out_140ms_cubic-bezier(.4,0,.2,1)]",
        )}
        collisionPadding={10}
      >
        {children}
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  );
});

const RightSidebarContextMenuItem = memo(function RightSidebarContextMenuItem({
  label,
  icon,
  onSelect,
  variant = "default",
}: Omit<RightSidebarContextAction, "key">) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-5 rounded-md px-3 py-1.5 text-sm font-semibold outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:stroke-[2.5px] [&_svg]:size-5 [&_svg]:shrink-0",
        variant === "default" && "focus:bg-accent focus:text-accent-foreground",
        variant === "destructive" &&
          "text-destructive [&_svg]:text-destructive focus:bg-destructive/10 focus:text-destructive",
      )}
      onSelect={onSelect}
    >
      {icon}
      {label}
    </ContextMenuPrimitive.Item>
  );
});

function RightSidebarItemContextMenu({
  actions,
  children,
}: {
  actions: RightSidebarContextAction[];
  children: ReactNode;
}) {
  if (actions.length === 0) {
    return <>{children}</>;
  }

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>{children}</ContextMenuPrimitive.Trigger>
      <RightSidebarContextMenuContent>
        {actions.map((action) => (
          <RightSidebarContextMenuItem
            key={action.key}
            label={action.label}
            icon={action.icon}
            onSelect={action.onSelect}
            variant={action.variant}
          />
        ))}
      </RightSidebarContextMenuContent>
    </ContextMenuPrimitive.Root>
  );
}

function RightSidebarSectionIcon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center text-primary [&_svg]:size-5 [&_svg]:stroke-[2.5px]">
      {children}
    </span>
  );
}

function RightSidebarSectionButton({
  icon,
  title,
  subtitle,
  onClick,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <Ripple asChild>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent/40"
        onClick={onClick}
      >
        <RightSidebarSectionIcon>{icon}</RightSidebarSectionIcon>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          {subtitle ? (
            <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>
        {trailing}
      </button>
    </Ripple>
  );
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function formatDuration(secondsValue: number) {
  const safe = Number.isFinite(secondsValue) && secondsValue > 0 ? Math.floor(secondsValue) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildWaveform(seed: string, bars = 36) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return Array.from({ length: bars }, (_, index) => {
    const value = Math.abs(Math.sin((hash + index * 37) * 0.00018));
    return Math.round(22 + value * 78);
  });
}

function resolveMediaEntries(items: Array<{
  messageId: string;
  authorId: string;
  text: string;
  createdAt: number;
  mediaKeys: string[];
}>): SharedMediaAsset[] {
  const all = items.flatMap((item) =>
    item.mediaKeys
      .filter(Boolean)
      .map((mediaKey, index) => ({
        id: `${item.messageId}:${index}:${mediaKey}`,
        messageId: item.messageId,
        mediaKey,
        url: resolveStorageFileUrl(mediaKey),
        kind: resolveChatMediaKind(mediaKey),
        createdAt: item.createdAt,
        authorId: item.authorId,
        text: item.text,
      })),
  );

  return all
    .filter((entry) => Boolean(entry.url))
    .sort((left, right) => right.createdAt - left.createdAt);
}

function resolveLinkEntries(items: Array<{
  messageId: string;
  authorId: string;
  text: string;
  createdAt: number;
}>): SharedLinkAsset[] {
  const links = items.flatMap((item) =>
    extractMessageUrls(item.text, 5).map((url) => ({
      id: `${item.messageId}:${url}`,
      messageId: item.messageId,
      url,
      createdAt: item.createdAt,
      authorId: item.authorId,
    })),
  );

  return uniqueById(links).sort((left, right) => right.createdAt - left.createdAt);
}

const RightSidebarVoiceRow = memo(function RightSidebarVoiceRow({
  id,
  duration,
  progress,
  isPlaying,
  createdAt,
  onToggle,
}: {
  id: string;
  duration: number;
  progress: number;
  isPlaying: boolean;
  createdAt: string;
  onToggle: () => void;
}) {
  const waveform = useMemo(() => buildWaveform(id), [id]);

  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex w-full items-center gap-2 rounded-xl bg-accent/40 px-2.5 py-2 text-left transition-colors hover:bg-accent/70"
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        {isPlaying ? <IoPause className="size-4" /> : <IoPlay className="size-4" />}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex h-8 items-end gap-px">
          {waveform.map((height, index) => {
            const threshold = ((index + 1) / waveform.length) * 100;
            const active = progress >= threshold;

            return (
              <span
                key={`${id}-wave-${index}`}
                className={cn(
                  "w-1 rounded-full transition-colors",
                  active ? "bg-primary" : "bg-muted-foreground/45",
                )}
                style={{ height: `${Math.max(2, Math.round((height / 100) * 30))}px` }}
              />
            );
          })}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {formatDuration((duration * progress) / 100)} / {formatDuration(duration)}
        </span>
      </span>

      <span className="shrink-0 text-xs text-muted-foreground">{createdAt}</span>
    </button>
  );
});

export function RightSidebar({ conversationId }: RightSidebarProps) {
  const t = useTranslations("rightSidebar");
  const locale = useLocale();
  const timeFormat = useGeneralSettingsStore((state) => state.timeFormat);
  const autoplayVideo = useGeneralSettingsStore(
    (state) => state.autoplayVideo && !state.powerSavingEnabled,
  );
  const router = useRouter();
  const { push } = useSidebar();
  const queryClient = useQueryClient();
  const { user: currentUser } = useCurrentUser();
  const { activeTab, setActiveTab, close } = useRightSidebar();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [tabDirection, setTabDirection] = useState<1 | -1>(1);
  const [screen, setScreen] = useState<RightSidebarScreen>("info");
  const [screenDirection, setScreenDirection] = useState<1 | -1>(1);
  const [isInfoScrolled, setIsInfoScrolled] = useState(false);
  const [infoScrollTop, setInfoScrollTop] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [membersSearchQuery, setMembersSearchQuery] = useState("");
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [activeImagePreview, setActiveImagePreview] = useState<SidebarPreviewState | null>(null);
  const [activeVideoPreview, setActiveVideoPreview] = useState<SidebarPreviewState | null>(null);
  const [previewZoomed, setPreviewZoomed] = useState(false);
  const [shouldPreviewVideoPlay, setShouldPreviewVideoPlay] = useState(false);
  const [isPreviewVideoPlaying, setIsPreviewVideoPlaying] = useState(false);
  const [isPreviewVideoMuted, setIsPreviewVideoMuted] = useState(false);
  const [previewVideoDuration, setPreviewVideoDuration] = useState(0);
  const [previewVideoCurrentTime, setPreviewVideoCurrentTime] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const conversationQuery = useConversationQuery(conversationId);
  const conversation = conversationQuery.data?.conversation ?? null;
  const isDirect = isDirectConversation(conversation);
  const peerId = isDirect
    ? (conversation?.members ?? []).find((member) => member.userId !== currentUser?.id)?.userId
    : undefined;

  const tabFilter = SIDEBAR_TAB_FILTER_MAP[activeTab];
  const shouldLoadSharedMedia = Boolean(tabFilter);
  const sharedMediaQuery = useChatSharedMedia(
    conversationId,
    tabFilter ?? CHAT_SHARED_MEDIA_FILTER.MEDIA,
    48,
    shouldLoadSharedMedia,
  );

  const sharedMediaItems = useMemo(
    () => sharedMediaQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [sharedMediaQuery.data?.pages],
  );

  const mediaEntries = useMemo(
    () =>
      resolveMediaEntries(sharedMediaItems).filter(
        (item) =>
          item.kind === CHAT_MEDIA_KIND.IMAGE ||
          item.kind === CHAT_MEDIA_KIND.VIDEO ||
          item.kind === CHAT_MEDIA_KIND.RING,
      ),
    [sharedMediaItems],
  );
  const fileEntries = useMemo(
    () => resolveMediaEntries(sharedMediaItems).filter((item) => item.kind === CHAT_MEDIA_KIND.FILE),
    [sharedMediaItems],
  );
  const voiceEntries = useMemo(
    () => resolveMediaEntries(sharedMediaItems).filter((item) => item.kind === CHAT_MEDIA_KIND.VOICE),
    [sharedMediaItems],
  );
  const linkEntries = useMemo(() => resolveLinkEntries(sharedMediaItems), [sharedMediaItems]);

  const authorIds = useMemo(
    () =>
      [
        ...new Set(
          [
            ...(conversation?.members ?? []).map((member) => member.userId),
            ...sharedMediaItems.map((item) => item.authorId),
          ].filter(Boolean),
        ),
      ] as string[],
    [conversation?.members, sharedMediaItems],
  );
  const { data: authorsMap } = useChatAuthors(authorIds);
  const peerUser = peerId ? (authorsMap?.[peerId] ?? null) : null;

  const availableTabs = useMemo(() => {
    const base: RightSidebarTab[] = [
      RIGHT_SIDEBAR_TAB.MEDIA,
      RIGHT_SIDEBAR_TAB.FILES,
      RIGHT_SIDEBAR_TAB.LINKS,
      RIGHT_SIDEBAR_TAB.VOICE,
    ];

    if (!isDirect) {
      base.push(RIGHT_SIDEBAR_TAB.MEMBERS);
    }

    return base;
  }, [isDirect]);

  useEffect(() => {
    if (availableTabs.includes(activeTab)) return;
    setActiveTab(availableTabs[0] ?? RIGHT_SIDEBAR_TAB.MEDIA);
  }, [activeTab, availableTabs, setActiveTab]);

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root || screen !== "info") {
      return;
    }

    const viewport = root.querySelector<HTMLDivElement>("[data-radix-scroll-area-viewport]");
    if (!viewport) return;

    const maybeLoadNext = () => {
      const nextScrollTop = viewport.scrollTop;
      setInfoScrollTop(nextScrollTop);
      setIsInfoScrolled(nextScrollTop > 84);

      if (!shouldLoadSharedMedia) {
        return;
      }

      if (
        !sharedMediaQuery.hasNextPage ||
        sharedMediaQuery.isFetchingNextPage ||
        sharedMediaQuery.isLoading
      ) {
        return;
      }

      const distanceToBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      if (distanceToBottom <= 320) {
        void sharedMediaQuery.fetchNextPage();
      }
    };

    maybeLoadNext();
    viewport.addEventListener("scroll", maybeLoadNext, { passive: true });
    return () => viewport.removeEventListener("scroll", maybeLoadNext);
  }, [
    activeTab,
    conversationId,
    screen,
    sharedMediaQuery,
    shouldLoadSharedMedia,
  ]);

  const handleTabChange = (value: string) => {
    const nextTab = value as RightSidebarTab;
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    const nextIndex = TAB_ORDER.indexOf(nextTab);

    if (currentIndex !== -1 && nextIndex !== -1) {
      setTabDirection(nextIndex >= currentIndex ? 1 : -1);
    }

    setActiveTab(nextTab);
  };

  const goToScreen = (nextScreen: RightSidebarScreen) => {
    if (nextScreen === screen) {
      return;
    }

    const currentIndex = SCREEN_ORDER.indexOf(screen);
    const nextIndex = SCREEN_ORDER.indexOf(nextScreen);

    if (currentIndex !== -1 && nextIndex !== -1) {
      setScreenDirection(nextIndex >= currentIndex ? 1 : -1);
    }

    setScreen(nextScreen);
  };

  const title = isDirect
    ? getUserDisplayName(peerUser, t("directFallback"))
    : conversation
      ? getConversationTitle(conversation)
      : "";
  const subtitle = isDirect
    ? peerUser?.username
      ? `@${peerUser.username}`
      : t("directFallback")
    : conversation
      ? getConversationSubtitle(conversation)
      : "";
  const avatarUrl = isDirect ? getUserAvatarUrl(peerUser) : getConversationAvatarUrl(conversation);
  const avatarFallback = isDirect
    ? getUserInitial(peerUser, title || "#")
    : conversation
      ? getConversationInitial(conversation)
      : "#";
  const avatarGradient = getAvatarGradient(peerId ?? conversationId);
  const conversationType = Number(conversation?.type ?? 0);
  const isChannel = conversationType === CHAT_CONVERSATION_TYPE.CHANNEL;
  const directAbout = (peerUser as { bio?: string } | null)?.bio?.trim() ?? "";

  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const [voiceProgress, setVoiceProgress] = useState<Record<string, number>>({});
  const [voiceDuration, setVoiceDuration] = useState<Record<string, number>>({});
  const voiceAudioRef = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => {
    Object.values(voiceAudioRef.current).forEach((audio) => audio?.pause());
  }, [conversationId, activeTab]);

  useEffect(() => {
    const audioNodes = voiceAudioRef.current;
    return () => {
      Object.values(audioNodes).forEach((audio) => audio?.pause());
    };
  }, []);

  const memberItems = useMemo(
    () =>
      (conversation?.members ?? [])
        .map((member) => ({
          ...member,
          user: authorsMap?.[member.userId] ?? null,
        }))
        .sort((left, right) => Number(left.role ?? 0) - Number(right.role ?? 0)),
    [authorsMap, conversation?.members],
  );

  const memberIds = useMemo(
    () => (conversation?.members ?? []).map((member) => member.userId).filter(Boolean),
    [conversation?.members],
  );
  const membersSearchValue = membersSearchQuery.trim().toLowerCase();
  const filteredMemberItems = useMemo(() => {
    if (!membersSearchValue) {
      return memberItems;
    }

    return memberItems.filter((member) => {
      const displayName = getUserDisplayName(member.user, "").toLowerCase();
      const username = (member.user?.username ?? "").toLowerCase();
      return displayName.includes(membersSearchValue) || username.includes(membersSearchValue);
    });
  }, [memberItems, membersSearchValue]);

  const addCandidatesQuery = useUsersList({
    query: candidateSearchQuery,
    excludeIds: [...memberIds, currentUser?.id ?? ""],
    limit: 40,
    enabled: !isDirect && screen === "add-members",
  });
  const addCandidates = useMemo(
    () => (addCandidatesQuery.data?.users ?? []).filter((user) => Boolean(user.id)),
    [addCandidatesQuery.data?.users],
  );
  const selectedCandidateIdSet = useMemo(() => new Set(selectedCandidateIds), [selectedCandidateIds]);

  const addMembersMutation = useMutation({
    mutationFn: (newMemberIds: string[]) =>
      conversationsControllerAddMembers({
        conversationId,
        memberIds: newMemberIds,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getConversationQueryKey(conversationId) });
      toast({
        title: t("members.added"),
        type: "info",
      });
      setSelectedCandidateIds([]);
      setCandidateSearchQuery("");
      goToScreen("members");
    },
    onError: () => {
      toast({
        title: t("members.addError"),
        type: "error",
      });
    },
  });

  const { mutateAsync: deleteMessages, isPending: isDeletingMessage } = useMessagesControllerDelete();
  const updateRoleMutation = useMutation({
    mutationFn: (payload: {
      targetUserId: string;
      role: UpdateMemberRoleRequestDtoRole;
    }) =>
      conversationsControllerUpdateRole({
        conversationId,
        targetUserId: payload.targetUserId,
        role: payload.role,
      }),
  });
  const removeMemberMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      conversationsControllerRemoveMember({
        conversationId,
        targetUserId,
      }),
  });
  const startDirectMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      conversationsControllerCreate({
        type: CreateConversationRequestDtoType.NUMBER_1,
        memberIds: [targetUserId],
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: getConversationsControllerMyQueryKey(),
      });

      if (response.conversation?.id) {
        router.push(`/${response.conversation.id}`);
      }
    },
  });

  const openMessage = (messageId: string) => {
    router.push(`/c/${conversationId}/${messageId}`);
  };

  const formatCreatedAt = (value: number) => formatTimestampTime(value, locale, { timeFormat });

  const openExternalLink = (url: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyText = async (value: string, title: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title,
        type: "info",
      });
    } catch {
      toast({
        title: t("context.copyError"),
        type: "error",
      });
    }
  };

  const downloadByMediaKey = async (mediaKey: string) => {
    if (!mediaKey) return;
    try {
      await downloadMediaByKey(mediaKey);
      toast({
        title: t("context.downloaded"),
        type: "info",
      });
    } catch {
      toast({
        title: t("context.downloadError"),
        type: "error",
      });
    }
  };

  const removeMessageFromCaches = (messageId: string) => {
    queryClient.setQueryData<ChatMessagesQueryData>(
      getChatMessagesQueryKey(conversationId),
      (currentData) => removeChatMessageFromData(currentData, messageId),
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
  };

  const invalidateSharedMedia = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["chat", "shared-media", conversationId],
    });
  };

  const canDeleteMessage = (entry: SharedMessageEntry) =>
    isChannel || entry.authorId === currentUser?.id;

  const handleDeleteMessage = async (entry: SharedMessageEntry) => {
    if (!canDeleteMessage(entry) || isDeletingMessage) {
      return false;
    }

    try {
      const response = await deleteMessages({
        data: {
          conversationId,
          messageIds: [entry.messageId],
        },
      });

      const deletedIds = (response.deletedMessageIds ?? []).filter(Boolean);
      const isDeleted =
        deletedIds.length > 0
          ? deletedIds.includes(entry.messageId)
          : !(response.failedMessageIds ?? []).includes(entry.messageId);

      if (!isDeleted) {
        throw new Error("Delete failed");
      }

      removeMessageFromCaches(entry.messageId);
      await invalidateSharedMedia();
      return true;
    } catch {
      toast({
        title: t("context.deleteError"),
        type: "error",
      });
      return false;
    }
  };

  const startSelectInChat = (messageId: string) => {
    const storageKey = `${CHAT_SELECT_STORAGE_KEY_PREFIX}:${conversationId}`;
    sessionStorage.setItem(storageKey, messageId);
    window.dispatchEvent(
      new CustomEvent(CHAT_SELECT_EVENT, {
        detail: { conversationId, messageId },
      }),
    );
    openMessage(messageId);
  };

  const closeMediaPreview = () => {
    previewVideoRef.current?.pause();
    setActiveImagePreview(null);
    setActiveVideoPreview(null);
    setPreviewZoomed(false);
    setShouldPreviewVideoPlay(false);
    setIsPreviewVideoPlaying(false);
    setIsPreviewVideoMuted(false);
    setPreviewVideoCurrentTime(0);
    setPreviewVideoDuration(0);
  };

  const openImagePreview = (item: SharedMediaAsset, layoutId: string) => {
    setActiveVideoPreview(null);
    setActiveImagePreview({
      messageId: item.messageId,
      mediaKey: item.mediaKey,
      url: item.url,
      kind: item.kind,
      layoutId,
    });
    setPreviewZoomed(false);
  };

  const openVideoPreview = (item: SharedMediaAsset, layoutId: string) => {
    setActiveImagePreview(null);
    setActiveVideoPreview({
      messageId: item.messageId,
      mediaKey: item.mediaKey,
      url: item.url,
      kind: item.kind,
      layoutId,
    });
    setPreviewZoomed(false);
    setShouldPreviewVideoPlay(autoplayVideo);
    setIsPreviewVideoMuted(autoplayVideo);
    setIsPreviewVideoPlaying(false);
    setPreviewVideoCurrentTime(0);
    setPreviewVideoDuration(0);
  };

  const handleTogglePreviewVideoPlay = () => {
    setShouldPreviewVideoPlay((current) => !current);
  };

  const handleTogglePreviewVideoMute = () => {
    setIsPreviewVideoMuted((current) => !current);
  };

  const handlePreviewVideoTimelineClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const video = previewVideoRef.current;
    if (!video || previewVideoDuration <= 0) return;

    const timelineRect = event.currentTarget.getBoundingClientRect();
    if (timelineRect.width <= 0) return;

    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - timelineRect.left) / timelineRect.width),
    );
    video.currentTime = ratio * previewVideoDuration;
    setPreviewVideoCurrentTime(video.currentTime);
  };

  const handleDownloadFromPreview = async () => {
    const mediaKey = activeImagePreview?.mediaKey ?? activeVideoPreview?.mediaKey;
    if (!mediaKey) return;
    await downloadByMediaKey(mediaKey);
  };

  const handleDeleteFromPreview = async () => {
    const messageId = activeImagePreview?.messageId ?? activeVideoPreview?.messageId;
    const authorId = mediaEntries.find((entry) => entry.messageId === messageId)?.authorId ?? "";
    if (!messageId) return;

    const deleted = await handleDeleteMessage({ messageId, authorId });
    if (deleted) {
      closeMediaPreview();
    }
  };

  const isPreviewOpen = Boolean(activeImagePreview || activeVideoPreview);
  const canUsePortal = typeof document !== "undefined";
  const previewVideoProgress = previewVideoDuration > 0
    ? Math.min(100, Math.max(0, (previewVideoCurrentTime / previewVideoDuration) * 100))
    : 0;
  const activePreviewMessageId = activeImagePreview?.messageId ?? activeVideoPreview?.messageId ?? "";
  const activePreviewAuthorId = activePreviewMessageId
    ? (mediaEntries.find((entry) => entry.messageId === activePreviewMessageId)?.authorId ?? "")
    : "";
  const canDeleteActivePreviewMessage = Boolean(
    activePreviewMessageId &&
      canDeleteMessage({
        messageId: activePreviewMessageId,
        authorId: activePreviewAuthorId,
      }),
  );

  useEffect(() => {
    if (!isPreviewOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMediaPreview();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isPreviewOpen]);

  useEffect(() => {
    if (!activeVideoPreview) return;
    setIsPreviewVideoMuted(autoplayVideo);
    setShouldPreviewVideoPlay(autoplayVideo);
    setIsPreviewVideoPlaying(false);
  }, [activeVideoPreview, autoplayVideo]);

  useEffect(() => {
    if (!activeVideoPreview) return;
    const video = previewVideoRef.current;
    if (!video) return;

    video.muted = isPreviewVideoMuted;
    video.defaultMuted = isPreviewVideoMuted;
  }, [activeVideoPreview, isPreviewVideoMuted]);

  useEffect(() => {
    if (!activeVideoPreview) return;

    const video = previewVideoRef.current;
    if (!video) return;

    if (!shouldPreviewVideoPlay) {
      video.pause();
      return;
    }

    void video.play().catch(() => {
      setShouldPreviewVideoPlay(false);
    });
  }, [activeVideoPreview, shouldPreviewVideoPlay]);

  const tabCounts: Record<RightSidebarTab, number> = {
    [RIGHT_SIDEBAR_TAB.MEDIA]: mediaEntries.length,
    [RIGHT_SIDEBAR_TAB.FILES]: fileEntries.length,
    [RIGHT_SIDEBAR_TAB.LINKS]: linkEntries.length,
    [RIGHT_SIDEBAR_TAB.VOICE]: voiceEntries.length,
    [RIGHT_SIDEBAR_TAB.MEMBERS]: memberItems.length,
  };
  const activeTabCount = tabCounts[activeTab] ?? 0;
  const activeTabLabel =
    activeTab === RIGHT_SIDEBAR_TAB.MEMBERS && isChannel
      ? t("sections.subscribers")
      : t(`tabs.${activeTab}`);

  const headerTitle = screen === "info"
    ? title
    : screen === "members"
      ? (isChannel ? t("sections.subscribers") : t("members.title"))
      : t("members.addTitle");
  const headerSubtitle = screen === "info"
    ? t("header.tabCounter", {
        tab: activeTabLabel,
        count: activeTabCount,
      })
    : screen === "members"
      ? t("header.membersCounter", { count: memberItems.length })
      : t("header.selectedCounter", { count: selectedCandidateIds.length });
  const showBackIcon = screen !== "info" || isInfoScrolled;
  const avatarCollapseProgress = Math.min(1, Math.max(0, infoScrollTop / 96));
  const showHeaderAvatar = screen === "info" && avatarCollapseProgress > 0.45;
  const currentMemberRole = Number(
    memberItems.find((member) => member.userId === currentUser?.id)?.role ?? 0,
  );
  const defaultMemberRole = isChannel
    ? UpdateMemberRoleRole.NUMBER_5
    : UpdateMemberRoleRole.NUMBER_4;
  const canEditInfo =
    screen === "info" &&
    Boolean(isDirect && currentUser?.id && peerId === currentUser.id);

  const scrollInfoToTop = () => {
    const root = scrollContainerRef.current;
    const viewport = root?.querySelector<HTMLDivElement>("[data-radix-scroll-area-viewport]");
    viewport?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEditInfo = () => {
    if (isDirect && currentUser?.id && peerId === currentUser.id) {
      push({ screen: "edit-profile", userId: currentUser.id });
      return;
    }

    toast({
      title: t("members.editUnavailable"),
      type: "info",
    });
  };

  const handleLeadingAction = () => {
    if (screen === "add-members") {
      goToScreen("members");
      return;
    }

    if (screen === "members") {
      goToScreen("info");
      return;
    }

    if (isInfoScrolled) {
      scrollInfoToTop();
      return;
    }

    close();
  };

  const handleToggleCandidate = (userId: string) => {
    setSelectedCandidateIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  const submitAddMembers = () => {
    if (selectedCandidateIds.length === 0 || addMembersMutation.isPending) {
      return;
    }

    addMembersMutation.mutate(selectedCandidateIds);
  };

  const handleWriteToMember = async (targetUserId: string) => {
    if (!targetUserId || targetUserId === currentUser?.id) return;

    try {
      const response = await startDirectMutation.mutateAsync(targetUserId);
      if (response.conversation?.id) {
        close();
      }
    } catch {
      toast({
        title: t("members.writeError"),
        type: "error",
      });
    }
  };

  const canManageMember = (targetUserId: string, targetRole: number) => {
    if (isDirect || targetUserId === currentUser?.id || targetRole === 1) {
      return false;
    }

    if (currentMemberRole === 1) {
      return true;
    }

    if (currentMemberRole === 2) {
      return targetRole > 2;
    }

    return false;
  };

  const handleUpdateMemberRole = async (
    targetUserId: string,
    role: UpdateMemberRoleRequestDtoRole,
    successMessage: string,
  ) => {
    try {
      await updateRoleMutation.mutateAsync({
        targetUserId,
        role,
      });

      await queryClient.invalidateQueries({ queryKey: getConversationQueryKey(conversationId) });
      toast({
        title: successMessage,
        type: "info",
      });
    } catch {
      toast({
        title: t("members.roleUpdateError"),
        type: "error",
      });
    }
  };

  const handleRemoveMemberFromConversation = async (targetUserId: string) => {
    try {
      await removeMemberMutation.mutateAsync(targetUserId);
      await queryClient.invalidateQueries({ queryKey: getConversationQueryKey(conversationId) });
      toast({
        title: t("members.removed"),
        type: "info",
      });
    } catch {
      toast({
        title: t("members.removeError"),
        type: "error",
      });
    }
  };

  const playVoice = async (voiceId: string, url: string) => {
    if (!url) return;

    let audioNode = voiceAudioRef.current[voiceId];
    if (!audioNode) {
      audioNode = new Audio(url);
      audioNode.preload = "metadata";
      const node = audioNode;

      node.addEventListener("timeupdate", () => {
        const duration = node.duration ?? 0;
        if (!Number.isFinite(duration) || duration <= 0) {
          setVoiceProgress((current) => ({ ...current, [voiceId]: 0 }));
          return;
        }

        const progress = Math.min(100, Math.max(0, (node.currentTime / duration) * 100));
        setVoiceProgress((current) => ({ ...current, [voiceId]: progress }));
      });

      node.addEventListener("loadedmetadata", () => {
        const duration = Number.isFinite(node.duration) ? node.duration : 0;
        setVoiceDuration((current) => ({ ...current, [voiceId]: Math.max(0, duration) }));
      });

      node.addEventListener("ended", () => {
        setActiveVoiceId((current) => (current === voiceId ? null : current));
        setVoiceProgress((current) => ({ ...current, [voiceId]: 100 }));
      });

      voiceAudioRef.current[voiceId] = node;
      audioNode = node;
    }

    if (!audioNode) return;

    if (activeVoiceId === voiceId && !audioNode.paused) {
      audioNode.pause();
      setActiveVoiceId(null);
      return;
    }

    Object.entries(voiceAudioRef.current).forEach(([id, node]) => {
      if (!node || id === voiceId) return;
      node.pause();
    });

    try {
      await audioNode.play();
      setActiveVoiceId(voiceId);
    } catch {
      setActiveVoiceId(null);
    }
  };

  if (!conversation) {
    return (
      <div className="flex h-full flex-col bg-sidebar">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="flex flex-col gap-2 px-4 py-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>
    );
  }

  const renderEmptyState = (label: string) => (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">{label}</div>
  );

  const buildMessageContextActions = (
    entry: SharedMessageEntry,
    extraActions: RightSidebarContextAction[] = [],
  ) => {
    const actions: RightSidebarContextAction[] = [
      {
        key: `${entry.messageId}:open`,
        label: t("context.goToMessage"),
        icon: <FiMessageCircle />,
        onSelect: () => openMessage(entry.messageId),
      },
      {
        key: `${entry.messageId}:select`,
        label: t("context.select"),
        icon: <FiCheckCircle />,
        onSelect: () => startSelectInChat(entry.messageId),
      },
      ...extraActions,
    ];

    if (canDeleteMessage(entry)) {
      actions.push({
        key: `${entry.messageId}:delete`,
        label: t("context.delete"),
        icon: <FiTrash2 />,
        variant: "destructive",
        onSelect: () => void handleDeleteMessage(entry),
      });
    }

    return actions;
  };

  const renderMemberRows = (membersList: typeof memberItems) => {
    if (membersList.length === 0) {
      return renderEmptyState(t("empty.members"));
    }

    return (
      <div className="space-y-1.5">
        {membersList.map((member) => {
          const displayName = getUserDisplayName(member.user, t("unknownUser"));
          const roleKey =
            MEMBER_ROLE_LABEL_KEY[Number(member.role ?? 0)] ?? "memberRole.member";
          const avatar = getUserAvatarUrl(member.user);
          const initial = getUserInitial(member.user, displayName || member.userId);
          const memberAvatarGradient = getAvatarGradient(member.userId || conversationId);
          const username = member.user?.username ? `@${member.user.username}` : "";
          const targetRole = Number(member.role ?? 0);
          const canManageTarget = canManageMember(member.userId, targetRole);
          const canPromoteToAdmin = canManageTarget && targetRole !== 2;
          const canRestrictRights = canManageTarget && targetRole !== Number(defaultMemberRole);
          const canRemoveTarget = canManageTarget;
          const copyValue = username || displayName || member.userId;
          const actions: RightSidebarContextAction[] = [
            {
              key: `${member.userId}:write`,
              label: t("context.write"),
              icon: <FiMessageCircle />,
              onSelect: () => void handleWriteToMember(member.userId),
            },
            {
              key: `${member.userId}:copy`,
              label: t("context.copyUser"),
              icon: <FiCopy />,
              onSelect: () => void copyText(copyValue, t("context.userCopied")),
            },
          ];

          if (canPromoteToAdmin) {
            actions.push({
              key: `${member.userId}:make-admin`,
              label: t("context.makeAdmin"),
              icon: <FiEdit2 />,
              onSelect: () =>
                void handleUpdateMemberRole(
                  member.userId,
                  UpdateMemberRoleRole.NUMBER_2,
                  t("members.adminGranted"),
                ),
            });
          }

          if (canRestrictRights) {
            actions.push({
              key: `${member.userId}:restrict`,
              label: t("context.restrictRights"),
              icon: <FiCheckCircle />,
              onSelect: () =>
                void handleUpdateMemberRole(
                  member.userId,
                  defaultMemberRole,
                  t("members.rightsRestricted"),
                ),
            });
          }

          if (canRemoveTarget) {
            actions.push({
              key: `${member.userId}:remove`,
              label: t("context.removeMember"),
              icon: <FiTrash2 />,
              variant: "destructive",
              onSelect: () => void handleRemoveMemberFromConversation(member.userId),
            });
          }

          return (
            <RightSidebarItemContextMenu key={member.userId} actions={actions}>
              <Ripple asChild>
                <motion.button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl bg-accent/30 px-3 py-2 text-left"
                  whileTap={{ scale: 0.992 }}
                  transition={{ duration: 0.12 }}
                >
                  <Avatar
                    className={cn(
                      "size-10",
                      !avatar ? `bg-linear-to-br ${memberAvatarGradient} text-white` : "",
                    )}
                  >
                    {avatar ? <AvatarImage src={avatar} alt="" /> : null}
                    <AvatarFallback className={!avatar ? "bg-transparent text-white" : ""}>
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{t(roleKey)}</p>
                  </div>
                </motion.button>
              </Ripple>
            </RightSidebarItemContextMenu>
          );
        })}
      </div>
    );
  };

  const renderTabContent = () => {
    if (activeTab === RIGHT_SIDEBAR_TAB.MEDIA) {
      if (sharedMediaQuery.isLoading) {
        return (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={`media-skeleton-${index}`} className="aspect-square w-full rounded-lg" />
            ))}
          </div>
        );
      }

      if (mediaEntries.length === 0) {
        return renderEmptyState(t("empty.media"));
      }

      return (
        <div className="grid grid-cols-3 gap-1.5">
          {mediaEntries.map((item) => {
            const layoutId = `right-sidebar-media-${item.id}`;
            const actions = buildMessageContextActions(
              {
                messageId: item.messageId,
                authorId: item.authorId,
              },
              [
                {
                  key: `${item.id}:download`,
                  label: t("context.download"),
                  icon: <FiDownload />,
                  onSelect: () => void downloadByMediaKey(item.mediaKey),
                },
              ],
            );

            return (
              <RightSidebarItemContextMenu key={item.id} actions={actions}>
                <Ripple asChild>
                  <motion.button
                    type="button"
                    className="group relative aspect-square overflow-hidden rounded-lg bg-background"
                    onClick={() => {
                      if (item.kind === CHAT_MEDIA_KIND.IMAGE) {
                        openImagePreview(item, layoutId);
                        return;
                      }

                      openVideoPreview(item, layoutId);
                    }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {item.kind === CHAT_MEDIA_KIND.IMAGE ? (
                      <motion.img
                        layoutId={layoutId}
                        src={item.url}
                        alt=""
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : (
                      <motion.video
                        layoutId={layoutId}
                        src={item.url}
                        className={cn(
                          "size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]",
                          item.kind === CHAT_MEDIA_KIND.RING ? "rounded-full" : "",
                        )}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    )}
                    <span className="pointer-events-none absolute inset-x-1 bottom-1 rounded bg-black/55 px-1 py-0.5 text-[10px] text-white">
                      {formatCreatedAt(item.createdAt)}
                    </span>
                  </motion.button>
                </Ripple>
              </RightSidebarItemContextMenu>
            );
          })}
        </div>
      );
    }

    if (activeTab === RIGHT_SIDEBAR_TAB.FILES) {
      if (sharedMediaQuery.isLoading) {
        return (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={`file-skeleton-${index}`} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        );
      }

      if (fileEntries.length === 0) {
        return renderEmptyState(t("empty.files"));
      }

      return (
        <div className="space-y-2">
          {fileEntries.map((item) => {
            const actions = buildMessageContextActions(
              {
                messageId: item.messageId,
                authorId: item.authorId,
              },
              [
                {
                  key: `${item.id}:download`,
                  label: t("context.download"),
                  icon: <FiDownload />,
                  onSelect: () => void downloadByMediaKey(item.mediaKey),
                },
              ],
            );

            return (
              <RightSidebarItemContextMenu key={item.id} actions={actions}>
                <Ripple asChild>
                  <motion.button
                    type="button"
                    onClick={() => openMessage(item.messageId)}
                    className="flex w-full items-center gap-3 rounded-xl bg-accent/40 px-3 py-2 text-left transition-colors hover:bg-accent/70"
                    whileTap={{ scale: 0.995 }}
                    transition={{ duration: 0.16 }}
                  >
                    <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <IoDocumentTextOutline className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{getMediaLabel(item.mediaKey)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatCreatedAt(item.createdAt)}
                      </span>
                    </span>
                  </motion.button>
                </Ripple>
              </RightSidebarItemContextMenu>
            );
          })}
        </div>
      );
    }

    if (activeTab === RIGHT_SIDEBAR_TAB.LINKS) {
      if (sharedMediaQuery.isLoading) {
        return (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={`links-skeleton-${index}`} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        );
      }

      if (linkEntries.length === 0) {
        return renderEmptyState(t("empty.links"));
      }

      return (
        <div className="space-y-2">
          {linkEntries.map((entry) => {
            const author = authorsMap?.[entry.authorId] ?? null;
            const authorLabel = !isDirect
              ? getUserDisplayName(author, t("unknownUser"))
              : "";
            const actions = buildMessageContextActions(
              {
                messageId: entry.messageId,
                authorId: entry.authorId,
              },
              [
                {
                  key: `${entry.id}:open-link`,
                  label: t("context.openLink"),
                  icon: <FiExternalLink />,
                  onSelect: () => openExternalLink(entry.url),
                },
                {
                  key: `${entry.id}:copy-link`,
                  label: t("context.copyLink"),
                  icon: <FiCopy />,
                  onSelect: () => void copyText(entry.url, t("context.linkCopied")),
                },
              ],
            );

            return (
              <RightSidebarItemContextMenu key={entry.id} actions={actions}>
                <Ripple asChild>
                  <motion.div
                    className="rounded-xl bg-accent/30 p-2"
                    whileTap={{ scale: 0.995 }}
                    transition={{ duration: 0.16 }}
                  >
                    <button
                      type="button"
                      onClick={() => openMessage(entry.messageId)}
                      className="mb-1 inline-flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-xs text-muted-foreground hover:bg-accent/60"
                    >
                      <IoLinkOutline className="size-4" />
                      <span className="truncate">{stripMessageFormatting(entry.url)}</span>
                      <span className="ml-auto shrink-0">{formatCreatedAt(entry.createdAt)}</span>
                    </button>
                    {authorLabel ? (
                      <p className="mb-1 px-1 text-[11px] text-muted-foreground">{authorLabel}</p>
                    ) : null}
                    <ChatMessageLinkPreview url={entry.url} isOwn={false} />
                  </motion.div>
                </Ripple>
              </RightSidebarItemContextMenu>
            );
          })}
        </div>
      );
    }

    if (activeTab === RIGHT_SIDEBAR_TAB.VOICE) {
      if (sharedMediaQuery.isLoading) {
        return (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={`voice-skeleton-${index}`} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        );
      }

      if (voiceEntries.length === 0) {
        return renderEmptyState(t("empty.voice"));
      }

      return (
        <div className="space-y-2">
          {voiceEntries.map((entry) => {
            const voiceId = `${entry.messageId}:${entry.mediaKey}`;
            const progress = voiceProgress[voiceId] ?? 0;
            const duration = voiceDuration[voiceId] ?? 0;
            const isPlaying = activeVoiceId === voiceId;
            const actions = buildMessageContextActions(
              {
                messageId: entry.messageId,
                authorId: entry.authorId,
              },
              [
                {
                  key: `${voiceId}:download`,
                  label: t("context.download"),
                  icon: <FiDownload />,
                  onSelect: () => void downloadByMediaKey(entry.mediaKey),
                },
              ],
            );

            return (
              <RightSidebarItemContextMenu key={voiceId} actions={actions}>
                <Ripple asChild>
                  <motion.div whileTap={{ scale: 0.995 }} transition={{ duration: 0.16 }}>
                    <RightSidebarVoiceRow
                      id={voiceId}
                      duration={duration}
                      progress={progress}
                      isPlaying={isPlaying}
                      createdAt={formatCreatedAt(entry.createdAt)}
                      onToggle={() => void playVoice(voiceId, entry.url)}
                    />
                  </motion.div>
                </Ripple>
              </RightSidebarItemContextMenu>
            );
          })}
        </div>
      );
    }

    return renderMemberRows(memberItems);
  };

  const membersLabel = isChannel ? t("sections.subscribers") : t("members.title");
  const usernameLabel = isDirect
    ? peerUser?.username
      ? `@${peerUser.username}`
      : ""
    : conversation?.username
      ? `@${conversation.username}`
      : "";
  const aboutLabel = isDirect ? directAbout : (conversation?.about?.trim() ?? "");

  const infoScreen = (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollContainerRef} className="h-full min-h-0">
        <ScrollArea className="h-full">
          <section className="border-b px-4 pb-4 pt-5">
            <div className="flex flex-col items-center text-center">
              <AnimatePresence mode="wait" initial={false}>
                {!showHeaderAvatar ? (
                  <motion.div
                    key="profile-avatar"
                    layoutId="right-sidebar-avatar"
                    animate={{
                      scale: 1 - avatarCollapseProgress * 0.24,
                      y: -avatarCollapseProgress * 10,
                      opacity: 1 - avatarCollapseProgress * 0.12,
                    }}
                    exit={{ opacity: 0, scale: 0.84 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Avatar
                      className={cn(
                        "size-24",
                        !avatarUrl ? `bg-linear-to-br ${avatarGradient} text-white` : "",
                      )}
                    >
                      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                      <AvatarFallback className={!avatarUrl ? "bg-transparent text-2xl text-white" : ""}>
                        {avatarFallback}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                ) : (
                  <motion.div
                    key="profile-avatar-space"
                    className="size-24"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.001 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>
              <motion.h3
                className="mt-3 max-w-full truncate text-lg font-semibold"
                animate={{ opacity: 1 - avatarCollapseProgress }}
                transition={{ duration: 0.12 }}
              >
                {title}
              </motion.h3>
              <motion.p
                className="mt-1 max-w-full truncate text-sm text-muted-foreground"
                animate={{ opacity: Math.max(0.25, 1 - avatarCollapseProgress * 1.2) }}
                transition={{ duration: 0.12 }}
              >
                {subtitle}
              </motion.p>
            </div>
          </section>

          <section className="space-y-1 border-b px-2 py-2">
            {!isDirect ? (
              <RightSidebarSectionButton
                icon={<IoPeopleOutline />}
                title={membersLabel}
                subtitle={t("header.membersCounter", { count: memberItems.length })}
                onClick={() => goToScreen("members")}
                trailing={<IoChevronForward className="size-5 text-primary" />}
              />
            ) : null}

            {usernameLabel ? (
              <RightSidebarSectionButton
                icon={<IoAtOutline />}
                title={t("sections.username")}
                subtitle={usernameLabel}
                onClick={() => void copyText(usernameLabel, t("context.userCopied"))}
              />
            ) : null}

            {aboutLabel ? (
              <RightSidebarSectionButton
                icon={<IoInformationCircleOutline />}
                title={t("sections.about")}
                subtitle={aboutLabel}
              />
            ) : null}

            {!isDirect ? (
              <>
                <Ripple asChild>
                  <label className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/40">
                    <RightSidebarSectionIcon>
                      <IoNotificationsOutline />
                    </RightSidebarSectionIcon>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t("members.notifications")}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {notificationsEnabled ? t("sections.enabled") : t("sections.disabled")}
                      </span>
                    </span>
                    <Switch
                      checked={notificationsEnabled}
                      onCheckedChange={setNotificationsEnabled}
                    />
                  </label>
                </Ripple>
              </>
            ) : null}
          </section>

          <section className="sticky top-0 z-20 border-b bg-sidebar px-2 pt-2">
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
            >
              <TabsList className="w-full justify-start gap-0.5 overflow-x-auto px-2 pb-1 [&::-webkit-scrollbar]:hidden">
                <TabsTrigger value={RIGHT_SIDEBAR_TAB.MEDIA} className="px-3 py-2 text-xs">
                  {t("tabs.media")}
                </TabsTrigger>
                <TabsTrigger value={RIGHT_SIDEBAR_TAB.FILES} className="px-3 py-2 text-xs">
                  {t("tabs.files")}
                </TabsTrigger>
                <TabsTrigger value={RIGHT_SIDEBAR_TAB.LINKS} className="px-3 py-2 text-xs">
                  {t("tabs.links")}
                </TabsTrigger>
                <TabsTrigger value={RIGHT_SIDEBAR_TAB.VOICE} className="px-3 py-2 text-xs">
                  {t("tabs.voice")}
                </TabsTrigger>
                {!isDirect ? (
                  <TabsTrigger value={RIGHT_SIDEBAR_TAB.MEMBERS} className="px-3 py-2 text-xs">
                    {membersLabel}
                  </TabsTrigger>
                ) : null}
              </TabsList>
            </Tabs>
          </section>

          <div className="px-3 pb-5 pt-3">
            <div className="grid min-h-[120px] overflow-hidden">
              <AnimatePresence initial={false} custom={tabDirection} mode="sync">
                <motion.div
                  key={activeTab}
                  custom={tabDirection}
                  className="col-start-1 row-start-1"
                  initial={{ x: tabDirection === 1 ? "100%" : "-100%" }}
                  animate={{ x: "0%" }}
                  exit={{ x: tabDirection === 1 ? "-100%" : "100%" }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                >
                  {renderTabContent()}
                </motion.div>
              </AnimatePresence>
            </div>

            {shouldLoadSharedMedia && sharedMediaQuery.isFetchingNextPage ? (
              <div className="mt-3 space-y-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>

      <AnimatePresence>
        {!isDirect && activeTab === RIGHT_SIDEBAR_TAB.MEMBERS ? (
          <motion.div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-end p-4"
            initial={{ y: 72 }}
            animate={{ y: 0 }}
            exit={{ y: 72 }}
            transition={SCREEN_TRANSITION}
          >
            <Button
              type="button"
              className="pointer-events-auto size-14 rounded-full bg-primary text-primary-foreground shadow-none [&_svg]:size-7"
              onClick={() => goToScreen("add-members")}
            >
              <FiPlus />
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  const membersScreen = (
    <div className="relative min-h-0 flex-1">
      <ScrollArea className="h-full">
        <div className="px-3 pb-5 pt-3">
          <Input
            value={membersSearchQuery}
            onChange={(event) => setMembersSearchQuery(event.target.value)}
            leftSlot={<IoSearch className="text-muted-foreground" />}
            placeholder={t("members.searchPlaceholder")}
            className="w-full"
          />

          <div className="mt-3">{renderMemberRows(filteredMemberItems)}</div>
        </div>
      </ScrollArea>

      {!isDirect ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-end p-4">
          <Button
            type="button"
            className="pointer-events-auto size-14 rounded-full bg-primary text-primary-foreground shadow-none [&_svg]:size-7"
            onClick={() => goToScreen("add-members")}
          >
            <FiPlus />
          </Button>
        </div>
      ) : null}
    </div>
  );

  const addMembersScreen = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2.5">
        <Input
          value={candidateSearchQuery}
          onChange={(event) => setCandidateSearchQuery(event.target.value)}
          leftSlot={<IoSearch className="text-muted-foreground" />}
          placeholder={t("members.searchUsersPlaceholder")}
          className="w-full"
        />
      </div>

      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="space-y-1.5 px-3 py-3">
            {addCandidatesQuery.isLoading ? (
              <>
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </>
            ) : addCandidates.length === 0 ? (
              renderEmptyState(t("members.emptySearch"))
            ) : (
              addCandidates.map((user) => {
                const userId = user.id as string;
                const displayName = getUserDisplayName(user, t("unknownUser"));
                const username = user.username ? `@${user.username}` : "";
                const isSelected = selectedCandidateIdSet.has(userId);
                const avatar = getUserAvatarUrl(user);
                const initial = getUserInitial(user, displayName || "#");
                const userAvatarGradient = getAvatarGradient(userId || conversationId);

                return (
                  <Ripple key={userId} asChild>
                    <motion.button
                      type="button"
                      onClick={() => handleToggleCandidate(userId)}
                      className="flex w-full items-center gap-3 rounded-xl bg-accent/30 px-3 py-2 text-left"
                      whileTap={{ scale: 0.992 }}
                    >
                      <Avatar
                        className={cn(
                          "size-10",
                          !avatar ? `bg-linear-to-br ${userAvatarGradient} text-white` : "",
                        )}
                      >
                        {avatar ? <AvatarImage src={avatar} alt="" /> : null}
                        <AvatarFallback className={!avatar ? "bg-transparent text-white" : ""}>
                          {initial}
                        </AvatarFallback>
                      </Avatar>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{displayName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {username || t("unknownUser")}
                        </span>
                      </span>

                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full border transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-transparent",
                        )}
                      >
                        <FiCheck className="size-4" />
                      </span>
                    </motion.button>
                  </Ripple>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="border-t px-3 py-3">
        <Button
          type="button"
          className="h-11 w-full rounded-xl"
          disabled={selectedCandidateIds.length === 0 || addMembersMutation.isPending}
          onClick={submitAddMembers}
        >
          {addMembersMutation.isPending
            ? t("members.adding")
            : t("members.addSelected", { count: selectedCandidateIds.length })}
        </Button>
      </div>
    </div>
  );

  return (
    <LayoutGroup id={`right-sidebar:${conversationId}`}>
      <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="sticky top-0 z-30 border-b bg-sidebar px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-full text-primary [&_svg]:size-6"
            onClick={handleLeadingAction}
            aria-label={showBackIcon ? t("goBackAriaLabel") : t("backAriaLabel")}
          >
            <AnimatePresence mode="wait" initial={false}>
              {showBackIcon ? (
                <motion.span
                  key="back-icon"
                  initial={{ rotate: -90, scale: 0.84, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ rotate: 90, scale: 0.84, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <IoChevronBack />
                </motion.span>
              ) : (
                <motion.span
                  key="close-icon"
                  initial={{ rotate: 90, scale: 0.84, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ rotate: -90, scale: 0.84, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <IoClose />
                </motion.span>
              )}
            </AnimatePresence>
          </Button>

          <AnimatePresence initial={false}>
            {showHeaderAvatar ? (
              <motion.div
                layoutId="right-sidebar-avatar"
                key="header-avatar"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              >
                <Avatar
                  className={cn(
                    "size-9",
                    !avatarUrl ? `bg-linear-to-br ${avatarGradient} text-white` : "",
                  )}
                >
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                  <AvatarFallback className={!avatarUrl ? "bg-transparent text-white" : ""}>
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={`header-title:${screen}`}
                initial={{ x: 16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -16, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="truncate text-base font-semibold"
              >
                {headerTitle}
              </motion.p>
            </AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={`header-subtitle:${screen}:${activeTab}:${activeTabCount}:${selectedCandidateIds.length}`}
                initial={{ x: 16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -16, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="truncate text-xs text-muted-foreground"
              >
                {headerSubtitle}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-1">
            {canEditInfo ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-full text-primary [&_svg]:size-6"
                onClick={handleEditInfo}
                aria-label={t("members.editAriaLabel")}
              >
                <IoCreateOutline />
              </Button>
            ) : null}

            {screen === "members" && !isDirect ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-full text-primary [&_svg]:size-6"
                onClick={() => goToScreen("add-members")}
                aria-label={t("members.addAriaLabel")}
              >
                <FiPlus />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={screenDirection} mode="sync">
          <motion.div
            key={screen}
            custom={screenDirection}
            className="col-start-1 row-start-1 flex min-h-0 flex-col bg-sidebar"
            initial={{
              x: screenDirection === 1 ? "100%" : "-18%",
              opacity: screenDirection === 1 ? 1 : 0.78,
            }}
            animate={{
              x: "0%",
              opacity: 1,
            }}
            exit={{
              x: screenDirection === 1 ? "-18%" : "100%",
              opacity: screenDirection === 1 ? 0.78 : 1,
            }}
            transition={SCREEN_TRANSITION}
          >
            {screen === "info"
              ? infoScreen
              : screen === "members"
                ? membersScreen
                : addMembersScreen}
          </motion.div>
        </AnimatePresence>
      </div>
      </div>

      {canUsePortal
        ? createPortal(
            <AnimatePresence>
              {activeImagePreview ? (
                <motion.div
                  className="fixed inset-0 z-[120] flex h-screen w-screen items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.button
                    type="button"
                    aria-label={t("preview.close")}
                    className="absolute inset-0 bg-black/80"
                    onClick={closeMediaPreview}
                  />

                  <div className="pointer-events-none absolute inset-x-0 top-0 z-[130] flex justify-end p-3 sm:p-4">
                    <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/65 p-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full text-white hover:bg-white/15 hover:text-white"
                        onClick={closeMediaPreview}
                        aria-label={t("preview.close")}
                      >
                        <IoClose className="size-5" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full text-white hover:bg-white/15 hover:text-white"
                        onClick={() => setPreviewZoomed((current) => !current)}
                        aria-label={previewZoomed ? t("preview.zoomOut") : t("preview.zoomIn")}
                      >
                        {previewZoomed ? (
                          <IoRemove className="size-5" />
                        ) : (
                          <IoAdd className="size-5" />
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full text-white hover:bg-white/15 hover:text-white"
                        onClick={() => void handleDownloadFromPreview()}
                        aria-label={t("preview.download")}
                      >
                        <IoDownloadOutline className="size-5" />
                      </Button>

                      {canDeleteActivePreviewMessage ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10 rounded-full text-red-300 hover:bg-red-400/20 hover:text-red-200"
                          onClick={() => void handleDeleteFromPreview()}
                          disabled={isDeletingMessage}
                          aria-label={t("preview.delete")}
                        >
                          <IoTrashOutline className="size-5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <motion.img
                    layoutId={activeImagePreview.layoutId}
                    src={activeImagePreview.url}
                    alt=""
                    className={cn(
                      "relative z-[122] max-h-[84vh] max-w-[84vw] rounded-2xl object-contain transition-transform duration-250 ease-out",
                      previewZoomed ? "scale-[1.15] cursor-zoom-out" : "scale-100 cursor-zoom-in",
                    )}
                    onClick={() => setPreviewZoomed((current) => !current)}
                  />
                </motion.div>
              ) : null}

              {activeVideoPreview ? (
                <motion.div
                  className="fixed inset-0 z-[120] flex h-screen w-screen items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.button
                    type="button"
                    aria-label={t("preview.close")}
                    className="absolute inset-0 bg-black/85"
                    onClick={closeMediaPreview}
                  />

                  <div className="relative z-[122] flex w-full flex-col items-center px-4 pb-5 pt-16">
                    <motion.video
                      ref={previewVideoRef}
                      layoutId={activeVideoPreview.layoutId}
                      src={activeVideoPreview.url}
                      playsInline
                      preload="metadata"
                      className="max-h-[70vh] w-full max-w-[84vw] rounded-2xl bg-black object-contain"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleTogglePreviewVideoPlay();
                      }}
                      onLoadedMetadata={(event) =>
                        setPreviewVideoDuration(
                          Number.isFinite(event.currentTarget.duration)
                            ? event.currentTarget.duration
                            : 0,
                        )}
                      onTimeUpdate={(event) =>
                        setPreviewVideoCurrentTime(
                          Number.isFinite(event.currentTarget.currentTime)
                            ? event.currentTarget.currentTime
                            : 0,
                        )}
                      onPlay={() => {
                        setIsPreviewVideoPlaying(true);
                        setShouldPreviewVideoPlay(true);
                      }}
                      onPause={() => {
                        setIsPreviewVideoPlaying(false);
                        setShouldPreviewVideoPlay(false);
                      }}
                      onVolumeChange={(event) =>
                        setIsPreviewVideoMuted(event.currentTarget.muted)}
                    />

                    <div
                      className="mt-4 w-full max-w-[84vw] rounded-[1.3rem] border border-white/15 bg-black/65 p-3 sm:max-w-3xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="relative block h-2.5 w-full overflow-hidden rounded-full bg-white/20"
                        onClick={handlePreviewVideoTimelineClick}
                        aria-label={t("preview.seekVideo")}
                      >
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-primary"
                          style={{ width: `${previewVideoProgress}%` }}
                        />
                      </button>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={VIDEO_PREVIEW_CONTROL_BUTTON_CLASS}
                            onClick={handleTogglePreviewVideoPlay}
                            aria-label={isPreviewVideoPlaying ? t("preview.pauseVideo") : t("preview.playVideo")}
                          >
                            {isPreviewVideoPlaying ? (
                              <IoPause />
                            ) : (
                              <IoPlay className="translate-x-[1px]" />
                            )}
                          </button>

                          <button
                            type="button"
                            className={VIDEO_PREVIEW_CONTROL_BUTTON_CLASS}
                            onClick={handleTogglePreviewVideoMute}
                            aria-label={isPreviewVideoMuted ? t("preview.unmuteVideo") : t("preview.muteVideo")}
                          >
                            {isPreviewVideoMuted ? <IoVolumeMute /> : <IoVolumeHigh />}
                          </button>

                          <button
                            type="button"
                            className={VIDEO_PREVIEW_CONTROL_BUTTON_CLASS}
                            onClick={() => void handleDownloadFromPreview()}
                            aria-label={t("preview.download")}
                          >
                            <IoDownloadOutline />
                          </button>

                          {canDeleteActivePreviewMessage ? (
                            <button
                              type="button"
                              className={cn(VIDEO_PREVIEW_CONTROL_BUTTON_CLASS, "text-red-300 hover:text-red-200")}
                              onClick={() => void handleDeleteFromPreview()}
                              disabled={isDeletingMessage}
                              aria-label={t("preview.delete")}
                            >
                              <IoTrashOutline />
                            </button>
                          ) : null}
                        </div>

                        <span className="text-sm font-semibold tabular-nums text-white/90">
                          {formatDuration(previewVideoCurrentTime)} / {formatDuration(previewVideoDuration)}
                        </span>

                        <button
                          type="button"
                          className={VIDEO_PREVIEW_CONTROL_BUTTON_CLASS}
                          onClick={closeMediaPreview}
                          aria-label={t("preview.close")}
                        >
                          <IoClose />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </LayoutGroup>
  );
}
