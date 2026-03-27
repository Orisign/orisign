import type { RealtimeMessageDtoKind } from "@/api/generated";

export interface ChatReplyTarget {
  id: string;
  conversationId?: string;
  authorId: string;
  authorName: string;
  text: string;
  kind?: RealtimeMessageDtoKind;
  mediaKeys?: string[];
  createdAt?: number;
}

export interface ChatEditTarget {
  id: string;
  text: string;
}

export interface ChatCommentsContext {
  channelConversationId: string;
  channelUsername?: string;
  post: ChatReplyTarget;
}
