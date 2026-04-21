"use client";

import type {
  ConversationMemberResponseDtoRole,
  UpdateMemberRoleRequestDtoRole,
} from "@/api/generated";
import { UpdateMemberRoleRequestDtoRole as UpdateMemberRoleRole } from "@/api/generated";
import { Skeleton } from "@repo/ui";
import type { ReactNode, RefObject } from "react";
import type {
  MemberListItem,
  RightSidebarContextAction,
  RightSidebarScreen,
  SharedMediaAsset,
  SharedMessageEntry,
} from "./types";
import { RightSidebarInfoScreen } from "./info-screen";
import {
  type SidebarInviteLinkItem,
  RightSidebarAdminMessagesScreen,
  RightSidebarChannelTypeScreen,
  RightSidebarDiscussionCreateScreen,
  RightSidebarDiscussionScreen,
  RightSidebarInviteLinkCreateScreen,
  RightSidebarInviteLinkDetailScreen,
  RightSidebarInviteLinksScreen,
  RightSidebarManageOverviewScreen,
  RightSidebarReactionsScreen,
} from "./manage-overview-screen";
import {
  RightSidebarAddMembersScreen,
  RightSidebarManageMembersScreen,
} from "./members-screens";
import { RightSidebarTabs } from "./tabs-content";
import type { RightSidebarTab } from "@/store/right-sidebar/right-sidebar.types";

