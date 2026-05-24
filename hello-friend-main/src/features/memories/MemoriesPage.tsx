import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brain, Plus, Trash2 } from "lucide-react";

type Memory = { id: string; category: string; content: string; created_at: string };
const KEY = "astra:session-memories";

function load(): Memory[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(items: Memory[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

export function MemoriesPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Memory[]>([]);
  const [category, setCategory] = useState("note");
  const [content, setContent] = useState("");

  useEffect(() => { setItems(load()); }, []);
  useEffect(() => { save(items); }, [items]);

  const add = () => {
    if (!content.trim()) return;
    setItems((p) => [{
      id: crypto.randomUUID(), category, content: content.trim(), created_at: new Date().toISOString(),
    }, ...p]);
    setContent("");
  };
  const del = (id: string) => setItems((p) => p.filter((m) => m.id !== id));

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Brain className="h-7 w-7 text-electric" />
        <h1 className="text-3xl font-semibold tracking-tight">{t("memories")}</h1>
      </div>
      <div className="mb-4 rounded-md border border-dashed border-muted-foreground/30 p-2 text-[11px] leading-snug text-muted-foreground">
        {lang === "ar" ? "الذكريات مؤقتة — تُمسح عند إغلاق المتصفح." : "Memories are temporary — cleared when you close the browser."}
      </div>

      <div className="mb-8 rounded-2xl glass-strong p-4">
        <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={lang === "ar" ? "التصنيف" : "Category"} />
          <Input value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={lang === "ar" ? "اكتب الذاكرة…" : "Write a memory…"} />
          <Button onClick={add} disabled={!content.trim()} className="glow-electric"><Plus className="me-1 h-4 w-4" />{t("addMemory")}</Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <div className="rounded-2xl glass p-12 text-center text-muted-foreground">
            {lang === "ar" ? "لا توجد ذكريات بعد." : "No memories yet."}
          </div>
        )}
        {items.map((m) => (
          <div key={m.id} className="group flex items-start gap-3 rounded-xl glass p-4">
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs text-primary">{m.category}</span>
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
