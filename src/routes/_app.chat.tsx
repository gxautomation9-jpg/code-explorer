import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "@/features/chat/ChatWorkspace";

export const Route = createFileRoute("/_app/chat")({
  head: () => ({ meta: [{ title: "Chat — Astra Intelligence" }] }),
  component: () => <ChatWorkspace />,
});
