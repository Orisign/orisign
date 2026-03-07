import { ChatPage } from "@/components/chat/chat-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "",
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return <ChatPage conversationId={conversationId} />;
}
