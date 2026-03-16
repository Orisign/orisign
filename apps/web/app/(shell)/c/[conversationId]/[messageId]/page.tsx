import { ChatMessageLinkRedirect } from "@/components/chat/chat-message-link-redirect";

export default async function ConversationMessagePage({
  params,
}: {
  params: Promise<{ conversationId: string; messageId: string }>;
}) {
  const { conversationId, messageId } = await params;

  return (
    <ChatMessageLinkRedirect
      conversationId={conversationId}
      messageId={messageId}
    />
  );
}
