import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Plus, Trash2 } from "lucide-react";

type Priority = "low" | "medium" | "high" | "urgent";
type Status = "todo" | "done";
type Task = { id: string; title: string; description: string | null; status: Status; priority: Priority; created_at: string };

const KEY = "astra:session-tasks";
function load(): Task[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(items: Task[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

export function TasksPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  useEffect(() => { setItems(load()); }, []);
  useEffect(() => { save(items); }, [items]);

  const add = () => {
    if (!title.trim()) return;
    setItems((p) => [{
      id: crypto.randomUUID(),
      title: title.trim(),
      description: desc.trim() || null,
      status: "todo",
      priority,
      created_at: new Date().toISOString(),
    }, ...p]);
    setTitle(""); setDesc(""); setPriority("medium");
  };
  const toggle = (id: string) => setItems((p) => p.map((x) => x.id === id ? { ...x, status: x.status === "done" ? "todo" : "done" } : x));
  const del = (id: string) => setItems((p) => p.filter((x) => x.id !== id));

  const priorityColor = (p: Priority) =>
    p === "urgent" ? "bg-destructive/20 text-destructive" : p === "high" ? "bg-electric/20 text-electric" : p === "medium" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground";

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{t("tasks")}</h1>
      <div className="mb-4 rounded-md border border-dashed border-muted-foreground/30 p-2 text-[11px] leading-snug text-muted-foreground">
        {lang === "ar" ? "المهام مؤقتة — تُمسح عند إغلاق المتصفح." : "Tasks are temporary — cleared when you close the browser."}
      </div>

      <div className="mb-8 rounded-2xl glass-strong p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Input placeholder={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["low","medium","high","urgent"] as const).map(p => <SelectItem key={p} value={p}>{t(p)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={add} disabled={!title.trim()} className="glow-electric"><Plus className="me-1 h-4 w-4" />{t("addTask")}</Button>
        </div>
        <Textarea placeholder={t("description")} value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-3" rows={2} />
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <div className="rounded-2xl glass p-12 text-center text-muted-foreground">
            {lang === "ar" ? "لا توجد مهام بعد. أضف أول مهمة بالأعلى." : "No tasks yet. Add your first one above."}
          </div>
        )}
        {items.map((task) => (
          <div key={task.id} className="group flex items-start gap-3 rounded-xl glass p-4 transition hover:border-electric/30">
            <button onClick={() => toggle(task.id)} className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${task.status === "done" ? "bg-electric border-electric" : "border-border"}`}>
              {task.status === "done" && <Check className="h-3.5 w-3.5 text-background" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-medium ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}>{task.title}</div>
              {task.description && <div className="mt-1 text-sm text-muted-foreground">{task.description}</div>}
              <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-xs ${priorityColor(task.priority)}`}>{t(task.priority)}</span>
            </div>
            <button onClick={() => del(task.id)} className="opacity-0 transition group-hover:opacity-100" aria-label="Delete">
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
