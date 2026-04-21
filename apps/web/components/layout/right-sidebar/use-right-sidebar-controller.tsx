"use client";

import {
  type ConversationMemberResponseDtoRole,
  ConversationMemberResponseDtoState,
  type GetConversationResponseDto,
  type ListMyConversationsResponseDto,
  type UpdateMemberRoleRequestDtoRole,
  CreateConversationRequestDtoType,
  UpdateMemberRoleRequestDtoRole as UpdateMemberRoleRole,
  conversationsControllerAddMembers,
  conversationsControllerCreate,
  conversationsControllerDelete,
  conversationsControllerRemoveMember,
  conversationsControllerUpdate,
  conversationsControllerUpdateRole,
  getConversationsControllerMyQueryKey,
  useConversationsControllerMy,
  useUsersControllerMe,
  useMessagesControllerDelete,
} from "@/api/generated";
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
  useChatAuthors,
  useConversationQuery,
  useConversationUsernameQuery,
  useRouteUserQuery,
} from "@/hooks/use-chat";
import { useConversationNotifications } from "@/hooks/use-conversation-notifications";
import { rightSidebarStore } from "@/store/right-sidebar/right-sidebar.store";
import { sidebarStore } from "@/store/sidebar/sidebar.store";
import { useUsersList } from "@/hooks/use-users-list";
import { formatBirthDateWithAge } from "@/lib/birth-date";
import {
  CHAT_CONVERSATION_TYPE,
  CHAT_MEDIA_KIND,
  formatTimestampTime,
  getConversationAvatarUrl,
  getConversationInitial,
  getConversationTitle,
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
  isBotProjectionUserId,
  isDirectConversation,
  resolveStorageFileUrl,
} from "@/lib/chat";
import {
  CHAT_SELECT_EVENT,
  CHAT_SELECT_STORAGE_KEY_PREFIX,
} from "@/lib/chat.constants";
import {
  buildConversationPath,
  decodeConversationLocator,
  isUsernameConversationLocator,
  normalizeConversationUsername,
} from "@/lib/chat-routes";
import {
  buildDirectConversationPath,
  createVirtualDirectConversation,
  buildUserDirectPath,
  findDirectConversationWithUser,
} from "@/lib/direct-chat";
import { downloadMediaByKey } from "@/lib/download-media";
import { deleteConversationMedia } from "@/lib/upload-conversation-media";
import { uploadConversationAvatar } from "@/lib/upload-conversation-avatar";
import {
  RIGHT_SIDEBAR_TAB,
  type RightSidebarTab,
} from "@/store/right-sidebar/right-sidebar.types";
import { useGeneralSettingsStore } from "@/store/settings/general-settings.store";
import { toast } from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  type MouseEvent,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiCheckCircle, FiMessageCircle, FiTrash2 } from "react-icons/fi";
import type { SidebarInviteLinkItem } from "./manage-overview-screen";
import { buildRightSidebarHeaderState, getRightSidebarPreviousScreen } from "./screen-navigation";
import { buildRightSidebarScreenNodes } from "./screen-nodes";
import type {
  ConversationLike,
  MemberListItem,
  RightSidebarContextAction,
  RightSidebarScreen,
  SharedMessageEntry,
  SharedMediaAsset,
  SidebarPreviewState,
} from "./types";
import {
  RIGHT_SIDEBAR_SCREEN_ORDER,
  RIGHT_SIDEBAR_TAB_ORDER,
  buildMonthGroups,
  formatDuration,
  getMemberRoleRank,
  isChannelConversation,
  isGroupConversation,
  normalizePublicLink,
  resolveLinkEntries,
  resolveMediaEntries,
} from "./utils";

const SIDEBAR_TAB_FILTER_MAP: Record<RightSidebarTab, ChatSharedMediaFilter> = {
  [RIGHT_SIDEBAR_TAB.MEDIA]: CHAT_SHARED_MEDIA_FILTER.MEDIA,
  [RIGHT_SIDEBAR_TAB.FILES]: CHAT_SHARED_MEDIA_FILTER.FILES,
  [RIGHT_SIDEBAR_TAB.LINKS]: CHAT_SHARED_MEDIA_FILTER.LINKS,
  [RIGHT_SIDEBAR_TAB.VOICE]: CHAT_SHARED_MEDIA_FILTER.VOICE,
};

const AVAILABLE_TABS: RightSidebarTab[] = [
  RIGHT_SIDEBAR_TAB.MEDIA,
  RIGHT_SIDEBAR_TAB.FILES,
  RIGHT_SIDEBAR_TAB.LINKS,
  RIGHT_SIDEBAR_TAB.VOICE,
];

function updateConversationInCache(
  data: GetConversationResponseDto | undefined,
  payload: {
    title: string;
    about: string;
    isPublic: boolean;
    username: string;
    avatarKey: string;
    discussionConversationId: string;
  },
) {
  if (!data?.conversation) {
    return data;
  }

  return {
    ...data,
    conversation: {
      ...data.conversation,
      title: payload.title,
      about: payload.about,
      isPublic: payload.isPublic,
      username: payload.username,
      avatarKey: payload.avatarKey,
      discussionConversationId: payload.discussionConversationId,
    },
  };
}

function getConversationMembers(conversation: ConversationLike | null) {
  return conversation?.members ?? [];
}

