"use client";

import type { ConversationResponseDto } from "@/api/generated";
import type { ChatMessageDto } from "@/hooks/use-chat";
import { ChatMessageItem } from "./chat-message-item";

interface ChatCommentsPinnedPostProps {
  message: ChatMessageDto;
  senderConversation?: ConversationResponseDto | null;
  locale: string;
  deletedLabel: string;
  editedLabel: string;
  unknownAuthorLabel: string;
  replyUnavailableLabel: string;
}

export function ChatCommentsPinnedPost({
  message,
  senderConversation = null,
  locale,
  deletedLabel,
  editedLabel,
  unknownAuthorLabel,
  replyUnavailableLabel,
}: ChatCommentsPinnedPostProps) {
  return (
    <div className="sticky top-0 z-10 mb-2 py-1">
      <ChatMessageItem
        conversationId={message.conversationId}
        message={message}
        author={null}
        senderConversation={senderConversation}
        isOwn={false}
        isReadByOthers={false}
        readReceipts={[]}
        startsGroupOverride
        endsGroupOverride
        forceShowAvatar
        forceShowAuthorName
        channelViewCount={0}
        locale={locale}
        deletedLabel={deletedLabel}
        editedLabel={editedLabel}
        unknownAuthorLabel={unknownAuthorLabel}
        replyUnavailableLabel={replyUnavailableLabel}
      />
    </div>
  );
}
