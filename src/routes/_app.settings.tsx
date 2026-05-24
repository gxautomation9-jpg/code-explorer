import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/features/settings/SettingsPage";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Astra Intelligence" }] }),
  component: SettingsPage,
});
