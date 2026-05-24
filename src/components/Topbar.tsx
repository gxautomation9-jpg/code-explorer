import { Link } from "@tanstack/react-router";
import { AstraLogo } from "./AstraLogo";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Brain, CheckSquare, Globe, MessageSquare, Settings } from "lucide-react";

export function Topbar() {
  const { lang, setLang, t } = useI18n();
  const appLinks = [
    { to: "/chat", label: t("chat"), icon: MessageSquare },
    { to: "/tasks", label: t("tasks"), icon: CheckSquare },
    { to: "/memories", label: t("memories"), icon: Brain },
    { to: "/settings", label: t("settings"), icon: Settings },
  ] as const;

  return (
    <header className="sticky top-0 z-40 glass-strong border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <AstraLogo />
          <span className="font-display text-lg font-semibold tracking-tight">{t("appName")}</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {appLinks.map((item) => (
            <Link key={item.to} to={item.to} className="hover:text-foreground transition">
              {item.label}
            </Link>
          ))}
          <Link to="/" hash="features" className="hover:text-foreground transition">{t("features")}</Link>
          <Link to="/" hash="faq" className="hover:text-foreground transition">{t("faq")}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setLang(lang === "en" ? "ar" : "en")} aria-label="Language">
            <Globe className="h-4 w-4" />
          </Button>
          <Button asChild size="sm" className="glow-electric"><Link to="/chat">{t("getStarted")}</Link></Button>
        </div>
      </div>
      <nav className="mx-auto grid max-w-7xl grid-cols-4 border-t px-2 py-2 text-xs text-muted-foreground md:hidden">
        {appLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition hover:bg-accent hover:text-accent-foreground">
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
