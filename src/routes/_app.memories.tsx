import { createFileRoute } from "@tanstack/react-router";
import { MemoriesPage } from "@/features/memories/MemoriesPage";

export const Route = createFileRoute("/_app/memories")({
  head: () => ({ meta: [{ title: "Memories — Astra Intelligence" }] }),
  component: MemoriesPage,
});
