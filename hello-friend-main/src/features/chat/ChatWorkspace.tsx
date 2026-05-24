import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square, Sparkles, Copy, Home, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { VoiceInput } from "@/features/chat/VoiceInput";
import { VoiceOutput } from "@/features/chat/VoiceOutput";

// Single persistent conversation — no multi-chat sidebar.
const MESSAGES_KEY = "astra:chat-messages-v1";
const FORCED_LANG_KEY = "astra:forced-lang";

function isRtl(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    return raw ? (JSON.parse(raw) as UIMessage[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: UIMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  } catch {
    /* ignore */
  }
}

function newId() {
  return (crypto && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
}

function detectForcedLang(text: string): "ar" | "en" | "clear" | null {
  const t = text.toLowerCase();
  if (/(only|just|always)\s+(speak|reply|respond|talk|write)\s+(in\s+)?english/.test(t) ||
      /respond\s+only\s+in\s+english/.test(t) ||
      /english\s+only\b/.test(t)) return "en";
  if (/(only|just|always)\s+(speak|reply|respond|talk|write)\s+(in\s+)?arabic/.test(t) ||
      /respond\s+only\s+in\s+arabic/.test(t) ||
      /arabic\s+only\b/.test(t)) return "ar";
  if (/تكلم\s+(عربي|بالعربي|بالعربية)\s+(فقط|بس)/.test(text) ||
      /(رد|جاوب)\s+(بالعربي|بالعربية)\s+(فقط|بس)?/.test(text)) return "ar";
  if (/تكلم\s+(انجليزي|إنجليزي|بالإنجليزية|بالانجليزية)\s+(فقط|بس)?/.test(text) ||
      /(رد|جاوب)\s+(بالانجليزي|بالإنجليزي|بالإنجليزية)\s+(فقط|بس)?/.test(text)) return "en";
  if (/no\s+language\s+lock|stop\s+forcing\s+language|auto[- ]detect\s+language/.test(t) ||
      /اوقف\s+القفل|تلقائي/.test(text)) return "clear";
  return null;
}

export function ChatWorkspace() {
  const { user } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();

  const [forcedLang, setForcedLang] = useState<"ar" | "en" | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);

  useEffect(() => {
    setInitialMessages(loadMessages());
    const v = localStorage.getItem(FORCED_LANG_KEY);
    if (v === "ar" || v === "en") setForcedLang(v);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (forcedLang) localStorage.setItem(FORCED_LANG_KEY, forcedLang);
    else localStorage.removeItem(FORCED_LANG_KEY);
  }, [forcedLang, hydrated]);

  const forcedLangRef = useRef(forcedLang);
  const langRef = useRef(lang);
  useEffect(() => { forcedLangRef.current = forcedLang; }, [forcedLang]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages,
            forcedLang: forcedLangRef.current,
            preferredLang: langRef.current,
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: "astra-single-chat",
    transport,
    onError: (e) => toast.error(e.message),
  });

  // Hydrate the chat with persisted messages once on mount.
  useEffect(() => {
    if (hydrated && initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Persist after each change (streaming included — auto-saves the final state too).
  useEffect(() => {
    if (!hydrated) return;
    if (status === "streaming" || status === "submitted") return;
    saveMessages(messages);
  }, [messages, status, hydrated]);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const isLoading = status === "submitted" || status === "streaming";

  const onSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || !user || isLoading) return;

    const cmd = detectForcedLang(text);
    if (cmd === "clear") setForcedLang(null);
    else if (cmd === "ar" || cmd === "en") {
      setForcedLang(cmd);
      setLang(cmd);
    }

    setInput("");
    await sendMessage({ text });
  }, [input, user, isLoading, sendMessage, setLang]);

  const onClear = () => {
    if (typeof window !== "undefined" && !confirm(lang === "ar" ? "هل أنت متأكد من مسح المحادثة؟" : "Clear the conversation?")) return;
    setMessages([]);
    saveMessages([]);
  };

  // Use newId once so transport keeps a stable session id during the lifetime of this component.
  void newId;

  return (
    <div className="flex h-screen">
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 border-b bg-background/60 px-4 py-2 backdrop-blur">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/" })}
            className="border-electric/40 text-foreground hover:border-electric hover:bg-electric/10"
          >
            <Home className="me-2 h-4 w-4 text-electric" />
            {lang === "ar" ? "الرئيسية" : "Home"}
          </Button>
          <div className="text-sm font-medium text-muted-foreground">
            {lang === "ar" ? "محادثتك مع أسترا" : "Your chat with Astra"}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={messages.length === 0 || isLoading}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="me-2 h-4 w-4" />
            {lang === "ar" ? "مسح" : "Clear"}
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-8">
            {messages.length === 0 ? (
              <div className="flex h-[60vh] flex-col items-center justify-center text-center">
                <Sparkles className="mb-4 h-10 w-10 text-electric animate-pulse-glow" />
                <h2 className="text-2xl font-semibold">{t("emptyChat")}</h2>
                <p className="mt-2 text-muted-foreground">{t("emptyChatHint")}</p>
                <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {[
                    lang === "ar" ? "اشرحلي الذكاء الاصطناعي ببساطة" : "Explain quantum computing simply",
                    lang === "ar" ? "اكتب إيميل احترافي لعميل" : "Write a professional client email",
                    lang === "ar" ? "ترجم: hello, how are you?" : "Translate: مرحبا كيف حالك؟",
                    lang === "ar" ? "لخص اجتماع اليوم" : "Summarize today's meeting",
                  ].map((s) => (
                    <button key={s} onClick={() => setInput(s)} className="rounded-xl glass p-3 text-start text-sm transition hover:border-electric/40">{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m, idx) => {
                  const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
                  const rtl = isRtl(text);
                  let preferLang: "ar" | "en" | undefined;
                  if (m.role === "assistant") {
                    for (let i = idx - 1; i >= 0; i -= 1) {
                      if (messages[i].role === "user") {
                        const utext = messages[i].parts.map((p) => (p.type === "text" ? p.text : "")).join("");
                        preferLang = isRtl(utext) ? "ar" : "en";
                        break;
                      }
                    }
                  }
                  return (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`group relative max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "glass"
                      }`} dir={rtl ? "rtl" : "ltr"}>
                        <div className="prose prose-invert max-w-none prose-p:my-2 prose-pre:bg-black/40 prose-code:text-electric">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                        </div>
                        {m.role === "assistant" && text && <VoiceOutput text={text} appLang={lang} preferLang={preferLang} />}
                        {m.role === "assistant" && text && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(text); toast.success(lang === "ar" ? "تم النسخ" : "Copied"); }}
                            className="absolute -bottom-3 end-2 rounded-md bg-background/80 p-1 opacity-0 transition group-hover:opacity-100"
                            aria-label="Copy"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {status === "submitted" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-electric" />
                    {lang === "ar" ? "أسترا تفكر…" : "Astra is thinking…"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t bg-background/60 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl p-4">
            <div className="rounded-2xl glass-strong p-2">
              <VoiceInput appLang={lang} disabled={isLoading} onUseTranscript={setInput} onSendTranscript={(text) => onSend(text)} />
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
                    if (e.key === "Escape" && isLoading) stop();
                  }}
                  dir={isRtl(input) ? "rtl" : "ltr"}
                  placeholder={t("askAnything")}
                  rows={1}
                  className="min-h-[44px] resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
                />
                {isLoading ? (
                  <Button onClick={stop} size="icon" variant="secondary" aria-label="Stop"><Square className="h-4 w-4" /></Button>
                ) : (
                  <Button onClick={() => onSend()} disabled={!input.trim()} size="icon" className="glow-electric" aria-label="Send"><Send className="h-4 w-4" /></Button>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <div className="inline-flex rounded-full border border-electric/30 bg-secondary/40 p-0.5">
                <button
                  type="button"
                  onClick={() => { setLang("ar"); setForcedLang("ar"); }}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    forcedLang === "ar"
                      ? "bg-primary text-primary-foreground shadow-[0_0_18px_2px_rgba(64,180,255,0.55)]"
                      : lang === "ar" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={forcedLang === "ar"}
                >العربية</button>
                <button
                  type="button"
                  onClick={() => { setLang("en"); setForcedLang("en"); }}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    forcedLang === "en"
                      ? "bg-primary text-primary-foreground shadow-[0_0_18px_2px_rgba(64,180,255,0.55)]"
                      : lang === "en" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={forcedLang === "en"}
                >English</button>
                <button
                  type="button"
                  onClick={() => setForcedLang(null)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    forcedLang === null ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >{lang === "ar" ? "تلقائي" : "Auto"}</button>
              </div>
              <span className="opacity-70">
                {lang === "ar"
                  ? forcedLang
                    ? `مقفول على ${forcedLang === "ar" ? "العربية" : "الإنجليزية"} · اضغط Enter للإرسال`
                    : "وضع تلقائي — أسترا تتبع لغتك · Enter للإرسال"
                  : forcedLang
                    ? `Locked to ${forcedLang === "ar" ? "Arabic" : "English"} · Enter to send`
                    : "Auto mode — Astra follows your language · Enter to send"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
