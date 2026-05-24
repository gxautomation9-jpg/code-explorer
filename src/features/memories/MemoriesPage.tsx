import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brain, Plus, Trash2, Sparkles, User } from "lucide-react";
import { addManualMemory, clearAuto, deleteMemory, listMemories, type Memory } from "@/lib/astra-memory";

export function MemoriesPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Memory[]>([]);
  const [category, setCategory] = useState("note");
  const [content, setContent] = useState("");

  useEffect(() => { setItems(listMemories()); }, []);

  const refresh = () => setItems(listMemories());

  const add = () => {
    if (!content.trim()) return;
    addManualMemory(category, content);
    setContent("");
    refresh();
  };
  const del = (id: string) => { deleteMemory(id); refresh(); };
  const clearAutoFacts = () => { clearAuto(); refresh(); };

  const autoCount = items.filter((m) => m.kind === "auto").length;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Brain className="h-7 w-7 text-electric" />
        <h1 className="text-3xl font-semibold tracking-tight">{t("memories")}</h1>
      </div>
      <div className="mb-4 rounded-md border border-electric/20 bg-electric/5 p-3 text-xs leading-snug text-muted-foreground">
        {lang === "ar"
          ? "ذكرياتك محفوظة محليًا في متصفحك وتبقى بين الجلسات. أسترا تستخدمها لتفهمك بشكل أفضل."
          : "Your memories are stored locally in your browser and persist across sessions. Astra uses them to understand you better."}
      </div>

      <div className="mb-8 rounded-2xl glass-strong p-4">
        <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={lang === "ar" ? "التصنيف" : "Category"} />
          <Input value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={lang === "ar" ? "اكتب الذاكرة…" : "Write a memory…"} />
          <Button onClick={add} disabled={!content.trim()} className="glow-electric"><Plus className="me-1 h-4 w-4" />{t("addMemory")}</Button>
        </div>
      </div>

      {autoCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-dashed border-muted-foreground/20 px-4 py-2 text-xs text-muted-foreground">
          <span>{lang === "ar" ? `${autoCount} ذكرى تعلمتها أسترا تلقائيًا` : `${autoCount} facts Astra learned automatically`}</span>
          <button onClick={clearAutoFacts} className="text-destructive hover:underline">
            {lang === "ar" ? "مسح الذكريات التلقائية" : "Clear auto memories"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {items.length === 0 && (
          <div className="rounded-2xl glass p-12 text-center text-muted-foreground">
            {lang === "ar" ? "لا توجد ذكريات بعد." : "No memories yet."}
          </div>
        )}
        {items.map((m) => (
          <div key={m.id} className="group flex items-start gap-3 rounded-xl glass p-4">
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${
              m.kind === "auto" ? "bg-electric/15 text-electric" : "bg-primary/15 text-primary"
            }`}>
              {m.kind === "auto" ? <Sparkles className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {m.category}
            </span>
            <div className="flex-1 text-sm">{m.content}</div>
            <button onClick={() => del(m.id)} className="opacity-0 transition group-hover:opacity-100" aria-label="Delete">
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
