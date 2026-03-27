import type { RightSidebarScreen } from "./types";

export function getRightSidebarPreviousScreen(
  screen: RightSidebarScreen,
  addMembersParentScreen: "manage-members" | "manage-admins",
): RightSidebarScreen {
  if (screen === "add-members") {
    return addMembersParentScreen;
  }

  if (screen === "manage-discussion-create") {
    return "manage-discussion";
  }

  if (
    screen === "manage-channel-type" ||
    screen === "manage-invite-links" ||
    screen === "manage-reactions" ||
    screen === "manage-admin-messages" ||
    screen === "manage-discussion" ||
    screen === "manage-admins" ||
    screen === "manage-members"
  ) {
    return "manage-overview";
  }

  if (
    screen === "manage-invite-link-create" ||
    screen === "manage-invite-link-detail"
  ) {
    return "manage-invite-links";
  }

  return "info";
}

export function buildRightSidebarHeaderState({
  screen,
  isChannel,
  isGroup,
  isSharedView,
  title,
  activeTab,
  activeTabCount,
  memberCount,
  adminCount,
  selectedCandidateCount,
  t,
}: {
  screen: RightSidebarScreen;
  isChannel: boolean;
  isGroup: boolean;
  isSharedView: boolean;
  title: string;
  activeTab: string;
  activeTabCount: number;
  memberCount: number;
  adminCount: number;
  selectedCandidateCount: number;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const infoHeaderTitle = isChannel
    ? t("titles.channel")
    : isGroup
      ? t("titles.group")
      : t("titles.direct");

  const headerTitle =
    screen === "add-members"
      ? t("members.addTitle")
      : screen === "manage-overview"
        ? t("members.manageTitle")
        : screen === "manage-channel-type"
          ? t("manage.channelType")
          : screen === "manage-invite-links"
            ? t("manage.inviteLinks")
            : screen === "manage-invite-link-create"
              ? t("manage.createLink")
              : screen === "manage-invite-link-detail"
                ? t("manage.inviteLink")
                : screen === "manage-reactions"
                  ? t("manage.reactions")
                  : screen === "manage-admin-messages"
                    ? t("manage.adminMessages")
                    : screen === "manage-discussion"
                      ? t("manage.discussion")
                      : screen === "manage-discussion-create"
                        ? t("manage.createDiscussionScreenTitle")
                        : screen === "manage-admins"
                          ? t("manage.admins")
                          : screen === "manage-members"
                            ? isChannel
                              ? t("manage.subscribers")
                              : t("manage.members")
                            : isSharedView
                              ? title
                              : infoHeaderTitle;

  const headerSubtitle =
    screen === "add-members"
      ? t("header.selectedCounter", { count: selectedCandidateCount })
      : screen === "manage-admins"
        ? t("manage.adminsCounter", { count: adminCount })
        : screen === "manage-members"
          ? isChannel
            ? t("header.subscribersCounter", { count: memberCount })
            : t("header.membersCounter", { count: memberCount })
          : isSharedView
            ? t("header.tabCounter", {
                tab: t(`tabs.${activeTab}`),
                count: activeTabCount,
              })
            : "";

  return {
    headerTitle,
    headerSubtitle,
  };
}
