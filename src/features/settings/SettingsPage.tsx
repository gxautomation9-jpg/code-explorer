import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";

const KEYS = ["astra:session-chats", "astra:session-tasks", "astra:session-memories", "astra:voice-prefs"];

export function SettingsPage() {
  const { t, lang, setLang } = useI18n();

  const exportData = () => {
    const out: Record<string, unknown> = {};
    for (const k of KEYS) {
      try { out[k] = JSON.parse(sessionStorage.getItem(k) || "null"); } catch { out[k] = null; }
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `astra-export-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success(lang === "ar" ? "تم التصدير" : "Exported");
  };

  const deleteAll = () => {
    if (!confirm(lang === "ar" ? "حذف كل بيانات الجلسة؟" : "Delete all session data?")) return;
    for (const k of KEYS) sessionStorage.removeItem(k);
    toast.success(lang === "ar" ? "تم الحذف" : "All session data deleted");
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{t("settings")}</h1>

      <div className="space-y-6">
        <div className="rounded-2xl glass-strong p-5">
          <h2 className="mb-4 text-lg font-semibold">{lang === "ar" ? "عام" : "General"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("language")}</Label>
              <Select value={lang} onValueChange={(v) => setLang(v as "en" | "ar")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-2xl glass-strong p-5">
          <h2 className="mb-2 text-lg font-semibold">{lang === "ar" ? "الخصوصية" : "Privacy"}</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {lang === "ar"
              ? "جميع بياناتك تُخزَّن محليًا في هذا المتصفح فقط، وتُحذف تلقائيًا عند إغلاق التبويب."
              : "All your data is stored locally in this browser only and is auto-deleted when you close the tab."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportData} variant="outline"><Download className="me-2 h-4 w-4" />{t("exportData")}</Button>
            <Button onClick={deleteAll} variant="destructive"><Trash2 className="me-2 h-4 w-4" />{t("deleteAllData")}</Button>
          </div>
        </div>

        <div className="rounded-2xl glass-strong p-5 text-sm text-muted-foreground">
          <div className="mb-1 font-semibold text-foreground">{lang === "ar" ? "الدعم الفني" : "Technical Support"}</div>
          <div>GX TEAM — <a href="tel:01095777037" className="text-electric hover:underline">01095777037</a></div>
        </div>
      </div>
    </div>
  );
}
