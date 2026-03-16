import { ChatPage } from "@/components/chat/chat-page";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return <ChatPage conversationId={conversationId} />;
}
