"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  RadioGroup,
  RadioGroupItem,
  Ripple,
  ScrollArea,
  Slider,
  Switch,
  Textarea,
  cn,
} from "@repo/ui";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  IoBanOutline,
  IoCameraOutline,
  IoChatbubbleEllipsesOutline,
  IoChevronForward,
  IoLinkOutline,
  IoLockClosedOutline,
  IoPeopleOutline,
  IoShieldCheckmarkOutline,
  IoSparklesOutline,
  IoStarOutline,
  IoTimeOutline,
  IoTrashOutline,
} from "react-icons/io5";
import { RightSidebarInfoIcon } from "./primitives";
import { SIDEBAR_FALLBACK_AVATAR_CLASS } from "./utils";

export interface SidebarInviteLinkItem {
  id: string;
  title: string;
  url: string;
  joinedCountLabel: string;
  creatorLabel: string;
  createdAtLabel: string;
}

function ManageRow({
  icon,
  title,
  value,
  onClick,
  destructive = false,
}: {
  icon: ReactNode;
  title: string;
  value?: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  return (
    <Ripple asChild>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-accent",
          destructive && "text-destructive hover:bg-destructive/10",
        )}
      >
        <RightSidebarInfoIcon className={destructive ? "text-destructive" : undefined}>
          {icon}
        </RightSidebarInfoIcon>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.98rem] font-semibold">{title}</span>
          {value ? (
            <span className="mt-0.5 block text-sm text-muted-foreground">{value}</span>
          ) : null}
        </span>
        {!destructive ? (
          <span className="pt-0.5 text-muted-foreground">
            <IoChevronForward className="size-5" />
          </span>
        ) : null}
      </button>
    </Ripple>
  );
}

function SectionCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b px-2 py-2">
      {title ? (
        <p className="px-2 pb-2 pt-1 text-[0.94rem] font-semibold text-primary">
          {title}
        </p>
      ) : null}
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export function RightSidebarManageOverviewScreen({
  avatarUrl,
  avatarFallback,
  title,
  about,
  isChannel,
  isPublic,
  inviteLinksCount,
  adminsCount,
  membersCount,
  discussionTitle,
  signMessages,
  setSignMessages,
  onTitleChange,
  onAboutChange,
  onPersist,
  onOpenChannelType,
  onOpenInviteLinks,
  onOpenReactions,
  onOpenAdminMessages,
  onOpenDiscussion,
  onOpenAdmins,
  onOpenMembers,
  canDeleteChannel,
  onDeleteChannel,
  isDeletingChannel,
  t,
}: {
  avatarUrl: string;
  avatarFallback: string;
  title: string;
  about: string;
  isChannel: boolean;
  isPublic: boolean;
  inviteLinksCount: number;
  adminsCount: number;
  membersCount: number;
  discussionTitle: string;
  signMessages: boolean;
  setSignMessages: (value: boolean) => void;
  onTitleChange: (value: string) => void;
  onAboutChange: (value: string) => void;
  onPersist: () => void;
  onOpenChannelType: () => void;
  onOpenInviteLinks: () => void;
  onOpenReactions: () => void;
  onOpenAdminMessages: () => void;
  onOpenDiscussion: () => void;
  onOpenAdmins: () => void;
  onOpenMembers: () => void;
  canDeleteChannel: boolean;
  onDeleteChannel: () => void;
  isDeletingChannel: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <div className="flex min-h-0 flex-1 flex-col bg-sidebar">
        <ScrollArea className="h-full">
        <section className="border-b px-4 pb-5 pt-5">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar className={`size-28 ${!avatarUrl ? SIDEBAR_FALLBACK_AVATAR_CLASS : ""}`}>
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                <AvatarFallback className={!avatarUrl ? "bg-transparent text-[1.75rem] text-primary-foreground" : ""}>
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
                <IoCameraOutline className="size-11" />
              </span>
            </div>

            <div className="mt-5 w-full space-y-3 text-left">
              <Input
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                onBlur={onPersist}
                placeholder={t("manage.fields.titlePlaceholder")}
                className="h-12 rounded-2xl"
              />
              <Textarea
                value={about}
                onChange={(event) => onAboutChange(event.target.value)}
                onBlur={onPersist}
                placeholder={t("manage.fields.aboutPlaceholder")}
                className="min-h-40 rounded-2xl resize-none"
              />
            </div>
          </div>
        </section>

        <section className="border-b px-4 py-3">
          <p className="text-sm text-muted-foreground">{t("manage.fields.aboutHint")}</p>
        </section>

        <SectionCard>
          {isChannel ? (
            <ManageRow
              icon={<IoLockClosedOutline />}
              title={t("manage.channelType")}
              value={isPublic ? t("manage.publicChannel") : t("manage.privateChannel")}
              onClick={onOpenChannelType}
            />
          ) : null}

          {isChannel ? (
            <ManageRow
              icon={<IoLinkOutline />}
              title={t("manage.inviteLinks")}
              value={String(inviteLinksCount)}
              onClick={onOpenInviteLinks}
            />
          ) : null}

          {isChannel ? (
            <ManageRow
              icon={<IoSparklesOutline />}
              title={t("manage.reactions")}
              value={t("manage.enabledValue")}
              onClick={onOpenReactions}
            />
          ) : null}

          {isChannel ? (
            <ManageRow
              icon={<IoStarOutline />}
              title={t("manage.adminMessages")}
              value={t("manage.adminMessagesValue")}
              onClick={onOpenAdminMessages}
            />
          ) : null}

          {isChannel ? (
            <ManageRow
              icon={<IoChatbubbleEllipsesOutline />}
              title={t("manage.discussion")}
              value={
                discussionTitle
                  ? t("manage.discussionValue")
                  : t("manage.noDiscussion")
              }
              onClick={onOpenDiscussion}
            />
          ) : null}

          {isChannel ? (
            <ManageRow
              icon={<IoTimeOutline />}
              title={t("manage.recentActions")}
              value={t("manage.recentActionsValue")}
            />
          ) : null}
        </SectionCard>

        <SectionCard>
          <ManageRow
            icon={<IoShieldCheckmarkOutline />}
            title={t("manage.admins")}
            value={String(adminsCount)}
            onClick={onOpenAdmins}
          />

          <ManageRow
            icon={<IoPeopleOutline />}
            title={isChannel ? t("manage.subscribers") : t("manage.members")}
            value={String(membersCount)}
            onClick={onOpenMembers}
          />

          {isChannel ? (
            <ManageRow
              icon={<IoBanOutline />}
              title={t("manage.blacklist")}
              value={t("manage.blacklistEmpty")}
            />
          ) : null}
        </SectionCard>

        {isChannel ? (
          <SectionCard>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-accent">
              <RightSidebarInfoIcon>
                <IoStarOutline />
              </RightSidebarInfoIcon>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.98rem] font-semibold">{t("manage.signMessages")}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {t("manage.signMessagesHint")}
                </span>
              </span>
              <Switch checked={signMessages} onCheckedChange={setSignMessages} />
            </label>
          </SectionCard>
        ) : null}

        {isChannel && canDeleteChannel ? (
          <SectionCard>
            <ManageRow
              icon={<IoTrashOutline />}
              title={t("manage.deleteChannel")}
              onClick={() => setIsDeleteDialogOpen(true)}
              destructive
            />
          </SectionCard>
        ) : null}
        </ScrollArea>
      </div>

      <DialogContent className="max-w-[28rem]">
        <DialogHeader>
          <DialogTitle>{t("manage.deleteDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("manage.deleteDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsDeleteDialogOpen(false)}
            disabled={isDeletingChannel}
          >
            {t("manage.deleteDialog.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onDeleteChannel}
            disabled={isDeletingChannel}
          >
            {t("manage.deleteDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RightSidebarChannelTypeScreen({
  isPublic,
  username,
  contentProtectionEnabled,
  onSetPublic,
  onUsernameChange,
  onPersist,
  onToggleContentProtection,
  t,
}: {
  isPublic: boolean;
  username: string;
  contentProtectionEnabled: boolean;
  onSetPublic: (value: boolean) => void;
  onUsernameChange: (value: string) => void;
  onPersist: () => void;
  onToggleContentProtection: (value: boolean) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-sidebar">
      <ScrollArea className="h-full">
        <section className="border-b px-4 py-5">
          <p className="pb-4 text-[0.94rem] font-semibold text-primary">{t("manage.channelType")}</p>
          <RadioGroup
            value={isPublic ? "public" : "private"}
            onValueChange={(value) => {
              const nextIsPublic = value === "public";
              onSetPublic(nextIsPublic);
              if (!nextIsPublic || username.trim()) {
                onPersist();
              }
            }}
            className="gap-5"
          >
            <label className="flex items-start gap-4">
              <RadioGroupItem value="private" className="mt-1" />
              <span className="min-w-0">
                <span className="block text-[1rem] font-semibold">{t("manage.privateChannel")}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {t("manage.privateChannelHint")}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-4">
              <RadioGroupItem value="public" className="mt-1" />
              <span className="min-w-0">
                <span className="block text-[1rem] font-semibold">{t("manage.publicChannel")}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {t("manage.publicChannelHint")}
                </span>
              </span>
            </label>
          </RadioGroup>
        </section>

        <section className="border-b px-4 py-4">
          <p className="pb-2 text-sm text-muted-foreground">{t("manage.linkLabel")}</p>
          <Input
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            onBlur={onPersist}
            placeholder="channel-link"
            className="h-12 rounded-2xl"
            disabled={!isPublic}
          />
        </section>

        <SectionCard title={t("manage.contentProtection")}>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-accent">
            <RightSidebarInfoIcon>
              <IoLockClosedOutline />
            </RightSidebarInfoIcon>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.98rem] font-semibold">{t("manage.prohibitCopying")}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {t("manage.prohibitCopyingHint")}
              </span>
            </span>
            <Switch
              checked={contentProtectionEnabled}
              onCheckedChange={onToggleContentProtection}
            />
          </label>
        </SectionCard>
      </ScrollArea>
    </div>
  );
}

export function RightSidebarInviteLinksScreen({
  mainLink,
  links,
  onOpenCreate,
  onOpenLink,
  onCopyLink,
  t,
}: {
  mainLink: string;
  links: SidebarInviteLinkItem[];
  onOpenCreate: () => void;
  onOpenLink: (id: string) => void;
  onCopyLink: (url: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-sidebar">
      <ScrollArea className="h-full">
        <section className="border-b px-4 py-5 text-center">
          <div className="mx-auto flex size-28 items-center justify-center rounded-full bg-accent text-primary">
            <IoLinkOutline className="size-14" />
          </div>
          <p className="mx-auto mt-5 max-w-xs text-sm text-muted-foreground">
            {t("manage.inviteLinksHint")}
          </p>
        </section>

        <section className="border-b px-4 py-4">
          <p className="pb-2 text-[0.94rem] font-semibold text-primary">{t("manage.inviteLink")}</p>
          <div className="rounded-2xl bg-accent/70 p-3">
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 truncate text-[1.05rem] font-semibold">{mainLink}</p>
              <button type="button" className="text-muted-foreground" onClick={() => onCopyLink(mainLink)}>
                <IoChevronForward className="size-5 rotate-90" />
              </button>
            </div>
          </div>
          <Button type="button" className="mt-3 h-12 w-full rounded-2xl" onClick={() => onCopyLink(mainLink)}>
            {t("manage.shareLink")}
          </Button>
        </section>

        <SectionCard title={t("manage.additionalLinks")}>
          <ManageRow
            icon={<IoLinkOutline />}
            title={t("manage.createLink")}
            onClick={onOpenCreate}
          />

          {links.map((link) => (
            <ManageRow
              key={link.id}
              icon={<IoLinkOutline />}
              title={link.title}
              value={link.joinedCountLabel}
              onClick={() => onOpenLink(link.id)}
            />
          ))}
        </SectionCard>
      </ScrollArea>
    </div>
  );
}

export function RightSidebarInviteLinkCreateScreen({
  title,
  monthlyFeeEnabled,
  requestsEnabled,
  durationValue,
  usageLimitValue,
  onTitleChange,
  onSetMonthlyFeeEnabled,
  onSetRequestsEnabled,
  onSetDurationValue,
  onSetUsageLimitValue,
  onCreate,
  t,
}: {
  title: string;
  monthlyFeeEnabled: boolean;
  requestsEnabled: boolean;
  durationValue: number;
  usageLimitValue: number;
  onTitleChange: (value: string) => void;
  onSetMonthlyFeeEnabled: (value: boolean) => void;
  onSetRequestsEnabled: (value: boolean) => void;
  onSetDurationValue: (value: number) => void;
  onSetUsageLimitValue: (value: number) => void;
  onCreate: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-sidebar">
      <ScrollArea className="h-full">
        <section className="border-b px-4 py-4">
          <Input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={t("manage.linkNamePlaceholder")}
            className="h-12 rounded-2xl"
          />
        </section>

        <SectionCard>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-accent">
            <RightSidebarInfoIcon><IoStarOutline /></RightSidebarInfoIcon>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.98rem] font-semibold">{t("manage.monthlyFee")}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{t("manage.monthlyFeeHint")}</span>
            </span>
            <Switch checked={monthlyFeeEnabled} onCheckedChange={onSetMonthlyFeeEnabled} />
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-accent">
            <RightSidebarInfoIcon><IoChatbubbleEllipsesOutline /></RightSidebarInfoIcon>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.98rem] font-semibold">{t("manage.joinRequests")}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{t("manage.joinRequestsHint")}</span>
            </span>
            <Switch checked={requestsEnabled} onCheckedChange={onSetRequestsEnabled} />
          </label>
        </SectionCard>

        <SectionCard title={t("manage.duration")}>
          <div className="px-4 pb-3">
            <Slider
              value={[durationValue]}
              max={4}
              min={0}
              step={1}
              onValueChange={(values) => onSetDurationValue(values[0] ?? 0)}
            />
            <div className="mt-3 flex justify-between text-sm text-muted-foreground">
              <span>{t("manage.durationValue", { value: durationValue })}</span>
              <span>{durationValue >= 4 ? t("manage.unlimited") : t("manage.resetAt")}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t("manage.userLimit")}>
          <div className="px-4 pb-3">
            <Slider
              value={[usageLimitValue]}
              max={4}
              min={0}
              step={1}
              onValueChange={(values) => onSetUsageLimitValue(values[0] ?? 0)}
            />
            <div className="mt-3 flex justify-between text-sm text-muted-foreground">
              <span>{t("manage.userLimitValue", { value: usageLimitValue })}</span>
              <span>{usageLimitValue >= 4 ? t("manage.unlimited") : t("manage.usageCount")}</span>
            </div>
          </div>
        </SectionCard>
      </ScrollArea>

      <div className="border-t px-4 py-3">
        <Button type="button" className="h-12 w-full rounded-2xl" onClick={onCreate}>
          {t("manage.createLink")}
        </Button>
      </div>
    </div>
  );
}

export function RightSidebarInviteLinkDetailScreen({
  link,
  onCopyLink,
  t,
}: {
  link: SidebarInviteLinkItem | null;
  onCopyLink: (url: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-sidebar">
      <ScrollArea className="h-full">
        <section className="border-b px-4 py-4">
          <p className="pb-2 text-[0.94rem] font-semibold text-primary">{t("manage.inviteLink")}</p>
          <div className="rounded-2xl bg-accent/70 p-3">
            <p className="truncate text-[1.05rem] font-semibold">{link?.url ?? "t.me/..."}</p>
          </div>
          <Button
            type="button"
            className="mt-3 h-12 w-full rounded-2xl"
            onClick={() => onCopyLink(link?.url ?? "")}
          >
            {t("manage.shareLink")}
          </Button>
        </section>

        <SectionCard title={t("manage.linkCreatedBy")}>
          <div className="px-4 py-2">
            <p className="text-[1rem] font-semibold">{link?.creatorLabel ?? "-"}</p>
            <p className="text-sm text-muted-foreground">{link?.createdAtLabel ?? "-"}</p>
          </div>
        </SectionCard>
      </ScrollArea>
    </div>
  );
}

export function RightSidebarReactionsScreen({
  enabled,
  items,
  onSetEnabled,
  onToggleItem,
  t,
}: {
  enabled: boolean;
  items: Array<{ emoji: string; label: string; checked: boolean }>;
  onSetEnabled: (value: boolean) => void;
  onToggleItem: (emoji: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-sidebar">
      <ScrollArea className="h-full">
        <SectionCard>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-accent">
            <RightSidebarInfoIcon><IoSparklesOutline /></RightSidebarInfoIcon>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.98rem] font-semibold">{t("manage.enableReactions")}</span>
            </span>
            <Switch checked={enabled} onCheckedChange={onSetEnabled} />
          </label>
        </SectionCard>

        <SectionCard title={t("manage.enableOnlyThese")}>
          {items.map((item) => (
            <label key={item.emoji} className="flex cursor-pointer items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-accent">
              <span className="text-3xl leading-none">{item.emoji}</span>
              <span className="min-w-0 flex-1 text-[0.98rem] font-semibold">{item.label}</span>
              <Switch checked={item.checked} onCheckedChange={() => onToggleItem(item.emoji)} />
            </label>
          ))}
        </SectionCard>
      </ScrollArea>
    </div>
  );
}

export function RightSidebarAdminMessagesScreen({
  enabled,
  price,
  onSetEnabled,
  onSetPrice,
  t,
}: {
  enabled: boolean;
  price: number;
  onSetEnabled: (value: boolean) => void;
  onSetPrice: (value: number) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-sidebar">
      <ScrollArea className="h-full">
        <SectionCard>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-accent">
            <RightSidebarInfoIcon><IoChatbubbleEllipsesOutline /></RightSidebarInfoIcon>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.98rem] font-semibold">{t("manage.acceptAdminMessages")}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{t("manage.acceptAdminMessagesHint")}</span>
            </span>
            <Switch checked={enabled} onCheckedChange={onSetEnabled} />
          </label>
        </SectionCard>

        <SectionCard title={t("manage.adminMessagesPrice")}>
          <div className="px-4 pb-3">
            <Slider
              value={[price]}
              max={10000}
              min={0}
              step={100}
              onValueChange={(values) => onSetPrice(values[0] ?? 0)}
            />
            <div className="mt-3 flex justify-between text-sm text-muted-foreground">
              <span>0</span>
              <span className="font-semibold text-foreground">{price}</span>
              <span>10 000</span>
            </div>
          </div>
        </SectionCard>
      </ScrollArea>
    </div>
  );
}

export function RightSidebarDiscussionScreen({
  title,
  linkedConversationId,
  onCreateDiscussion,
  onOpenDiscussionChat,
  onUnlinkDiscussion,
  isMutatingDiscussion,
  t,
}: {
  title: string;
  linkedConversationId: string;
  onCreateDiscussion: () => void;
  onOpenDiscussionChat: () => void;
  onUnlinkDiscussion: () => void;
  isMutatingDiscussion: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-sidebar">
      <ScrollArea className="h-full">
        <section className="border-b px-4 py-8 text-center">
          <div className="mx-auto flex size-28 items-center justify-center rounded-full bg-accent text-primary">
            <IoChatbubbleEllipsesOutline className="size-14" />
          </div>
          <p className="mx-auto mt-5 max-w-xs text-sm text-muted-foreground">
            {t("manage.discussionHint")}
          </p>
        </section>

        <SectionCard>
          {linkedConversationId ? (
            <ManageRow
              icon={<IoPeopleOutline />}
              title={title || t("manage.discussionGroup")}
              value={t("manage.privateGroup")}
              onClick={onOpenDiscussionChat}
            />
          ) : (
            <div className="px-4 py-2">
              <Button
                type="button"
                className="h-12 w-full rounded-2xl"
                onClick={onCreateDiscussion}
                disabled={isMutatingDiscussion}
              >
                {t("manage.createDiscussion")}
              </Button>
            </div>
          )}
        </SectionCard>

        {linkedConversationId ? (
          <SectionCard>
            <ManageRow
              icon={<IoBanOutline />}
              title={t("manage.unlinkDiscussion")}
              destructive
              onClick={onUnlinkDiscussion}
            />
          </SectionCard>
        ) : null}
      </ScrollArea>
    </div>
  );
}

export function RightSidebarDiscussionCreateScreen({
  title,
  avatarUrl,
  avatarFallback,
  isUploadingAvatar,
  isSubmitting,
  onTitleChange,
  onUploadAvatar,
  onSubmit,
  t,
}: {
  title: string;
  avatarUrl: string;
  avatarFallback: string;
  isUploadingAvatar: boolean;
  isSubmitting: boolean;
  onTitleChange: (value: string) => void;
  onUploadAvatar: (file: File) => Promise<void>;
  onSubmit: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      await onUploadAvatar(file);
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-sidebar">
      <ScrollArea className="h-full">
        <section className="border-b px-4 py-6">
          <div className="flex flex-col items-center text-center">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                void handleFileChange(event);
              }}
              disabled={isUploadingAvatar || isSubmitting}
            />

            <button
              type="button"
              className="relative rounded-full"
              onClick={() => inputRef.current?.click()}
              disabled={isUploadingAvatar || isSubmitting}
            >
              <Avatar className={`size-28 ${!avatarUrl ? SIDEBAR_FALLBACK_AVATAR_CLASS : ""}`}>
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                <AvatarFallback className={!avatarUrl ? "bg-transparent text-[1.75rem] text-primary-foreground" : ""}>
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
                <IoCameraOutline className="size-11" />
              </span>
            </button>

            <div className="mt-5 w-full">
              <Input
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder={t("manage.discussionGroupTitlePlaceholder")}
                className="h-12 rounded-2xl"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </section>
      </ScrollArea>

      <div className="flex justify-end px-4 py-4">
        <Button
          type="button"
          size="icon"
          className="size-14 rounded-full [&>svg]:size-7"
          onClick={onSubmit}
          disabled={isUploadingAvatar || isSubmitting}
        >
          <IoChevronForward />
        </Button>
      </div>
    </div>
  );
}
