import { createFileRoute, redirect } from "@tanstack/react-router";

// Multi-chat mode was removed — always send users to the single chat page.
export const Route = createFileRoute("/_app/chat/$threadId")({
  beforeLoad: () => {
    throw redirect({ to: "/chat" });
  },
  component: () => null,
});
