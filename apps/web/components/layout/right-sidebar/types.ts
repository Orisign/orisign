"use client";

import type {
  ConversationMemberResponseDtoRole,
  ConversationMemberResponseDtoState,
  GetConversationResponseDto,
  PrivacySettingsResponseDtoBirthDate,
  PrivacySettingsResponseDtoPhone,
} from "@/api/generated";
import type { RightSidebarTab } from "@/store/right-sidebar/right-sidebar.types";
import type { ReactNode } from "react";

export interface RightSidebarProps {
  conversationId: string;
}

export interface SharedMediaAsset {
  id: string;
  messageId: string;
  mediaKey: string;
  url: string;
  kind: string;
  createdAt: number;
  authorId: string;
  text: string;
}

export interface SharedLinkAsset {
  id: string;
  messageId: string;
  url: string;
  createdAt: number;
  authorId: string;
}

export interface SharedMessageEntry {
  messageId: string;
  authorId: string;
}

export interface SidebarPreviewState {
  messageId: string;
  mediaKey: string;
  url: string;
  kind: string;
  layoutId: string;
}

export interface RightSidebarContextAction {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  variant?: "default" | "destructive";
}

export interface MonthGroup<T> {
  key: string;
  label: string;
  items: T[];
}

export type RightSidebarScreen =
  | "info"
  | "manage-overview"
  | "manage-channel-type"
  | "manage-invite-links"
  | "manage-invite-link-create"
  | "manage-invite-link-detail"
  | "manage-reactions"
  | "manage-admin-messages"
  | "manage-discussion"
  | "manage-discussion-create"
  | "manage-admins"
  | "manage-members"
  | "add-members";

export interface MemberListItem {
  userId: string;
  role: ConversationMemberResponseDtoRole;
  state: ConversationMemberResponseDtoState;
  user: {
    id?: string;
    username?: string;
    phone?: string;
    firstName: string;
    lastName?: string;
    bio?: string;
    avatars: string[];
    birthDate?: number;
    privacySettings: {
      phone: PrivacySettingsResponseDtoPhone;
      birthDate: PrivacySettingsResponseDtoBirthDate;
    };
  } | null;
}

export type ConversationLike = GetConversationResponseDto["conversation"];

export interface RightSidebarTabsProps {
  activeTab: RightSidebarTab;
  setActiveTab: (tab: RightSidebarTab) => void;
  tabDirection: 1 | -1;
  mediaMonthGroups: MonthGroup<SharedMediaAsset>[];
  fileMonthGroups: MonthGroup<SharedMediaAsset>[];
  linkMonthGroups: MonthGroup<SharedLinkAsset>[];
  voiceMonthGroups: MonthGroup<SharedMediaAsset>[];
  mediaEntries: SharedMediaAsset[];
  fileEntries: SharedMediaAsset[];
  linkEntries: SharedLinkAsset[];
  voiceEntries: SharedMediaAsset[];
  isSharedMediaLoading: boolean;
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
  t: (key: string, values?: Record<string, string | number>) => string;
}
