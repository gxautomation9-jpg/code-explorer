import { createFileRoute } from "@tanstack/react-router";
import { TasksPage } from "@/features/tasks/TasksPage";

export const Route = createFileRoute("/_app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Astra Intelligence" }] }),
  component: TasksPage,
});
