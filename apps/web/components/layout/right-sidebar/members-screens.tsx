"use client";

import {
  type ConversationMemberResponseDtoRole,
  type UpdateMemberRoleRequestDtoRole,
  ConversationMemberResponseDtoRole as ConversationMemberRole,
  UpdateMemberRoleRequestDtoRole as UpdateMemberRoleRole,
} from "@/api/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getUserAvatarUrl,
  getUserDisplayName,
  getUserInitial,
} from "@/lib/chat";
import { cn } from "@/lib/utils";
import { Button, Input, Ripple, ScrollArea, Skeleton } from "@repo/ui";
import { motion } from "motion/react";
import {
  FiCheck,
  FiCheckCircle,
  FiCopy,
  FiEdit2,
  FiMessageCircle,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { IoSearch } from "react-icons/io5";
import { RightSidebarItemContextMenu } from "./primitives";
import type { MemberListItem, RightSidebarContextAction } from "./types";
import { getMemberRoleRank, SIDEBAR_FALLBACK_AVATAR_CLASS } from "./utils";

const MEMBER_ROLE_LABEL_KEY: Record<ConversationMemberResponseDtoRole, string> = {
  [ConversationMemberRole.MEMBER_ROLE_UNSPECIFIED]: "memberRole.member",
  [ConversationMemberRole.OWNER]: "memberRole.owner",
  [ConversationMemberRole.ADMIN]: "memberRole.admin",
  [ConversationMemberRole.MODERATOR]: "memberRole.moderator",
  [ConversationMemberRole.MEMBER]: "memberRole.member",
  [ConversationMemberRole.SUBSCRIBER]: "memberRole.subscriber",
  [ConversationMemberRole.UNRECOGNIZED]: "memberRole.member",
};

export function RightSidebarManageMembersScreen({
  membersSearchQuery,
  setMembersSearchQuery,
  members,
  currentMemberRole,
  defaultMemberRole,
  canManageMember,
  onWriteToMember,
  onCopyText,
  onUpdateMemberRole,
  onRemoveMember,
  onOpenAddMembers,
  showAddButton = true,
  addButtonAriaLabel,
  t,
}: {
  membersSearchQuery: string;
  setMembersSearchQuery: (value: string) => void;
  members: MemberListItem[];
  currentMemberRole: number;
  defaultMemberRole: UpdateMemberRoleRequestDtoRole;
  canManageMember: (targetUserId: string, targetRole: ConversationMemberResponseDtoRole) => boolean;
  onWriteToMember: (targetUserId: string) => Promise<void>;
  onCopyText: (value: string, titleValue: string) => Promise<void>;
  onUpdateMemberRole: (
    targetUserId: string,
    role: UpdateMemberRoleRequestDtoRole,
    successMessage: string,
  ) => Promise<void>;
  onRemoveMember: (targetUserId: string) => Promise<void>;
  onOpenAddMembers: () => void;
  showAddButton?: boolean;
  addButtonAriaLabel?: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const renderEmptyState = (label: string) => (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">{label}</div>
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-sidebar">
      <div className="border-b px-3 py-2.5">
        <Input
          value={membersSearchQuery}
          onChange={(event) => setMembersSearchQuery(event.target.value)}
          leftSlot={<IoSearch className="text-muted-foreground" />}
          placeholder={t("members.searchPlaceholder")}
          className="w-full"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-1.5 px-3 py-3 pb-24">
            {members.length === 0
              ? renderEmptyState(t("empty.members"))
              : members.map((member) => {
                const displayName = getUserDisplayName(member.user, t("unknownUser"));
                const roleKey = MEMBER_ROLE_LABEL_KEY[member.role] ?? "memberRole.member";
                const avatar = getUserAvatarUrl(member.user);
                const initial = getUserInitial(member.user, displayName || member.userId);
                const username = member.user?.username ? `@${member.user.username}` : "";
                const targetRole = member.role;
                const canManageTarget = canManageMember(member.userId, targetRole);
                const canPromoteToAdmin =
                  canManageTarget && targetRole !== ConversationMemberRole.ADMIN;
                const canRestrictRights =
                  canManageTarget && targetRole !== defaultMemberRole;
                const copyValue = username || displayName || member.userId;
                const actions: RightSidebarContextAction[] = [
                  {
                    key: `${member.userId}:write`,
                    label: t("context.write"),
                    icon: <FiMessageCircle />,
                    onSelect: () => void onWriteToMember(member.userId),
                  },
                  {
                    key: `${member.userId}:copy`,
                    label: t("context.copyUser"),
                    icon: <FiCopy />,
                    onSelect: () => void onCopyText(copyValue, t("context.userCopied")),
                  },
                ];

                if (canPromoteToAdmin && currentMemberRole <= 2) {
                  actions.push({
                    key: `${member.userId}:make-admin`,
                    label: t("context.makeAdmin"),
                    icon: <FiEdit2 />,
                    onSelect: () =>
                      void onUpdateMemberRole(
                        member.userId,
                        UpdateMemberRoleRole.ADMIN,
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
                      void onUpdateMemberRole(
                        member.userId,
                        defaultMemberRole,
                        t("members.rightsRestricted"),
                      ),
                  });
                }

                if (canManageTarget && getMemberRoleRank(targetRole) > 1) {
                  actions.push({
                    key: `${member.userId}:remove`,
                    label: t("context.removeMember"),
                    icon: <FiTrash2 />,
                    variant: "destructive",
                    onSelect: () => void onRemoveMember(member.userId),
                  });
                }

                  return (
                    <RightSidebarItemContextMenu key={member.userId} actions={actions}>
                      <motion.div
                        className="flex items-center gap-3 rounded-2xl bg-accent/25 px-3 py-2"
                        whileTap={{ scale: 0.992 }}
                        transition={{ duration: 0.12 }}
                      >
                        <Avatar className={cn("size-10", !avatar && SIDEBAR_FALLBACK_AVATAR_CLASS)}>
                          {avatar ? <AvatarImage src={avatar} alt="" /> : null}
                          <AvatarFallback className={!avatar ? "bg-transparent text-primary-foreground" : ""}>
                            {initial}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{displayName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {username || t(roleKey)}
                          </p>
                        </div>
                      </motion.div>
                    </RightSidebarItemContextMenu>
                  );
                })}
          </div>
        </ScrollArea>
      </div>

      {showAddButton ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-end p-4">
          <Button
            type="button"
            className="pointer-events-auto size-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/15 [&_svg]:size-7"
            onClick={onOpenAddMembers}
            aria-label={addButtonAriaLabel ?? t("members.addAriaLabel")}
          >
            <FiPlus />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function RightSidebarAddMembersScreen({
  candidateSearchQuery,
  setCandidateSearchQuery,
  isLoading,
  users,
  selectedCandidateIds,
  onToggleCandidate,
  onSubmit,
  isSubmitting,
  t,
}: {
  candidateSearchQuery: string;
  setCandidateSearchQuery: (value: string) => void;
  isLoading: boolean;
  users: MemberListItem["user"][];
  selectedCandidateIds: Set<string>;
  onToggleCandidate: (userId: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-sidebar">
      <div className="border-b px-3 py-2.5">
        <Input
          value={candidateSearchQuery}
          onChange={(event) => setCandidateSearchQuery(event.target.value)}
          leftSlot={<IoSearch className="text-muted-foreground" />}
          placeholder={t("members.searchUsersPlaceholder")}
          className="w-full"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-1.5 px-3 py-3">
            {isLoading ? (
              <>
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
              </>
            ) : users.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {t("members.emptySearch")}
              </div>
            ) : (
              users.map((user) => {
              if (!user?.id) {
                return null;
              }

              const userId = user.id;
              const displayName = getUserDisplayName(user, t("unknownUser"));
              const username = user.username ? `@${user.username}` : "";
              const isSelected = selectedCandidateIds.has(userId);
              const avatar = getUserAvatarUrl(user);
              const initial = getUserInitial(user, displayName || "#");

                return (
                  <Ripple key={userId} asChild>
                    <motion.button
                      type="button"
                      onClick={() => onToggleCandidate(userId)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-accent/30 px-3 py-2 text-left"
                      whileTap={{ scale: 0.992 }}
                    >
                      <Avatar className={cn("size-10", !avatar && SIDEBAR_FALLBACK_AVATAR_CLASS)}>
                        {avatar ? <AvatarImage src={avatar} alt="" /> : null}
                        <AvatarFallback className={!avatar ? "bg-transparent text-primary-foreground" : ""}>
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
          className="h-11 w-full rounded-2xl"
          disabled={selectedCandidateIds.size === 0 || isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting
            ? t("members.adding")
            : t("members.addSelected", { count: selectedCandidateIds.size })}
        </Button>
      </div>
    </div>
  );
}
