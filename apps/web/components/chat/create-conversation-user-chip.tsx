"use client";

import type { UserResponseDto } from "@/api/generated";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarGradient, getUserAvatarUrl, getUserDisplayName, getUserInitial } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { Button } from "@repo/ui";
import { FiX } from "react-icons/fi";

interface CreateConversationUserChipProps {
  conversationSeed: string;
  user: UserResponseDto;
  onRemove: () => void;
}

export function CreateConversationUserChip({
  conversationSeed,
  user,
  onRemove,
}: CreateConversationUserChipProps) {
  const avatarUrl = getUserAvatarUrl(user);
  const displayName = getUserDisplayName(user, user.id);
  const initials = getUserInitial(user, displayName);

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-accent px-2 py-1.5">
      <Avatar
        size="sm"
        className={!avatarUrl ? cn("text-white", `bg-linear-to-br ${getAvatarGradient(`${conversationSeed}:${user.id}`)}`) : ""}
      >
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className={!avatarUrl ? "bg-transparent text-white" : ""}>
          {initials}
        </AvatarFallback>
      </Avatar>

      <span className="max-w-28 truncate text-sm font-semibold">{displayName}</span>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-5 rounded-full text-muted-foreground"
        onClick={onRemove}
      >
        <FiX className="size-3.5" />
      </Button>
    </div>
  );
}
