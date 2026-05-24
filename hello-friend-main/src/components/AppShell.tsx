import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { AstraLogo } from "./AstraLogo";
import { useI18n } from "@/lib/i18n";
import { Brain, CheckSquare, Globe, Home, MessageSquare, Settings } from "lucide-react";
import { Button } from "./ui/button";

export function AppShell() {
  const location = useLocation();
  const { lang, setLang, t } = useI18n();

  const nav = [
    { to: "/", label: lang === "ar" ? "الرئيسية" : "Home", icon: Home },
    { to: "/chat", label: t("chat"), icon: MessageSquare },
    { to: "/tasks", label: t("tasks"), icon: CheckSquare },
    { to: "/memories", label: t("memories"), icon: Brain },
    { to: "/settings", label: t("settings"), icon: Settings },
  ] as const;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-e bg-sidebar p-3 md:flex">
        <Link to="/" className="mb-6 flex items-center gap-2 px-2 pt-2 transition hover:opacity-80" title={lang === "ar" ? "الرئيسية" : "Home"}>
          <AstraLogo className="h-7 w-7" />
          <span className="font-display text-base font-semibold">{t("appName")}</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => {
            const active = n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center justify-between border-t pt-3">
          <div className="truncate px-2 text-xs text-muted-foreground">
            {lang === "ar" ? "جلسة خاصة" : "Private session"}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setLang(lang === "en" ? "ar" : "en")}>
            <Globe className="h-4 w-4" />
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
