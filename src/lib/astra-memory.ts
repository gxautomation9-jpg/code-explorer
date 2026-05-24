// Astra persistent memory store.
// Uses localStorage so memories survive browser restarts (not just tabs).
// Two kinds of entries:
//   - "manual"  → added by the user from the Memories page
//   - "auto"    → extracted silently from chat (name, preferences, locked language, etc.)
//
// All operations are client-side and resilient (no throws on quota/SSR).

export type MemoryKind = "manual" | "auto";

export type Memory = {
  id: string;
  kind: MemoryKind;
  category: string;
  content: string;
  created_at: string;
};

const KEY = "astra:memories-v2";
const LEGACY_KEYS = ["astra:session-memories"]; // migrate once
const MAX_AUTO = 40;
const MAX_TOTAL = 200;

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `m_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function listMemories(): Memory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Memory[];
    // migrate from legacy sessionStorage manual memories
    for (const lk of LEGACY_KEYS) {
      try {
        const legacy = sessionStorage.getItem(lk);
        if (legacy) {
          const items = (JSON.parse(legacy) as Array<{ id: string; category: string; content: string; created_at: string }>)
            .map((m) => ({ ...m, kind: "manual" as const }));
          localStorage.setItem(KEY, JSON.stringify(items));
          sessionStorage.removeItem(lk);
          return items;
        }
      } catch { /* ignore */ }
    }
    return [];
  } catch {
    return [];
  }
}

function persist(items: Memory[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_TOTAL))); } catch { /* quota */ }
}

export function addManualMemory(category: string, content: string): Memory {
  const items = listMemories();
  const m: Memory = { id: uid(), kind: "manual", category: category.trim() || "note", content: content.trim(), created_at: new Date().toISOString() };
  const next = [m, ...items];
  persist(next);
  return m;
}

export function deleteMemory(id: string) {
  persist(listMemories().filter((m) => m.id !== id));
}

export function clearAuto() {
  persist(listMemories().filter((m) => m.kind !== "auto"));
}

export function clearAll() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}

/**
 * Add an auto-extracted fact. De-dupes by (category + lowercased content),
 * and trims the auto-memory pool so it never grows unbounded.
 */
export function addAutoMemory(category: string, content: string) {
  const c = content.trim();
  if (!c) return;
  const items = listMemories();
  const key = `${category}::${c.toLowerCase()}`;
  if (items.some((m) => `${m.category}::${m.content.toLowerCase()}` === key)) return;
  const m: Memory = { id: uid(), kind: "auto", category, content: c, created_at: new Date().toISOString() };
  // Keep newest first, cap auto pool, then append manual remainder
  const manual = items.filter((x) => x.kind === "manual");
  const auto = [m, ...items.filter((x) => x.kind === "auto")].slice(0, MAX_AUTO);
  persist([...auto, ...manual]);
}

/**
 * Best-effort extraction of durable facts from a user message.
 * Lightweight, deterministic, language-aware (English + Arabic).
 */
export function extractAutoFacts(userText: string) {
  const text = userText.trim();
  if (!text) return;

  // Name: "my name is X" / "اسمي X" / "أنا اسمي X" / "call me X"
  const nameRe = [
    /\bmy name is\s+([\p{L}][\p{L} '\-]{1,40})/iu,
    /\bi[']?m\s+([A-Z][\p{L}'\-]{1,30})\b/u,
    /\bcall me\s+([\p{L}][\p{L} '\-]{1,40})/iu,
    /اسمي\s+([\p{L}][\p{L} \-]{1,40})/u,
    /أنا\s+اسمي\s+([\p{L}][\p{L} \-]{1,40})/u,
    /انا\s+اسمي\s+([\p{L}][\p{L} \-]{1,40})/u,
  ];
  for (const re of nameRe) {
    const m = text.match(re);
    if (m && m[1]) { addAutoMemory("name", m[1].trim()); break; }
  }

  // Likes: "I like/love/prefer X" / "أحب X" / "بحب X"
  const likeRe = [
    /\bi (?:like|love|prefer|enjoy)\s+([^.,!?\n]{2,80})/i,
    /أحب\s+([^.,!?\n]{2,80})/u,
    /بحب\s+([^.,!?\n]{2,80})/u,
    /أفضل\s+([^.,!?\n]{2,80})/u,
  ];
  for (const re of likeRe) {
    const m = text.match(re);
    if (m && m[1]) { addAutoMemory("preference", m[1].trim()); break; }
  }

  // Dislikes
  const dislikeRe = [
    /\bi (?:don[']?t like|hate|dislike|can[']?t stand)\s+([^.,!?\n]{2,80})/i,
    /لا\s+أحب\s+([^.,!?\n]{2,80})/u,
    /ما\s+بحب\s+([^.,!?\n]{2,80})/u,
  ];
  for (const re of dislikeRe) {
    const m = text.match(re);
    if (m && m[1]) { addAutoMemory("dislike", m[1].trim()); break; }
  }

  // Location: "I live in X" / "I'm from X" / "أنا من X" / "أعيش في X"
  const locRe = [
    /\bi (?:live in|am from|am based in)\s+([\p{L}][\p{L} ,\-]{1,60})/iu,
    /أنا\s+من\s+([\p{L}][\p{L} \-]{1,60})/u,
    /انا\s+من\s+([\p{L}][\p{L} \-]{1,60})/u,
    /أعيش\s+في\s+([\p{L}][\p{L} \-]{1,60})/u,
    /اعيش\s+في\s+([\p{L}][\p{L} \-]{1,60})/u,
  ];
  for (const re of locRe) {
    const m = text.match(re);
    if (m && m[1]) { addAutoMemory("location", m[1].trim()); break; }
  }

  // Job/role: "I work as X" / "I'm a X" / "أعمل X" / "شغلتي X"
  const jobRe = [
    /\bi work as (?:an? )?([^.,!?\n]{2,60})/i,
    /\bi[']?m an? ([a-z][a-z \-]{2,40})(?: at | for |\b)/i,
    /أعمل\s+(?:كـ?\s*)?([\p{L}][\p{L} \-]{2,60})/u,
    /شغلتي\s+([\p{L}][\p{L} \-]{2,60})/u,
  ];
  for (const re of jobRe) {
    const m = text.match(re);
    if (m && m[1]) { addAutoMemory("role", m[1].trim()); break; }
  }
}

/**
 * Build a compact memory block to inject into the system prompt.
 * Returns null when there is nothing useful to share.
 */
export function buildMemoryContext(maxChars = 1500): string | null {
  const items = listMemories();
  if (items.length === 0) return null;
  // Prioritize manual first (user-curated), then most recent auto.
  const manual = items.filter((m) => m.kind === "manual");
  const auto = items.filter((m) => m.kind === "auto");
  const ordered = [...manual, ...auto];
  const lines: string[] = [];
  for (const m of ordered) {
    const line = `- [${m.category}] ${m.content}`;
    if (lines.join("\n").length + line.length + 1 > maxChars) break;
    lines.push(line);
  }
  if (lines.length === 0) return null;
  return lines.join("\n");
}
