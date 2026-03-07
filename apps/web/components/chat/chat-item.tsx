import { ConversationResponseDto } from "@/api/generated";
import {
  formatConversationTime,
  getAvatarGradient,
  getConversationInitial,
  getConversationSubtitle,
  getConversationTitle,
} from "@/lib/chat";
import { cn, Ripple } from "@repo/ui";
import Link from "next/link";

interface ChatItemProps {
  conversation: ConversationResponseDto;
}

export function ChatItem({ conversation }: ChatItemProps) {
  const title = getConversationTitle(conversation);
  const initial = getConversationInitial(conversation);
  const subtitle = getConversationSubtitle(conversation);
  const membersCount = conversation.members?.length ?? 0;
  const timeLabel = formatConversationTime(conversation);

  return (
    <Ripple className="w-full cursor-pointer rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-accent/70">
      <Link href={`/${conversation.id}`}>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-base font-semibold text-white",
              getAvatarGradient(conversation.id),
            )}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[15px] font-semibold leading-5">
                {title}
              </p>
              {timeLabel ? (
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {timeLabel}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {subtitle}
              </p>
              {membersCount > 1 ? (
                <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  {membersCount}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </Link>
    </Ripple>
  );
}