export function buildRightSidebarScreenNodes({
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
  onInfoViewportScroll,
  aboutLabel,
  publicLink,
  phoneLabel,
  usernameLabel,
  birthDateLabel,
  isChannel,
  isGroup,
  notificationsEnabled,
  canToggleNotifications,
  isUpdatingNotifications,
  onToggleNotifications,
  selectTab,
  membersSearchQuery,
  setMembersSearchQuery,
  filteredMemberItems,
  currentMemberRole,
  defaultMemberRole,
  canManageMember,
  onWriteToMember,
  onUpdateMemberRole,
  onRemoveMember,
  openAddMembersScreen,
  adminItems,
  draftTitle,
  draftAbout,
  draftIsPublic,
  inviteLinksCount,
  adminsCount,
  memberCount,
  discussionConversationTitle,
  signMessages,
  setSignMessages,
  setDraftTitle,
  setDraftAbout,
  persistConversationDraft,
  changeScreen,
  canDeleteChannel,
  onDeleteChannel,
  isDeletingChannel,
  hasDraftChanges,
  isSavingConversation,
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
  onUnlinkDiscussion,
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
  addCandidatesLoading,
  addCandidates,
  selectedCandidateIdSet,
  onToggleCandidate,
  submitAddMembers,
  isSubmittingAddMembers,
  t,
}: {
  activeTab: RightSidebarTab;
  tabDirection: 1 | -1;
  mediaMonthGroups: Array<{ key: string; label: string; items: SharedMediaAsset[] }>;
  fileMonthGroups: Array<{ key: string; label: string; items: SharedMediaAsset[] }>;
  linkMonthGroups: Array<{ key: string; label: string; items: Array<{ id: string; messageId: string; url: string; createdAt: number; authorId: string }> }>;
  voiceMonthGroups: Array<{ key: string; label: string; items: SharedMediaAsset[] }>;
  mediaEntries: SharedMediaAsset[];
  fileEntries: SharedMediaAsset[];
  linkEntries: Array<{ id: string; messageId: string; url: string; createdAt: number; authorId: string }>;
  voiceEntries: SharedMediaAsset[];
  isSharedMediaLoading: boolean;
  isFetchingSharedMediaNextPage: boolean;
  authorsMap?: Record<string, MemberListItem["user"] | null>;
  isDirect: boolean;
  locale: string;
  formatCreatedAt: (value: number) => string;
  renderEmptyState: (label: string) => ReactNode;
  openMessage: (messageId: string) => void;
  openImagePreview: (item: SharedMediaAsset, layoutId: string) => void;
  openVideoPreview: (item: SharedMediaAsset, layoutId: string) => void;
  playVoice: (voiceId: string, url: string) => Promise<void>;
  voiceProgress: Record<string, number>;
  voiceDuration: Record<string, number>;
  activeVoiceId: string | null;
  buildMessageContextActions: (
    entry: SharedMessageEntry,
    extraActions?: RightSidebarContextAction[],
  ) => RightSidebarContextAction[];
  downloadByMediaKey: (mediaKey: string) => Promise<void>;
  openExternalLink: (url: string) => void;
  copyText: (value: string, titleValue: string) => Promise<void>;
  title: string;
  profileSubtitle: string;
  avatarUrl: string;
  avatarFallback: string;
  avatarCollapseProgress: number;
  isSharedView: boolean;
  headerAvatarLayoutId: string;
  infoViewportRef: RefObject<HTMLDivElement | null>;
  tabsAnchorRef: RefObject<HTMLDivElement | null>;
  onInfoViewportScroll: () => void;
  aboutLabel: string;
  publicLink: string;
  phoneLabel: string;
  usernameLabel: string;
  birthDateLabel: string;
  isChannel: boolean;
  isGroup: boolean;
  notificationsEnabled: boolean;
  canToggleNotifications: boolean;
  isUpdatingNotifications: boolean;
  onToggleNotifications: (value: boolean) => void;
  selectTab: (nextTab: RightSidebarTab) => void;
  membersSearchQuery: string;
  setMembersSearchQuery: (value: string) => void;
  filteredMemberItems: MemberListItem[];
  currentMemberRole: number;
  defaultMemberRole: UpdateMemberRoleRequestDtoRole;
  canManageMember: (targetUserId: string, targetRole: ConversationMemberResponseDtoRole) => boolean;
  onWriteToMember: (targetUserId: string) => Promise<void>;
  onUpdateMemberRole: (
    targetUserId: string,
    role: UpdateMemberRoleRequestDtoRole,
    successMessage: string,
  ) => Promise<void>;
  onRemoveMember: (targetUserId: string) => Promise<void>;
  openAddMembersScreen: (
    parentScreen: "manage-members" | "manage-admins",
    role: UpdateMemberRoleRequestDtoRole,
  ) => void;
  adminItems: MemberListItem[];
  draftTitle: string;
  draftAbout: string;
  draftIsPublic: boolean;
  inviteLinksCount: number;
  adminsCount: number;
  memberCount: number;
  discussionConversationTitle: string;
  signMessages: boolean;
  setSignMessages: (value: boolean) => void;
  setDraftTitle: (value: string) => void;
  setDraftAbout: (value: string) => void;
  persistConversationDraft: () => void;
  changeScreen: (nextScreen: RightSidebarScreen) => void;
  canDeleteChannel: boolean;
  onDeleteChannel: () => void;
  isDeletingChannel: boolean;
  hasDraftChanges: boolean;
  isSavingConversation: boolean;
  draftUsername: string;
  contentProtectionEnabled: boolean;
  setDraftIsPublic: (value: boolean) => void;
  setDraftUsername: (value: string) => void;
  setContentProtectionEnabled: (value: boolean) => void;
  draftPublicLink: string;
  additionalInviteLinks: SidebarInviteLinkItem[];
  setSelectedInviteLinkId: (value: string | null) => void;
  inviteLinkDraftTitle: string;
  inviteMonthlyFeeEnabled: boolean;
  inviteRequestsEnabled: boolean;
  inviteDurationValue: number;
  inviteUsageLimitValue: number;
  setInviteLinkDraftTitle: (value: string) => void;
  setInviteMonthlyFeeEnabled: (value: boolean) => void;
  setInviteRequestsEnabled: (value: boolean) => void;
  setInviteDurationValue: (value: number) => void;
  setInviteUsageLimitValue: (value: number) => void;
  handleCreateInviteLink: () => void;
  selectedInviteLink: SidebarInviteLinkItem | null;
  reactionsEnabled: boolean;
  reactionItems: Array<{ emoji: string; label: string; checked: boolean }>;
  setReactionsEnabled: (value: boolean) => void;
  toggleReactionItem: (emoji: string) => void;
  adminMessagesEnabled: boolean;
  adminMessagesPrice: number;
  setAdminMessagesEnabled: (value: boolean) => void;
  setAdminMessagesPrice: (value: number) => void;
  draftDiscussionConversationId: string;
  openDiscussionCreateScreen: () => void;
  openDiscussionChat: () => void;
  onUnlinkDiscussion: () => void;
  isMutatingDiscussion: boolean;
  draftDiscussionTitle: string;
  discussionDraftAvatarUrl: string;
  discussionDraftAvatarFallback: string;
  isUploadingDiscussionAvatar: boolean;
  isCreatingDiscussion: boolean;
  setDraftDiscussionTitle: (value: string) => void;
  handleUploadDiscussionAvatar: (file: File) => Promise<void>;
  handleCreateDiscussionGroup: () => void;
  candidateSearchQuery: string;
  setCandidateSearchQuery: (value: string) => void;
  addCandidatesLoading: boolean;
  addCandidates: MemberListItem["user"][];
  selectedCandidateIdSet: Set<string>;
  onToggleCandidate: (userId: string) => void;
  submitAddMembers: () => void;
  isSubmittingAddMembers: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}): Record<RightSidebarScreen, ReactNode> {
  return {
    info: (
      <RightSidebarInfoScreen
        title={title}
        profileSubtitle={profileSubtitle}
        avatarUrl={avatarUrl}
        avatarFallback={avatarFallback}
        avatarCollapseProgress={avatarCollapseProgress}
        isSharedView={isSharedView}
        headerAvatarLayoutId={headerAvatarLayoutId}
        infoViewportRef={infoViewportRef}
        tabsAnchorRef={tabsAnchorRef}
        onViewportScroll={onInfoViewportScroll}
        aboutLabel={aboutLabel}
        publicLink={publicLink}
        phoneLabel={phoneLabel}
        usernameLabel={usernameLabel}
        birthDateLabel={birthDateLabel}
        isChannel={isChannel}
        isGroup={isGroup}
        notificationsEnabled={notificationsEnabled}
        canToggleNotifications={canToggleNotifications}
        isUpdatingNotifications={isUpdatingNotifications}
        onToggleNotifications={onToggleNotifications}
        onCopyValue={copyText}
        t={t}
        tabs={
          <>
            <RightSidebarTabs
              activeTab={activeTab}
              setActiveTab={selectTab}
              tabDirection={tabDirection}
              mediaMonthGroups={mediaMonthGroups}
              fileMonthGroups={fileMonthGroups}
              linkMonthGroups={linkMonthGroups}
              voiceMonthGroups={voiceMonthGroups}
              mediaEntries={mediaEntries}
              fileEntries={fileEntries}
              linkEntries={linkEntries}
              voiceEntries={voiceEntries}
              isSharedMediaLoading={isSharedMediaLoading}
              authorsMap={authorsMap}
              isDirect={isDirect}
              locale={locale}
              formatCreatedAt={formatCreatedAt}
              renderEmptyState={renderEmptyState}
              openMessage={openMessage}
              openImagePreview={openImagePreview}
              openVideoPreview={openVideoPreview}
              playVoice={playVoice}
              voiceProgress={voiceProgress}
              voiceDuration={voiceDuration}
              activeVoiceId={activeVoiceId}
              buildMessageContextActions={buildMessageContextActions}
              downloadByMediaKey={downloadByMediaKey}
              openExternalLink={openExternalLink}
              copyText={copyText}
              t={t}
            />
            {isFetchingSharedMediaNextPage ? (
              <div className="space-y-2 px-3 pb-4">
                <Skeleton className="h-10 w-full rounded-2xl" />
                <Skeleton className="h-10 w-full rounded-2xl" />
              </div>
            ) : null}
          </>
        }
      />
    ),
    "manage-overview": (
      <RightSidebarManageOverviewScreen
        avatarUrl={avatarUrl}
        avatarFallback={avatarFallback}
        title={draftTitle}
        about={draftAbout}
        isChannel={isChannel}
        isPublic={draftIsPublic}
        inviteLinksCount={inviteLinksCount}
        adminsCount={adminsCount}
        membersCount={memberCount}
        discussionTitle={discussionConversationTitle}
        signMessages={signMessages}
        setSignMessages={setSignMessages}
        onTitleChange={setDraftTitle}
        onAboutChange={setDraftAbout}
        onPersist={persistConversationDraft}
        onOpenChannelType={() => changeScreen("manage-channel-type")}
        onOpenInviteLinks={() => changeScreen("manage-invite-links")}
        onOpenReactions={() => changeScreen("manage-reactions")}
        onOpenAdminMessages={() => changeScreen("manage-admin-messages")}
        onOpenDiscussion={() => changeScreen("manage-discussion")}
        onOpenAdmins={() => changeScreen("manage-admins")}
        onOpenMembers={() => changeScreen("manage-members")}
        canDeleteChannel={canDeleteChannel}
        onDeleteChannel={onDeleteChannel}
        isDeletingChannel={isDeletingChannel}
        hasDraftChanges={hasDraftChanges}
        isSaving={isSavingConversation}
        t={t}
      />
    ),
    "manage-channel-type": (
      <RightSidebarChannelTypeScreen
        isPublic={draftIsPublic}
        username={draftUsername}
        contentProtectionEnabled={contentProtectionEnabled}
        onSetPublic={setDraftIsPublic}
        onUsernameChange={setDraftUsername}
        onPersist={persistConversationDraft}
        onToggleContentProtection={setContentProtectionEnabled}
        t={t}
      />
    ),
    "manage-invite-links": (
      <RightSidebarInviteLinksScreen
        mainLink={draftPublicLink || t("manage.noPublicLink")}
        links={additionalInviteLinks}
        onOpenCreate={() => changeScreen("manage-invite-link-create")}
        onOpenLink={(id) => {
          setSelectedInviteLinkId(id);
          changeScreen("manage-invite-link-detail");
        }}
        onCopyLink={(url) => {
          void copyText(url, t("context.linkCopied"));
        }}
        t={t}
      />
    ),
    "manage-invite-link-create": (
      <RightSidebarInviteLinkCreateScreen
        title={inviteLinkDraftTitle}
        monthlyFeeEnabled={inviteMonthlyFeeEnabled}
        requestsEnabled={inviteRequestsEnabled}
        durationValue={inviteDurationValue}
        usageLimitValue={inviteUsageLimitValue}
        onTitleChange={setInviteLinkDraftTitle}
        onSetMonthlyFeeEnabled={setInviteMonthlyFeeEnabled}
        onSetRequestsEnabled={setInviteRequestsEnabled}
        onSetDurationValue={setInviteDurationValue}
        onSetUsageLimitValue={setInviteUsageLimitValue}
        onCreate={handleCreateInviteLink}
        t={t}
      />
    ),
    "manage-invite-link-detail": (
      <RightSidebarInviteLinkDetailScreen
        link={selectedInviteLink}
        onCopyLink={(url) => {
          void copyText(url, t("context.linkCopied"));
        }}
        t={t}
      />
    ),
    "manage-reactions": (
      <RightSidebarReactionsScreen
        enabled={reactionsEnabled}
        items={reactionItems}
        onSetEnabled={setReactionsEnabled}
        onToggleItem={toggleReactionItem}
        t={t}
      />
    ),
    "manage-admin-messages": (
      <RightSidebarAdminMessagesScreen
        enabled={adminMessagesEnabled}
        price={adminMessagesPrice}
        onSetEnabled={setAdminMessagesEnabled}
        onSetPrice={setAdminMessagesPrice}
        t={t}
      />
    ),
    "manage-discussion": (
      <RightSidebarDiscussionScreen
        title={discussionConversationTitle}
        linkedConversationId={draftDiscussionConversationId}
        onCreateDiscussion={openDiscussionCreateScreen}
        onOpenDiscussionChat={openDiscussionChat}
        onUnlinkDiscussion={onUnlinkDiscussion}
        isMutatingDiscussion={isMutatingDiscussion}
        t={t}
      />
    ),
    "manage-discussion-create": (
      <RightSidebarDiscussionCreateScreen
        title={draftDiscussionTitle}
        avatarUrl={discussionDraftAvatarUrl}
        avatarFallback={discussionDraftAvatarFallback}
        isUploadingAvatar={isUploadingDiscussionAvatar}
        isSubmitting={isCreatingDiscussion}
        onTitleChange={setDraftDiscussionTitle}
        onUploadAvatar={handleUploadDiscussionAvatar}
        onSubmit={handleCreateDiscussionGroup}
        t={t}
      />
    ),
    "manage-admins": (
      <RightSidebarManageMembersScreen
        membersSearchQuery={membersSearchQuery}
        setMembersSearchQuery={setMembersSearchQuery}
        members={adminItems}
        currentMemberRole={currentMemberRole}
        defaultMemberRole={defaultMemberRole}
        canManageMember={canManageMember}
        onWriteToMember={onWriteToMember}
        onCopyText={copyText}
        onUpdateMemberRole={onUpdateMemberRole}
        onRemoveMember={onRemoveMember}
        onOpenAddMembers={() =>
          openAddMembersScreen("manage-admins", UpdateMemberRoleRole.ADMIN)
        }
        showAddButton={currentMemberRole > 0 && currentMemberRole <= 2}
        addButtonAriaLabel={t("manage.addAdmin")}
        t={t}
      />
    ),
    "manage-members": (
      <RightSidebarManageMembersScreen
        membersSearchQuery={membersSearchQuery}
        setMembersSearchQuery={setMembersSearchQuery}
        members={filteredMemberItems}
        currentMemberRole={currentMemberRole}
        defaultMemberRole={defaultMemberRole}
        canManageMember={canManageMember}
        onWriteToMember={onWriteToMember}
        onCopyText={copyText}
        onUpdateMemberRole={onUpdateMemberRole}
        onRemoveMember={onRemoveMember}
        onOpenAddMembers={() =>
          openAddMembersScreen("manage-members", defaultMemberRole)
        }
        t={t}
      />
    ),
    "add-members": (
      <RightSidebarAddMembersScreen
        candidateSearchQuery={candidateSearchQuery}
        setCandidateSearchQuery={setCandidateSearchQuery}
        isLoading={addCandidatesLoading}
        users={addCandidates}
        selectedCandidateIds={selectedCandidateIdSet}
        onToggleCandidate={onToggleCandidate}
        onSubmit={submitAddMembers}
        isSubmitting={isSubmittingAddMembers}
        t={t}
      />
    ),
  };
}
