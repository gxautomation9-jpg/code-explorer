import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, X } from "lucide-react";

const FIRST_MSG_KEY = "astra:chat-first-msg-at";
const DISMISS_KEY = "astra:retention-banner-dismissed-cycle";
const RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
const WARN_BEFORE_MS = 24 * 60 * 60 * 1000; // warn during the last 24h

export function markFirstMessageIfMissing() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(FIRST_MSG_KEY)) {
    localStorage.setItem(FIRST_MSG_KEY, String(Date.now()));
  }
}

export function resetRetentionClock() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FIRST_MSG_KEY);
  localStorage.removeItem(DISMISS_KEY);
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type Cfg = { autoPurgeEnabled: boolean; retentionDays: number | null };

export function ChatRetentionBanner({
  lang, getMessages, onPurge,
}: {
  lang: "ar" | "en";
  getMessages: () => unknown;
  onPurge: () => void;
}) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    let dead = false;
    const load = () => {
      fetch("/api/public/astra-config").then((r) => r.json()).then((j: Cfg) => {
        if (!dead) setCfg(j);
      }).catch(() => { /* ignore */ });
    };
    load();
    const id = window.setInterval(load, 5 * 60 * 1000); // refresh config every 5 min
    const tick = window.setInterval(() => setTick((n) => n + 1), 60 * 1000);
    return () => { dead = true; clearInterval(id); clearInterval(tick); };
  }, []);

  const handleDownload = useCallback(() => {
    downloadJson(`astra-chat-${new Date().toISOString().slice(0, 10)}.json`, getMessages());
  }, [getMessages]);

  // Auto-purge logic.
  useEffect(() => {
    if (!cfg?.autoPurgeEnabled) return;
    const first = Number(localStorage.getItem(FIRST_MSG_KEY) || "0");
    if (!first) return;
    if (Date.now() - first >= RETENTION_MS) {
      onPurge();
      localStorage.removeItem(FIRST_MSG_KEY);
      localStorage.removeItem(DISMISS_KEY);
    }
  }, [cfg, onPurge]);

  if (!cfg?.autoPurgeEnabled) return null;
  const first = Number(typeof window !== "undefined" ? localStorage.getItem(FIRST_MSG_KEY) || "0" : "0");
  if (!first) return null;
  const elapsed = Date.now() - first;
  const remaining = RETENTION_MS - elapsed;
  if (remaining <= 0) return null;

  const cycleKey = String(first);
  const dismissed = typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === cycleKey;
  const inWarnWindow = remaining <= WARN_BEFORE_MS;
  if (dismissed && !inWarnWindow) return null;

  const hoursLeft = Math.ceil(remaining / (60 * 60 * 1000));
  const daysLeft = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  const msg = lang === "ar"
    ? `سيتم حذف محادثتك تلقائياً خلال ${hoursLeft <= 36 ? `${hoursLeft} ساعة` : `${daysLeft} أيام`}. يمكنك تحميل نسخة قبل الحذف.`
    : `Your chat history will be auto-deleted in ${hoursLeft <= 36 ? `${hoursLeft}h` : `${daysLeft} days`}. You can download a copy first.`;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
        <span className="flex-1 text-amber-100/90">{msg}</span>
        <Button size="sm" variant="outline" onClick={handleDownload} className="h-7 border-amber-400/40 text-amber-100 hover:bg-amber-500/20">
          <Download className="me-1 h-3.5 w-3.5" />{lang === "ar" ? "تحميل" : "Download"}
        </Button>
        <button
          aria-label="Dismiss"
          onClick={() => { localStorage.setItem(DISMISS_KEY, cycleKey); setTick((n) => n + 1); }}
          className="text-amber-200/70 hover:text-amber-100"
        ><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
