"use client";

import type { UserResponseDto } from "@/api/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarGradient, getUserAvatarUrl, getUserDisplayName, getUserInitial } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { Checkbox } from "@repo/ui";

interface CreateConversationUserRowProps {
  conversationSeed: string;
  user: UserResponseDto;
  subtitle: string;
  checked: boolean;
  onToggle: () => void;
  showCheckbox?: boolean;
  interactive?: boolean;
}

export function CreateConversationUserRow({
  conversationSeed,
  user,
  subtitle,
  checked,
  onToggle,
  showCheckbox = true,
  interactive = true,
}: CreateConversationUserRowProps) {
  const avatarUrl = getUserAvatarUrl(user);
  const displayName = getUserDisplayName(user, user.id);
  const initials = getUserInitial(user, displayName);
  const content = (
    <>
      {showCheckbox ? (
        <Checkbox
          checked={checked}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className={cn(
            "size-5 rounded-md border-white/30 bg-transparent text-white",
            checked ? "border-primary" : "border-border/90 text-transparent",
          )}
        />
      ) : null}

      <Avatar
        size="lg"
        className={!avatarUrl ? cn("text-white", `bg-linear-to-br ${getAvatarGradient(`${conversationSeed}:${user.id}`)}`) : ""}
      >
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className={!avatarUrl ? "bg-transparent text-white" : ""}>
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{displayName}</p>
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </>
  );

  if (!interactive) {
    return <div className="flex w-full items-center gap-3 rounded-xl px-3 py-2">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer hover:bg-accent/70",
      )}
    >
      {content}
    </button>
  );
}