export function usePanel(conversationId: string) {
  const t = useTranslations("rightSidebar");
  const ageWords = useTranslations("settingsSidebar.profile.ageYears");
  const locale = useLocale();
  const timeFormat = useGeneralSettingsStore((state) => state.timeFormat);
  const autoplayVideo = useGeneralSettingsStore(
    (state) => state.autoplayVideo && !state.powerSavingEnabled,
  );
  const sidebarAnimationsEnabled = useGeneralSettingsStore(
    (state) =>
      state.animationsEnabled &&
      state.interfaceAnimationsEnabled &&
      !state.powerSavingEnabled,
  );
  const router = useRouter();
  const { push } = sidebarStore();
  const queryClient = useQueryClient();
  const me = useUsersControllerMe();
  const currentUser = me.data?.user ?? null;
  const { activeTab, setActiveTab, close } = rightSidebarStore();
  const reactionCatalog = useMemo(
    () => [
      { emoji: "❤️", label: t("manage.reactionLabels.heart") },
      { emoji: "👍", label: t("manage.reactionLabels.thumbsUp") },
      { emoji: "👎", label: t("manage.reactionLabels.thumbsDown") },
      { emoji: "🔥", label: t("manage.reactionLabels.fire") },
      { emoji: "🥰", label: t("manage.reactionLabels.smileHearts") },
      { emoji: "👏", label: t("manage.reactionLabels.clap") },
      { emoji: "😁", label: t("manage.reactionLabels.grin") },
      { emoji: "🤔", label: t("manage.reactionLabels.thinking") },
      { emoji: "🤯", label: t("manage.reactionLabels.mindBlown") },
      { emoji: "😱", label: t("manage.reactionLabels.scream") },
      { emoji: "🤬", label: t("manage.reactionLabels.angry") },
      { emoji: "😢", label: t("manage.reactionLabels.cry") },
      { emoji: "🎉", label: t("manage.reactionLabels.party") },
      { emoji: "🤩", label: t("manage.reactionLabels.starStruck") },
      { emoji: "🤮", label: t("manage.reactionLabels.vomit") },
      { emoji: "💩", label: t("manage.reactionLabels.poop") },
      { emoji: "🙏", label: t("manage.reactionLabels.pray") },
    ],
    [t],
  );

  const [tabDirection, setTabDirection] = useState<1 | -1>(1);
  const [screen, setScreen] = useState<RightSidebarScreen>("info");
  const [screenDirection, setScreenDirection] = useState<1 | -1>(1);
  const [infoScrollTop, setInfoScrollTop] = useState(0);
  const [isSharedView, setIsSharedView] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAbout, setDraftAbout] = useState("");
  const [draftIsPublic, setDraftIsPublic] = useState(false);
  const [draftUsername, setDraftUsername] = useState("");
  const [draftAvatarKey, setDraftAvatarKey] = useState("");
  const [draftDiscussionConversationId, setDraftDiscussionConversationId] = useState("");
  const [draftDiscussionTitle, setDraftDiscussionTitle] = useState("");
  const [draftDiscussionAvatarKey, setDraftDiscussionAvatarKey] = useState("");
  const [isUploadingDiscussionAvatar, setIsUploadingDiscussionAvatar] = useState(false);
  const [isCreatingDiscussion, setIsCreatingDiscussion] = useState(false);
  const [contentProtectionEnabled, setContentProtectionEnabled] = useState(false);
  const [signMessages, setSignMessages] = useState(false);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [reactionItems, setReactionItems] = useState<
    Array<{ emoji: string; label: string; checked: boolean }>
  >(() => reactionCatalog.map((item, index) => ({ ...item, checked: index < 15 })));
  const [adminMessagesEnabled, setAdminMessagesEnabled] = useState(true);
  const [adminMessagesPrice, setAdminMessagesPrice] = useState(500);
  const [inviteLinks, setInviteLinks] = useState<SidebarInviteLinkItem[]>([]);
  const [selectedInviteLinkId, setSelectedInviteLinkId] = useState<string | null>(null);
  const [inviteLinkDraftTitle, setInviteLinkDraftTitle] = useState("");
  const [inviteMonthlyFeeEnabled, setInviteMonthlyFeeEnabled] = useState(false);
  const [inviteRequestsEnabled, setInviteRequestsEnabled] = useState(false);
  const [inviteDurationValue, setInviteDurationValue] = useState(4);
  const [inviteUsageLimitValue, setInviteUsageLimitValue] = useState(4);
  const [addMembersParentScreen, setAddMembersParentScreen] = useState<
    "manage-members" | "manage-admins"
  >("manage-members");
  const [addMembersTargetRole, setAddMembersTargetRole] = useState<UpdateMemberRoleRequestDtoRole>(
    UpdateMemberRoleRole.MEMBER,
  );
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
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const [voiceProgress, setVoiceProgress] = useState<Record<string, number>>({});
  const [voiceDuration, setVoiceDuration] = useState<Record<string, number>>({});

  const infoViewportRef = useRef<HTMLDivElement | null>(null);
  const tabsAnchorRef = useRef<HTMLDivElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const voiceAudioRef = useRef<Record<string, HTMLAudioElement | null>>({});

  const conversationRouteParam = decodeConversationLocator(conversationId);
  const usernameLookup = isUsernameConversationLocator(conversationRouteParam)
    ? normalizeConversationUsername(conversationRouteParam)
    : "";
  const usernameConversationQuery = useConversationUsernameQuery(usernameLookup);
  const conversationLookupId = usernameLookup
    ? (usernameConversationQuery.data?.conversation?.id?.trim() ?? "")
    : conversationRouteParam;
  const conversationQuery = useConversationQuery(conversationLookupId);
  const routeConversation =
    conversationQuery.data?.conversation ??
    usernameConversationQuery.data?.conversation ??
    null;
  const isResolvingConversationRoute = usernameLookup
    ? usernameConversationQuery.isPending
    : conversationQuery.isPending;
  const shouldResolveRouteUser = !isResolvingConversationRoute && !routeConversation;
  const directConversationsQuery = useConversationsControllerMy(undefined, {
    query: {
      queryKey: getConversationsControllerMyQueryKey(),
      staleTime: 60_000,
    },
  });
  const routeUserQuery = useRouteUserQuery(
    conversationRouteParam,
    shouldResolveRouteUser,
  );
  const routeUser = routeUserQuery.data?.user ?? null;
  const currentUserId = currentUser?.id ?? "";
  const routeUserId = routeUser?.id ?? "";
  const routeDirectConversation = useMemo(() => {
    if (!routeUserId || !currentUserId) {
      return null;
    }

    return findDirectConversationWithUser(
      directConversationsQuery.data?.conversations,
      routeUserId,
      currentUserId,
    );
  }, [
    currentUserId,
    directConversationsQuery.data?.conversations,
    routeUserId,
  ]);
  const virtualDirectConversation = useMemo(() => {
    if (
      routeConversation ||
      routeDirectConversation ||
      directConversationsQuery.isPending ||
      !currentUser?.id ||
      !routeUser?.id
    ) {
      return null;
    }

    return createVirtualDirectConversation({
      currentUser,
      peerUser: routeUser,
    });
  }, [
    currentUser,
    directConversationsQuery.isPending,
    routeConversation,
    routeDirectConversation,
    routeUser,
  ]);
  const conversation =
    routeConversation ?? routeDirectConversation ?? virtualDirectConversation;
  const resolvedConversationId =
    routeConversation?.id?.trim() ?? routeDirectConversation?.id?.trim() ?? "";
  const isResolvingDirectConversationRoute = Boolean(
    !routeConversation &&
      routeUserId &&
      currentUserId &&
      directConversationsQuery.isPending,
  );
  const isDirect = isDirectConversation(conversation);
  const isChannel = isChannelConversation(conversation);
  const isGroup = isGroupConversation(conversation);
  const conversationMembers = getConversationMembers(conversation);
  const peerMember = isDirect
    ? conversationMembers.find((member) => member.userId !== currentUser?.id) ??
      conversationMembers[0]
    : undefined;
  const peerId = peerMember?.userId;

  const tabFilter = SIDEBAR_TAB_FILTER_MAP[activeTab];
  const sharedMediaQuery = useChatSharedMedia(
    resolvedConversationId,
    tabFilter,
    48,
    Boolean(resolvedConversationId),
  );
  const sharedMediaHasNextPage = sharedMediaQuery.hasNextPage;
  const isFetchingSharedMediaNextPage = sharedMediaQuery.isFetchingNextPage;
  const isSharedMediaLoading = sharedMediaQuery.isLoading;
  const fetchNextSharedMediaPage = sharedMediaQuery.fetchNextPage;
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
    () =>
      resolveMediaEntries(sharedMediaItems).filter(
        (item) => item.kind === CHAT_MEDIA_KIND.FILE,
      ),
    [sharedMediaItems],
  );
  const voiceEntries = useMemo(
    () =>
      resolveMediaEntries(sharedMediaItems).filter(
        (item) => item.kind === CHAT_MEDIA_KIND.VOICE,
      ),
    [sharedMediaItems],
  );
  const linkEntries = useMemo(
    () => resolveLinkEntries(sharedMediaItems),
    [sharedMediaItems],
  );

  const authorIds = useMemo(
    () =>
      [
        ...new Set(
          [
            ...conversationMembers.map((member) => member.userId),
            ...sharedMediaItems.map((item) => item.authorId),
          ].filter(Boolean),
        ),
      ] as string[],
    [conversationMembers, sharedMediaItems],
  );
  const { data: authorsMap } = useChatAuthors(authorIds);
  const peerUser =
    peerId ? (authorsMap?.[peerId] ?? (peerId === routeUser?.id ? routeUser : null)) : null;
  const isBotDirect = Boolean(isDirect && isBotProjectionUserId(peerId));
  const discussionConversationQuery = useConversationQuery(
    draftDiscussionConversationId,
  );
  const discussionConversation =
    discussionConversationQuery.data?.conversation ?? null;
  const memberItems = useMemo<MemberListItem[]>(
    () =>
      conversationMembers
        .map((member) => ({
          ...member,
          user: authorsMap?.[member.userId] ?? null,
        }))
        .sort((left, right) => getMemberRoleRank(left.role) - getMemberRoleRank(right.role)),
    [authorsMap, conversationMembers],
  );

  const memberIds = useMemo(
    () => conversationMembers.map((member) => member.userId).filter(Boolean),
    [conversationMembers],
  );
  const currentMember =
    currentUser?.id
      ? conversationMembers.find(
          (member) =>
            member.userId === currentUser.id &&
            member.state === ConversationMemberResponseDtoState.ACTIVE,
        ) ?? null
      : null;
  const notifications = useConversationNotifications(
    resolvedConversationId,
    conversation?.notificationsEnabled,
    Boolean(currentMember),
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
  const selectedCandidateIdSet = useMemo(
    () => new Set(selectedCandidateIds),
    [selectedCandidateIds],
  );

  const title = isDirect
    ? getUserDisplayName(peerUser, t("directFallback"))
    : conversation
      ? getConversationTitle(conversation)
      : "";
  const avatarUrl = isDirect ? getUserAvatarUrl(peerUser) : getConversationAvatarUrl(conversation);
  const avatarFallback = isDirect
    ? getUserInitial(peerUser, title || "#")
    : conversation
      ? getConversationInitial(conversation)
      : "#";
  const discussionDraftAvatarUrl = resolveStorageFileUrl(draftDiscussionAvatarKey);
  const discussionDraftAvatarFallback =
    (draftDiscussionTitle.trim() || draftTitle.trim() || title || "#").charAt(0).toUpperCase() ||
    "#";
  const phoneLabel = isDirect ? peerUser?.phone?.trim() ?? "" : "";
  const usernameLabel = isDirect && peerUser?.username ? `@${peerUser.username}` : "";
  const birthDateLabel =
    isDirect && peerUser?.birthDate
      ? formatBirthDateWithAge(peerUser.birthDate, locale, {
          one: ageWords("one"),
          few: ageWords("few"),
          many: ageWords("many"),
          other: ageWords("other"),
        })
      : "";
  const aboutLabel = isChannel ? conversation?.about?.trim() ?? "" : "";
  const publicLink = isChannel ? normalizePublicLink(conversation?.username) : "";
  const draftPublicLink = isChannel ? normalizePublicLink(draftUsername) : "";
  const profileSubtitle = isDirect
    ? (isBotDirect ? t("botLabel") : (phoneLabel || usernameLabel || t("directFallback")))
    : isChannel
      ? t("header.subscribersCounter", { count: memberItems.length })
      : t("header.membersCounter", { count: memberItems.length });
  const isSelfDirect = Boolean(isDirect && currentUser?.id && peerId === currentUser.id);
  const adminsCount = memberItems.filter((member) => getMemberRoleRank(member.role) <= 2).length;
  const adminItems = filteredMemberItems.filter((member) => getMemberRoleRank(member.role) <= 2);
  const additionalInviteLinks = inviteLinks.filter((link) => link.url !== draftPublicLink);
  const inviteLinksCount = (draftPublicLink ? 1 : 0) + additionalInviteLinks.length;
  const selectedInviteLink =
    inviteLinks.find((link) => link.id === selectedInviteLinkId) ?? null;
  const discussionConversationTitle = discussionConversation
    ? getConversationTitle(discussionConversation)
    : "";

  useEffect(() => {
    if (AVAILABLE_TABS.includes(activeTab)) {
      return;
    }

    setActiveTab(RIGHT_SIDEBAR_TAB.MEDIA);
  }, [activeTab, setActiveTab]);

  useEffect(() => {
    setScreen("info");
    setScreenDirection(1);
    setInfoScrollTop(0);
    setIsSharedView(false);
    setMembersSearchQuery("");
    setCandidateSearchQuery("");
    setSelectedCandidateIds([]);
    setInviteLinks([]);
    setSelectedInviteLinkId(null);
    setInviteLinkDraftTitle("");
    setInviteMonthlyFeeEnabled(false);
    setInviteRequestsEnabled(false);
    setInviteDurationValue(4);
    setInviteUsageLimitValue(4);
    setAddMembersParentScreen("manage-members");
    previewVideoRef.current?.pause();
    setActiveImagePreview(null);
    setActiveVideoPreview(null);
    setPreviewZoomed(false);
    setShouldPreviewVideoPlay(false);
    setIsPreviewVideoPlaying(false);
    setIsPreviewVideoMuted(false);
    setPreviewVideoDuration(0);
    setPreviewVideoCurrentTime(0);
    Object.values(voiceAudioRef.current).forEach((audio) => audio?.pause());
    setActiveVoiceId(null);
    setVoiceProgress({});
    setVoiceDuration({});
  }, [conversationRouteParam]);

  useEffect(() => {
    if (!isDirect || screen === "info") {
      return;
    }

    setScreen("info");
    setScreenDirection(-1);
  }, [isDirect, screen]);

  useEffect(() => {
    setDraftTitle(isDirect ? "" : conversation?.title ?? "");
    setDraftAbout(conversation?.about ?? "");
    setDraftIsPublic(Boolean(conversation?.isPublic));
    setDraftUsername(conversation?.username ?? "");
    setDraftAvatarKey(conversation?.avatarKey ?? "");
    setDraftDiscussionConversationId(conversation?.discussionConversationId ?? "");
    setDraftDiscussionTitle(
      isDirect
        ? ""
        : `${(conversation?.title ?? "").trim() || t("manage.discussionGroupDefaultTitle")} Chat`,
    );
    setDraftDiscussionAvatarKey(conversation?.avatarKey ?? "");
    setIsUploadingDiscussionAvatar(false);
    setIsCreatingDiscussion(false);
    setContentProtectionEnabled(false);
    setSignMessages(false);
    setReactionsEnabled(true);
    setReactionItems(
      reactionCatalog.map((item, index) => ({
        ...item,
        checked: index < 15,
      })),
    );
    setAdminMessagesEnabled(true);
    setAdminMessagesPrice(500);
    setAddMembersTargetRole(
      conversation?.type === CHAT_CONVERSATION_TYPE.CHANNEL
        ? UpdateMemberRoleRole.SUBSCRIBER
        : UpdateMemberRoleRole.MEMBER,
    );
  }, [
    conversation?.about,
    conversation?.avatarKey,
    conversation?.discussionConversationId,
    conversation?.id,
    conversation?.isPublic,
    conversation?.title,
    conversation?.type,
    conversation?.username,
    isDirect,
    reactionCatalog,
    t,
  ]);

  useEffect(() => {
    const baseLink = normalizePublicLink(draftUsername);
    if (!baseLink) {
      setInviteLinks([]);
      return;
    }

    setInviteLinks((current) =>
      current.length > 0
        ? current
        : [
            {
              id: `${conversationRouteParam}:default-invite`,
              title: baseLink,
              url: baseLink,
              joinedCountLabel: t("manage.inviteLinkNoJoins"),
              creatorLabel: currentUser
                ? getUserDisplayName(currentUser, t("unknownUser"))
                : t("unknownUser"),
              createdAtLabel: t("manage.inviteLinkCreatedNow"),
            },
      ],
    );
  }, [conversationRouteParam, currentUser, draftUsername, t]);

  const addMembersMutation = useMutation({
    mutationFn: async (newMemberIds: string[]) => {
      await conversationsControllerAddMembers({
        conversationId: resolvedConversationId,
        memberIds: newMemberIds,
      });

      if (addMembersTargetRole === UpdateMemberRoleRole.ADMIN) {
        await Promise.all(
          newMemberIds.map((targetUserId) =>
            conversationsControllerUpdateRole({
              conversationId: resolvedConversationId,
              targetUserId,
              role: UpdateMemberRoleRole.ADMIN,
            }),
          ),
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getConversationQueryKey(resolvedConversationId),
      });
      toast({
        title: t("members.added"),
        type: "info",
      });
      setSelectedCandidateIds([]);
      setCandidateSearchQuery("");
      changeScreen(addMembersParentScreen);
    },
    onError: () => {
      toast({
        title: t("members.addError"),
        type: "error",
      });
    },
  });
  const updateConversationMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      about: string;
      isPublic: boolean;
      username: string;
      avatarKey: string;
      discussionConversationId: string;
    }) =>
      conversationsControllerUpdate({
        conversationId: resolvedConversationId,
        title: payload.title,
        about: payload.about,
        isPublic: payload.isPublic,
        username: payload.username,
        avatarKey: payload.avatarKey,
        discussionConversationId: payload.discussionConversationId,
      }),
    onMutate: async (payload) => {
      const previousConversation = queryClient.getQueryData<GetConversationResponseDto>(
        getConversationQueryKey(resolvedConversationId),
      );

      queryClient.setQueryData<GetConversationResponseDto>(
        getConversationQueryKey(resolvedConversationId),
        (currentData) => updateConversationInCache(currentData, payload),
      );

      return { previousConversation };
    },
    onError: (_error, _payload, context) => {
      queryClient.setQueryData<GetConversationResponseDto>(
        getConversationQueryKey(resolvedConversationId),
        context?.previousConversation,
      );

      const previousConversation = context?.previousConversation?.conversation;
      if (previousConversation && !isDirectConversation(previousConversation)) {
        setDraftTitle(previousConversation.title ?? "");
        setDraftAbout(previousConversation.about ?? "");
        setDraftIsPublic(Boolean(previousConversation.isPublic));
        setDraftUsername(previousConversation.username ?? "");
        setDraftAvatarKey(previousConversation.avatarKey ?? "");
        setDraftDiscussionConversationId(
          previousConversation.discussionConversationId ?? "",
        );
      }

      toast({
        title: t("manage.saveError"),
        type: "error",
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: getConversationQueryKey(resolvedConversationId),
      });

      await queryClient.invalidateQueries({
        queryKey: getConversationsControllerMyQueryKey(),
      });
    },
  });
  const deleteConversationMutation = useMutation({
    mutationFn: () =>
      conversationsControllerDelete({
        conversationId: resolvedConversationId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getConversationsControllerMyQueryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: getConversationQueryKey(resolvedConversationId),
      });
      close();
      router.push("/");
    },
    onError: () => {
      toast({
        title: t("manage.deleteError"),
        type: "error",
      });
    },
  });

  const { mutateAsync: deleteMessages, isPending: isDeletingMessage } =
    useMessagesControllerDelete();
  const updateRoleMutation = useMutation({
    mutationFn: (payload: {
      targetUserId: string;
      role: UpdateMemberRoleRequestDtoRole;
    }) =>
      conversationsControllerUpdateRole({
        conversationId: resolvedConversationId,
        targetUserId: payload.targetUserId,
        role: payload.role,
      }),
  });
  const removeMemberMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      conversationsControllerRemoveMember({
        conversationId: resolvedConversationId,
        targetUserId,
      }),
  });
  const openMessage = (messageId: string) => {
    if (!resolvedConversationId) {
      return;
    }

    router.push(`/c/${resolvedConversationId}/${messageId}`);
  };

  const formatCreatedAt = (value: number) =>
    formatTimestampTime(value, locale, { timeFormat });
  const mediaMonthGroups = useMemo(
    () => buildMonthGroups(mediaEntries, (item) => item.createdAt, locale),
    [locale, mediaEntries],
  );
  const fileMonthGroups = useMemo(
    () => buildMonthGroups(fileEntries, (item) => item.createdAt, locale),
    [fileEntries, locale],
  );
  const linkMonthGroups = useMemo(
    () => buildMonthGroups(linkEntries, (item) => item.createdAt, locale),
    [linkEntries, locale],
  );
  const voiceMonthGroups = useMemo(
    () => buildMonthGroups(voiceEntries, (item) => item.createdAt, locale),
    [locale, voiceEntries],
  );

  const openExternalLink = (url: string) => {
    if (!url) {
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyText = async (value: string, titleValue: string) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: titleValue,
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
    if (!mediaKey) {
      return;
    }

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
      getChatMessagesQueryKey(resolvedConversationId),
      (currentData) => removeChatMessageFromData(currentData, messageId),
    );

    const nextTimestamp = Date.now();

    queryClient.setQueryData<GetConversationResponseDto>(
      getConversationQueryKey(resolvedConversationId),
      (currentData) => bumpConversationQueryData(currentData, nextTimestamp),
    );

    queryClient.setQueriesData<ListMyConversationsResponseDto>(
      { queryKey: getConversationsControllerMyQueryKey() },
      (currentData) =>
        bumpConversationInListData(currentData, resolvedConversationId, nextTimestamp),
    );
  };

  const invalidateSharedMedia = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["chat", "shared-media", resolvedConversationId],
    });
  };

  const canDeleteMessage = (entry: SharedMessageEntry) =>
    isChannel || entry.authorId === currentUser?.id;

  const handleDeleteMessage = async (entry: SharedMessageEntry) => {
    if (!canDeleteMessage(entry) || isDeletingMessage) {
      return false;
    }

    try {
      await deleteMessages({
        data: {
          conversationId: resolvedConversationId,
          messageIds: [entry.messageId],
        },
      });

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
    const storageKey = `${CHAT_SELECT_STORAGE_KEY_PREFIX}:${conversationRouteParam}`;
    sessionStorage.setItem(storageKey, messageId);
    window.dispatchEvent(
      new CustomEvent(CHAT_SELECT_EVENT, {
        detail: { conversationId: conversationRouteParam, messageId },
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

  const handlePreviewVideoTimelineClick = (
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();

    const video = previewVideoRef.current;
    if (!video || previewVideoDuration <= 0) {
      return;
    }

    const timelineRect = event.currentTarget.getBoundingClientRect();
    if (timelineRect.width <= 0) {
      return;
    }

    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - timelineRect.left) / timelineRect.width),
    );
    video.currentTime = ratio * previewVideoDuration;
    setPreviewVideoCurrentTime(video.currentTime);
  };

  const handleDownloadFromPreview = async () => {
    const mediaKey = activeImagePreview?.mediaKey ?? activeVideoPreview?.mediaKey;
    if (!mediaKey) {
      return;
    }

    await downloadByMediaKey(mediaKey);
  };

  const handleDeleteFromPreview = async () => {
    const messageId = activeImagePreview?.messageId ?? activeVideoPreview?.messageId;
    const authorId =
      mediaEntries.find((entry) => entry.messageId === messageId)?.authorId ?? "";
    if (!messageId) {
      return;
    }

    const deleted = await handleDeleteMessage({ messageId, authorId });
    if (deleted) {
      closeMediaPreview();
    }
  };

  const isPreviewOpen = Boolean(activeImagePreview || activeVideoPreview);
  const canUsePortal = typeof document !== "undefined";
  const previewVideoProgress =
    previewVideoDuration > 0
      ? Math.min(
          100,
          Math.max(0, (previewVideoCurrentTime / previewVideoDuration) * 100),
        )
      : 0;
  const activePreviewMessageId =
    activeImagePreview?.messageId ?? activeVideoPreview?.messageId ?? "";
  const activePreviewAuthorId = activePreviewMessageId
    ? mediaEntries.find((entry) => entry.messageId === activePreviewMessageId)?.authorId ?? ""
    : "";
  const canDeleteActivePreviewMessage = Boolean(
    activePreviewMessageId &&
      canDeleteMessage({
        messageId: activePreviewMessageId,
        authorId: activePreviewAuthorId,
      }),
  );

  useEffect(() => {
    if (!isPreviewOpen) {
      return;
    }

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
    if (!activeVideoPreview) {
      return;
    }

    setIsPreviewVideoMuted(autoplayVideo);
    setShouldPreviewVideoPlay(autoplayVideo);
    setIsPreviewVideoPlaying(false);
  }, [activeVideoPreview, autoplayVideo]);

  useEffect(() => {
    if (!activeVideoPreview) {
      return;
    }

    const video = previewVideoRef.current;
    if (!video) {
      return;
    }

    video.muted = isPreviewVideoMuted;
    video.defaultMuted = isPreviewVideoMuted;
  }, [activeVideoPreview, isPreviewVideoMuted]);

  useEffect(() => {
    if (!activeVideoPreview) {
      return;
    }

    const video = previewVideoRef.current;
    if (!video) {
      return;
    }

    if (!shouldPreviewVideoPlay) {
      video.pause();
      return;
    }

    void video.play().catch(() => {
      setShouldPreviewVideoPlay(false);
    });
  }, [activeVideoPreview, shouldPreviewVideoPlay]);

  useEffect(() => {
    Object.values(voiceAudioRef.current).forEach((audio) => audio?.pause());
  }, [conversationId, activeTab]);

  useEffect(() => {
    const audioNodes = voiceAudioRef.current;
    return () => {
      Object.values(audioNodes).forEach((audio) => audio?.pause());
    };
  }, []);

  const tabCounts: Record<RightSidebarTab, number> = {
    [RIGHT_SIDEBAR_TAB.MEDIA]: mediaEntries.length,
    [RIGHT_SIDEBAR_TAB.FILES]: fileEntries.length,
    [RIGHT_SIDEBAR_TAB.LINKS]: linkEntries.length,
    [RIGHT_SIDEBAR_TAB.VOICE]: voiceEntries.length,
  };
  const activeTabCount = tabCounts[activeTab] ?? 0;
  const currentMemberRole = getMemberRoleRank(
    memberItems.find((member) => member.userId === currentUser?.id)?.role,
  );
  const defaultMemberRole = isChannel
    ? UpdateMemberRoleRole.SUBSCRIBER
    : UpdateMemberRoleRole.MEMBER;
  const hasConversationDraftChanges = Boolean(
    conversation &&
      !isDirect &&
      (
        draftTitle.trim() !== (conversation.title ?? "") ||
        draftAbout.trim() !== (conversation.about ?? "") ||
        draftIsPublic !== Boolean(conversation.isPublic) ||
        draftUsername.trim().replace(/^@+/, "") !== (conversation.username ?? "") ||
        draftAvatarKey.trim() !== (conversation.avatarKey ?? "") ||
        draftDiscussionConversationId.trim() !==
          (conversation.discussionConversationId ?? "")
      ),
  );
  const showBackAction = screen !== "info" || isSharedView;
  const canEditInfo = Boolean(
    screen === "info" &&
      !isSharedView &&
      (isDirect ? isSelfDirect : currentMemberRole > 0 && currentMemberRole <= 2),
  );
  const avatarCollapseProgress = Math.min(1, Math.max(0, infoScrollTop / 140));
  const headerAvatarLayoutId = `right-sidebar-avatar:${conversationId}`;
  const { headerTitle, headerSubtitle } = buildRightSidebarHeaderState({
    screen,
    isChannel,
    isGroup,
    isSharedView,
    title,
    activeTab,
    activeTabCount,
    memberCount: memberItems.length,
    adminCount: adminItems.length,
    selectedCandidateCount: selectedCandidateIds.length,
    t,
  });

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

  const syncInfoScrollState = useCallback(() => {
    if (screen !== "info") {
      return;
    }

    const viewport = infoViewportRef.current;
    if (!viewport) {
      return;
    }

    const nextScrollTop = viewport.scrollTop;
    const tabsStart = Math.max(0, (tabsAnchorRef.current?.offsetTop ?? 0) - 56);
    const distanceToBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    setInfoScrollTop(nextScrollTop);
    setIsSharedView(nextScrollTop >= tabsStart);

    if (
      sharedMediaHasNextPage &&
      !isFetchingSharedMediaNextPage &&
      !isSharedMediaLoading &&
      distanceToBottom <= 320
    ) {
      void fetchNextSharedMediaPage();
    }
  }, [
    fetchNextSharedMediaPage,
    isFetchingSharedMediaNextPage,
    isSharedMediaLoading,
    screen,
    sharedMediaHasNextPage,
  ]);

  useEffect(() => {
    if (screen !== "info") {
      return;
    }

    syncInfoScrollState();
  }, [
    activeTab,
    conversationId,
    screen,
    syncInfoScrollState,
  ]);

  const selectTab = (nextTab: RightSidebarTab) => {
    const currentIndex = RIGHT_SIDEBAR_TAB_ORDER.indexOf(activeTab);
    const nextIndex = RIGHT_SIDEBAR_TAB_ORDER.indexOf(nextTab);

    if (currentIndex !== -1 && nextIndex !== -1) {
      setTabDirection(nextIndex >= currentIndex ? 1 : -1);
    }

    setActiveTab(nextTab);
  };

  const changeScreen = (nextScreen: RightSidebarScreen) => {
    if (nextScreen === screen) {
      return;
    }

    const currentIndex = RIGHT_SIDEBAR_SCREEN_ORDER.indexOf(screen);
    const nextIndex = RIGHT_SIDEBAR_SCREEN_ORDER.indexOf(nextScreen);
    if (currentIndex !== -1 && nextIndex !== -1) {
      setScreenDirection(nextIndex >= currentIndex ? 1 : -1);
    }

    setScreen(nextScreen);
  };

  const scrollToProfileTop = () => {
    infoViewportRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const persistConversationDraft = () => {
    if (!conversation || isDirect) {
      return;
    }

    const nextTitle = draftTitle.trim();
    const nextAbout = draftAbout.trim();
    const nextUsername = draftUsername.trim().replace(/^@+/, "");
    const nextAvatarKey = draftAvatarKey.trim();
    const nextDiscussionConversationId =
      draftDiscussionConversationId.trim();

    if (!nextTitle) {
      toast({
        title: t("manage.titleRequired"),
        type: "error",
      });
      return;
    }

    if (draftIsPublic && !nextUsername) {
      toast({
        title: t("manage.usernameRequired"),
        type: "error",
      });
      return;
    }

    if (
      nextTitle === (conversation.title ?? "") &&
      nextAbout === (conversation.about ?? "") &&
      draftIsPublic === Boolean(conversation.isPublic) &&
      nextUsername === (conversation.username ?? "") &&
      nextAvatarKey === (conversation.avatarKey ?? "") &&
      nextDiscussionConversationId ===
        (conversation.discussionConversationId ?? "")
    ) {
      return;
    }

    updateConversationMutation.mutate({
      title: nextTitle,
      about: nextAbout,
      isPublic: draftIsPublic,
      username: nextUsername,
      avatarKey: nextAvatarKey,
      discussionConversationId: nextDiscussionConversationId,
    });
  };

  const openAddMembersScreen = (
    parentScreen: "manage-members" | "manage-admins",
    role: UpdateMemberRoleRequestDtoRole,
  ) => {
    setAddMembersParentScreen(parentScreen);
    setAddMembersTargetRole(role);
    changeScreen("add-members");
  };

  const handleCreateInviteLink = () => {
    const baseLink =
      draftPublicLink ||
      `${(process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "")}/invite`;
    const linkId = `${conversationId}:invite:${Date.now()}`;
    const nextLink: SidebarInviteLinkItem = {
      id: linkId,
      title: inviteLinkDraftTitle.trim() || `${baseLink}/${Date.now().toString(36)}`,
      url: `${baseLink}/${Date.now().toString(36)}`,
      joinedCountLabel: t("manage.inviteLinkNoJoins"),
      creatorLabel: currentUser
        ? getUserDisplayName(currentUser, t("unknownUser"))
        : t("unknownUser"),
      createdAtLabel: t("manage.inviteLinkCreatedNow"),
    };

    setInviteLinks((current) => [...current, nextLink]);
    setSelectedInviteLinkId(linkId);
    setInviteLinkDraftTitle("");
    setInviteMonthlyFeeEnabled(false);
    setInviteRequestsEnabled(false);
    setInviteDurationValue(4);
    setInviteUsageLimitValue(4);
    changeScreen("manage-invite-link-detail");
  };

  const openDiscussionCreateScreen = () => {
    setDraftDiscussionTitle((current) =>
      current.trim()
        ? current
        : `${draftTitle.trim() || t("manage.discussionGroupDefaultTitle")} Chat`,
    );
    setDraftDiscussionAvatarKey((current) => current.trim() || draftAvatarKey.trim());
    changeScreen("manage-discussion-create");
  };

  const handleUploadDiscussionAvatar = async (file: File) => {
    const previousDraftAvatarKey = draftDiscussionAvatarKey.trim();

    try {
      setIsUploadingDiscussionAvatar(true);
      const uploadedAvatar = await uploadConversationAvatar(file);

      setDraftDiscussionAvatarKey(uploadedAvatar.key);

      if (
        previousDraftAvatarKey &&
        previousDraftAvatarKey !== uploadedAvatar.key &&
        previousDraftAvatarKey !== draftAvatarKey.trim()
      ) {
        await deleteConversationMedia(previousDraftAvatarKey).catch(() => undefined);
      }
    } catch {
      toast({
        title: t("manage.discussionAvatarUploadError"),
        type: "error",
      });
    } finally {
      setIsUploadingDiscussionAvatar(false);
    }
  };

  const handleCreateDiscussionGroup = async () => {
    const nextDiscussionTitle = draftDiscussionTitle.trim();

    if (isCreatingDiscussion) {
      return;
    }

    if (!isChannel || !nextDiscussionTitle) {
      toast({
        title: t("manage.titleRequired"),
        type: "error",
      });
      return;
    }

    try {
      setIsCreatingDiscussion(true);
      const response = await conversationsControllerCreate({
        type: CreateConversationRequestDtoType.GROUP,
        title: nextDiscussionTitle,
        about: t("manage.discussionGroupAbout", { title: draftTitle.trim() }),
        isPublic: false,
        avatarKey: draftDiscussionAvatarKey.trim() || undefined,
      });

      const discussionId = response.conversation?.id ?? "";
      if (!discussionId) {
        throw new Error("discussion_create_failed");
      }

      setDraftDiscussionConversationId(discussionId);
      await updateConversationMutation.mutateAsync({
        title: draftTitle.trim(),
        about: draftAbout.trim(),
        isPublic: draftIsPublic,
        username: draftUsername.trim().replace(/^@+/, ""),
        avatarKey: draftAvatarKey.trim(),
        discussionConversationId: discussionId,
      });

      toast({
        title: t("manage.discussionCreated"),
        type: "info",
      });
      changeScreen("manage-discussion");
    } catch {
      toast({
        title: t("manage.discussionCreateError"),
        type: "error",
      });
    } finally {
      setIsCreatingDiscussion(false);
    }
  };

  const handleUnlinkDiscussionGroup = async () => {
    try {
      setDraftDiscussionConversationId("");
      await updateConversationMutation.mutateAsync({
        title: draftTitle.trim(),
        about: draftAbout.trim(),
        isPublic: draftIsPublic,
        username: draftUsername.trim().replace(/^@+/, ""),
        avatarKey: draftAvatarKey.trim(),
        discussionConversationId: "",
      });

      toast({
        title: t("manage.discussionUnlinked"),
        type: "info",
      });
    } catch {
      toast({
        title: t("manage.discussionUnlinkError"),
        type: "error",
      });
    }
  };

  const handleDeleteConversation = async () => {
    if (deleteConversationMutation.isPending) {
      return;
    }

    await deleteConversationMutation.mutateAsync();
  };

  const handleEditInfo = () => {
    if (!isDirect) {
      changeScreen("manage-overview");
      return;
    }

    if (isSelfDirect && currentUser?.id) {
      push({ screen: "edit-profile", userId: currentUser.id });
    }
  };

  const handleLeadingAction = () => {
    if (screen !== "info") {
      changeScreen(getRightSidebarPreviousScreen(screen, addMembersParentScreen));
      return;
    }

    if (isSharedView) {
      scrollToProfileTop();
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
    if (!targetUserId || targetUserId === currentUser?.id) {
      return;
    }

    try {
      const targetUser = authorsMap?.[targetUserId] ?? null;
      const existingConversation = findDirectConversationWithUser(
        directConversationsQuery.data?.conversations,
        targetUserId,
        currentUser?.id,
      );

      close();
      router.push(
        existingConversation
          ? buildDirectConversationPath(existingConversation, targetUser)
          : buildUserDirectPath(targetUser ?? { id: targetUserId }),
      );
    } catch {
      toast({
        title: t("members.writeError"),
        type: "error",
      });
    }
  };

  const canManageMember = (
    targetUserId: string,
    targetRole: ConversationMemberResponseDtoRole,
  ) => {
    const targetRoleRank = getMemberRoleRank(targetRole);

    if (isDirect || targetUserId === currentUser?.id || targetRoleRank === 1) {
      return false;
    }

    if (currentMemberRole === 1) {
      return true;
    }

    if (currentMemberRole === 2) {
      return targetRoleRank > 2;
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

      await queryClient.invalidateQueries({
        queryKey: getConversationQueryKey(resolvedConversationId),
      });
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
      await queryClient.invalidateQueries({
        queryKey: getConversationQueryKey(resolvedConversationId),
      });
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

  const handleToggleNotifications = (nextValue: boolean) => {
    notifications.toggleNotifications(nextValue);
  };

  const playVoice = async (voiceId: string, url: string) => {
    if (!url) {
      return;
    }

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

        const progress = Math.min(
          100,
          Math.max(0, (node.currentTime / duration) * 100),
        );
        setVoiceProgress((current) => ({ ...current, [voiceId]: progress }));
      });

      node.addEventListener("loadedmetadata", () => {
        const duration = Number.isFinite(node.duration) ? node.duration : 0;
        setVoiceDuration((current) => ({
          ...current,
          [voiceId]: Math.max(0, duration),
        }));
      });

      node.addEventListener("ended", () => {
        setActiveVoiceId((current) => (current === voiceId ? null : current));
        setVoiceProgress((current) => ({ ...current, [voiceId]: 100 }));
      });

      voiceAudioRef.current[voiceId] = node;
      audioNode = node;
    }

    if (!audioNode) {
      return;
    }

    if (activeVoiceId === voiceId && !audioNode.paused) {
      audioNode.pause();
      setActiveVoiceId(null);
      return;
    }

    Object.entries(voiceAudioRef.current).forEach(([id, node]) => {
      if (!node || id === voiceId) {
        return;
      }

      node.pause();
    });

    try {
      await audioNode.play();
      setActiveVoiceId(voiceId);
    } catch {
      setActiveVoiceId(null);
    }
  };

  if (
    isResolvingConversationRoute ||
    (shouldResolveRouteUser && routeUserQuery.isPending) ||
    isResolvingDirectConversationRoute ||
    !conversation
  ) {
    return {
      isLoading: true as const,
      layoutGroupId: `right-sidebar:${conversationId}`,
    };
  }

  const toggleReactionItem = (emoji: string) => {
    setReactionItems((current) =>
      current.map((item) =>
        item.emoji === emoji ? { ...item, checked: !item.checked } : item,
      ),
    );
  };

  const openDiscussionChat = () => {
    if (!draftDiscussionConversationId) {
      return;
    }

    close();
    router.push(buildConversationPath({ conversationId: draftDiscussionConversationId }));
  };

  const isMutatingDiscussion =
    updateConversationMutation.isPending ||
    deleteConversationMutation.isPending ||
    isCreatingDiscussion;

  const screenNodes = buildRightSidebarScreenNodes({
    activeTab,
    tabDirection,
    mediaMonthGroups,
    fileMonthGroups,
    linkMonthGroups,
    voiceMonthGroups,
    mediaEntries,
    fileEntries,
    linkEntries,
    voiceEntries,
    isSharedMediaLoading,
    isFetchingSharedMediaNextPage,
    authorsMap,
    isDirect,
    locale,
    formatCreatedAt,
    renderEmptyState,
    openMessage,
    openImagePreview,
    openVideoPreview,
    playVoice,
    voiceProgress,
    voiceDuration,
    activeVoiceId,
    buildMessageContextActions,
    downloadByMediaKey,
    openExternalLink,
    copyText,
    title,
    profileSubtitle,
    avatarUrl,
    avatarFallback,
    avatarCollapseProgress,
    isSharedView,
    headerAvatarLayoutId,
    infoViewportRef,
    tabsAnchorRef,
    onInfoViewportScroll: syncInfoScrollState,
    aboutLabel,
    publicLink,
    phoneLabel,
    usernameLabel,
    birthDateLabel,
    isChannel,
    isGroup,
    notificationsEnabled: notifications.notificationsEnabled,
    canToggleNotifications: notifications.canToggleNotifications,
    isUpdatingNotifications: notifications.isUpdatingNotifications,
    onToggleNotifications: handleToggleNotifications,
    selectTab,
    membersSearchQuery,
    setMembersSearchQuery,
    filteredMemberItems,
    currentMemberRole,
    defaultMemberRole,
    canManageMember,
    onWriteToMember: handleWriteToMember,
    onUpdateMemberRole: handleUpdateMemberRole,
    onRemoveMember: handleRemoveMemberFromConversation,
    openAddMembersScreen,
    adminItems,
    draftTitle,
    draftAbout,
    draftIsPublic,
    inviteLinksCount,
    adminsCount,
    memberCount: memberItems.length,
    discussionConversationTitle,
    signMessages,
    setSignMessages,
    setDraftTitle,
    setDraftAbout,
    persistConversationDraft,
    changeScreen,
    canDeleteChannel: currentUser?.id === conversation.ownerId,
    onDeleteChannel: handleDeleteConversation,
    isDeletingChannel: deleteConversationMutation.isPending,
    hasDraftChanges: hasConversationDraftChanges,
    isSavingConversation: updateConversationMutation.isPending,
    draftUsername,
    contentProtectionEnabled,
    setDraftIsPublic,
    setDraftUsername,
    setContentProtectionEnabled,
    draftPublicLink,
    additionalInviteLinks,
    setSelectedInviteLinkId,
    inviteLinkDraftTitle,
    inviteMonthlyFeeEnabled,
    inviteRequestsEnabled,
    inviteDurationValue,
    inviteUsageLimitValue,
    setInviteLinkDraftTitle,
    setInviteMonthlyFeeEnabled,
    setInviteRequestsEnabled,
    setInviteDurationValue,
    setInviteUsageLimitValue,
    handleCreateInviteLink,
    selectedInviteLink,
    reactionsEnabled,
    reactionItems,
    setReactionsEnabled,
    toggleReactionItem,
    adminMessagesEnabled,
    adminMessagesPrice,
    setAdminMessagesEnabled,
    setAdminMessagesPrice,
    draftDiscussionConversationId,
    openDiscussionCreateScreen,
    openDiscussionChat,
    onUnlinkDiscussion: handleUnlinkDiscussionGroup,
    isMutatingDiscussion,
    draftDiscussionTitle,
    discussionDraftAvatarUrl,
    discussionDraftAvatarFallback,
    isUploadingDiscussionAvatar,
    isCreatingDiscussion,
    setDraftDiscussionTitle,
    handleUploadDiscussionAvatar,
    handleCreateDiscussionGroup,
    candidateSearchQuery,
    setCandidateSearchQuery,
    addCandidatesLoading: addCandidatesQuery.isLoading,
    addCandidates,
    selectedCandidateIdSet,
    onToggleCandidate: handleToggleCandidate,
    submitAddMembers,
    isSubmittingAddMembers: addMembersMutation.isPending,
    t,
  });

  const previewVideoCurrentTimeLabel = formatDuration(previewVideoCurrentTime);
  const previewVideoDurationLabel = formatDuration(previewVideoDuration);
  return {
    isLoading: false as const,
    layoutGroupId: `right-sidebar:${conversationId}`,
    headerProps: {
      showBackAction,
      onLeadingAction: handleLeadingAction,
      leadingAriaLabel: showBackAction ? t("goBackAriaLabel") : t("backAriaLabel"),
      showHeaderAvatar: screen === "info" && isSharedView,
      headerAvatarLayoutId,
      avatarUrl,
      avatarFallback,
      headerTitle,
      headerSubtitle,
      titleMotionKey: `${screen}:${isSharedView ? activeTab : "info"}:${selectedCandidateIds.length}`,
      canEditInfo,
      onEditInfo: handleEditInfo,
      editAriaLabel: isDirect ? t("members.editAriaLabel") : t("members.manageAriaLabel"),
    },
    viewportProps: {
      current: screen,
      direction: screenDirection,
      shouldSlide: sidebarAnimationsEnabled,
      scenes: screenNodes,
    },
    mediaPreviewProps: {
      activeImagePreview,
      activeVideoPreview,
      canUsePortal,
      previewZoomed,
      setPreviewZoomed,
      closeMediaPreview,
      handleDownloadFromPreview,
      handleDeleteFromPreview,
      canDeleteActivePreviewMessage,
      isDeletingMessage,
      previewVideoRef,
      previewVideoProgress,
      previewVideoCurrentTimeLabel,
      previewVideoDurationLabel,
      handlePreviewVideoTimelineClick,
      handleTogglePreviewVideoPlay,
      handleTogglePreviewVideoMute,
      isPreviewVideoPlaying,
      isPreviewVideoMuted,
      onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) =>
        setPreviewVideoDuration(
          Number.isFinite(event.currentTarget.duration)
            ? event.currentTarget.duration
            : 0,
        ),
      onTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) =>
        setPreviewVideoCurrentTime(
          Number.isFinite(event.currentTarget.currentTime)
            ? event.currentTarget.currentTime
            : 0,
        ),
      onPlay: () => {
        setIsPreviewVideoPlaying(true);
        setShouldPreviewVideoPlay(true);
      },
      onPause: () => {
        setIsPreviewVideoPlaying(false);
        setShouldPreviewVideoPlay(false);
      },
      onVolumeChange: (event: SyntheticEvent<HTMLVideoElement>) =>
        setIsPreviewVideoMuted(event.currentTarget.muted),
      t,
    },
  };
}
