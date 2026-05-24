import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RefreshCcw, RotateCcw, Settings2, Square, Volume2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useVoicePrefs, pickBestVoice, loadVoicePrefs } from "@/features/chat/VoiceSettings";
import { VoiceTestDialog } from "@/features/chat/VoiceTestDialog";

type PlaybackState = "idle" | "playing" | "paused";
const VOICE_OUTPUT_START = "astra-voice-output-start";
const MAX_CHUNK_LENGTH = 180;

function isArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function normalizeSpeechText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/[>*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitForSpeech(text: string) {
  const sentences = text.match(/[^.!?؟؛。\n]+[.!?؟؛。]?/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  const flush = () => { if (current.trim()) chunks.push(current.trim()); current = ""; };
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > MAX_CHUNK_LENGTH) {
      flush();
      let partial = "";
      for (const w of s.split(/\s+/)) {
        if ((partial + " " + w).trim().length > MAX_CHUNK_LENGTH) {
          if (partial.trim()) chunks.push(partial.trim());
          partial = w;
        } else partial = (partial + " " + w).trim();
      }
      if (partial.trim()) chunks.push(partial.trim());
      continue;
    }
    if ((current + " " + s).trim().length > MAX_CHUNK_LENGTH) flush();
    current = (current + " " + s).trim();
  }
  flush();
  return chunks;
}

type LangChunk = { text: string; lang: "ar" | "en" };

// Split a chunk into runs of the same language so mixed-language assistant
// replies switch to the correct voice for each run.
function splitByLanguage(chunk: string): LangChunk[] {
  const runs: LangChunk[] = [];
  // Tokenise on whitespace but keep an Arabic/Latin classification per token.
  const tokens = chunk.split(/(\s+)/);
  let buf = "";
  let bufLang: "ar" | "en" | null = null;
  for (const tok of tokens) {
    if (!tok) continue;
    if (/^\s+$/.test(tok)) { buf += tok; continue; }
    const hasAr = /[\u0600-\u06FF]/.test(tok);
    const hasLatin = /[A-Za-z]/.test(tok);
    const lang: "ar" | "en" | null = hasAr ? "ar" : hasLatin ? "en" : null;
    if (lang == null) { buf += tok; continue; }
    if (bufLang == null) { bufLang = lang; buf += tok; continue; }
    if (lang === bufLang) { buf += tok; continue; }
    const out = buf.trim();
    if (out) runs.push({ text: out, lang: bufLang });
    buf = tok;
    bufLang = lang;
  }
  const out = buf.trim();
  if (out && bufLang) runs.push({ text: out, lang: bufLang });
  if (!runs.length) runs.push({ text: chunk, lang: isArabic(chunk) ? "ar" : "en" });
  // Merge tiny runs (<3 chars) into the previous one to avoid micro-switches.
  const merged: LangChunk[] = [];
  for (const r of runs) {
    const prev = merged[merged.length - 1];
    if (prev && r.text.length < 3) prev.text += " " + r.text;
    else merged.push({ ...r });
  }
  return merged;
}

function getVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

type Diagnostics = {
  lastError: string | null;
  lastErrorChunkIndex: number | null;
  voiceName: string | null;
  voiceURI: string | null;
  voiceLang: string | null;
  chunkIndex: number;
  chunkCount: number;
  recommendation: string | null;
};

export function VoiceOutput({
  text,
  appLang,
  preferLang,
}: {
  text: string;
  appLang: "ar" | "en";
  preferLang?: "ar" | "en";
}) {
  const [state, setState] = useState<PlaybackState>("idle");
  const [speed, setSpeed] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [diag, setDiag] = useState<Diagnostics>({
    lastError: null,
    lastErrorChunkIndex: null,
    voiceName: null,
    voiceURI: null,
    voiceLang: null,
    chunkIndex: 0,
    chunkCount: 0,
    recommendation: null,
  });

  const chunksRef = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);
  const playTokenRef = useRef(0);
  const stoppedRef = useRef(false);
  const activeRef = useRef(false);
  const speedRef = useRef(speed);
  const instanceIdRef = useRef(Math.random());
  const keepAliveRef = useRef<number | null>(null);
  const prevSpeedRef = useRef(speed);

  const prefs = useVoicePrefs();
  const speechText = useMemo(() => normalizeSpeechText(text), [text]);
  const langPrefix: "ar" | "en" = useMemo(
    () => preferLang ?? (isArabic(speechText) ? "ar" : "en"),
    [preferLang, speechText],
  );

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const copy = useMemo(
    () =>
      appLang === "ar"
        ? {
            play: "تشغيل", pause: "إيقاف مؤقت", stop: "إيقاف", replay: "إعادة",
            regenerate: "تجديد الصوت", speed: "السرعة",
            diagnostics: "تشخيص الصوت", testVoices: "اختبر أصواتي",
            voice: "الصوت", lang: "اللغة", chunk: "المقطع", lastError: "آخر خطأ",
            none: "لا يوجد", recommend: "اقتراح",
            voiceUnavailable: "لم يتم العثور على صوت متوافق. افتح \"اختبر أصواتي\" واختر صوتاً يعمل.",
            recoNoVoice: "ثبّت صوتاً عربياً من إعدادات النظام، أو اختر صوتاً آخر من \"اختبر أصواتي\".",
            recoInterrupted: "تم قطع التشغيل. تأكد أن تبويباً آخر لا يستخدم الصوت ثم أعد المحاولة.",
            recoSynthFailed: "فشل التركيب — جرّب صوتاً محلياً (local) من قائمة \"اختبر أصواتي\".",
            recoNetwork: "صوت سحابي يحتاج إنترنت — اختر صوتاً محلياً للاستقرار.",
          }
        : {
            play: "Play", pause: "Pause", stop: "Stop", replay: "Replay",
            regenerate: "Regenerate audio", speed: "Speed",
            diagnostics: "Voice diagnostics", testVoices: "Test my voices",
            voice: "Voice", lang: "Lang", chunk: "Chunk", lastError: "Last error",
            none: "None", recommend: "Recommendation",
            voiceUnavailable: "No compatible voice found. Open \"Test my voices\" and pick one that works.",
            recoNoVoice: "Install a system voice for this language, or pick a different one from \"Test my voices\".",
            recoInterrupted: "Playback was interrupted. Make sure no other tab is using audio and try again.",
            recoSynthFailed: "Synthesis failed — try a local (offline) voice from \"Test my voices\".",
            recoNetwork: "Cloud voice needs internet — switch to a local voice for reliability.",
          },
    [appLang],
  );

  const recommendationFor = useCallback(
    (errorCode: string | null, hadVoice: boolean) => {
      if (!errorCode) return null;
      if (!hadVoice) return copy.recoNoVoice;
      if (errorCode === "interrupted" || errorCode === "canceled") return copy.recoInterrupted;
      if (errorCode === "network" || errorCode === "audio-busy") return copy.recoNetwork;
      if (errorCode === "synthesis-failed" || errorCode === "synthesis-unavailable") return copy.recoSynthFailed;
      return copy.recoSynthFailed;
    },
    [copy],
  );

  // Chrome stops speechSynthesis after ~15s — pump it with pause/resume.
  const startKeepAlive = useCallback(() => {
    if (!supported) return;
    if (keepAliveRef.current != null) return;
    keepAliveRef.current = window.setInterval(() => {
      if (!activeRef.current) return;
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        try {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } catch { /* noop */ }
      }
    }, 10_000);
  }, [supported]);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current != null) {
      window.clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  const speakChunk = useCallback(
    (token: number) => {
      if (!supported || stoppedRef.current || token !== playTokenRef.current) return;
      const chunk = chunksRef.current[chunkIndexRef.current];
      if (!chunk) {
        activeRef.current = false;
        stopKeepAlive();
        setProgress(1);
        setState("idle");
        return;
      }

      const latestVoices = getVoices();
      const pool = latestVoices.length ? latestVoices : voices;
      const currentPrefs = loadVoicePrefs();

      // Per-language run detection: pick the dominant language of the chunk,
      // but if it contains both scripts, route to the run's language voice.
      const runs = splitByLanguage(chunk);
      const primary = runs[0];
      const runLang: "ar" | "en" = primary?.lang ?? langPrefix;
      const selectedVoice = pickBestVoice(pool, runLang, currentPrefs);

      const utterance = new SpeechSynthesisUtterance(primary?.text ?? chunk);
      utterance.lang = selectedVoice?.lang || (runLang === "ar" ? "ar-SA" : "en-US");
      // Brighter, more energetic delivery — a touch quicker and higher pitch.
      utterance.rate = Math.min(1.25, speedRef.current * 1.08);
      utterance.pitch = runLang === "ar" ? 1.18 : 1.22;
      utterance.volume = 1;
      if (selectedVoice) utterance.voice = selectedVoice;

      // If the chunk had multiple language runs, queue the remainder as
      // separate utterances so each run gets the right voice — and only
      // advance the chunk index when the last run finishes.
      const extraRuns = runs.slice(1);
      let runsRemaining = extraRuns.length;

      setDiag((d) => ({
        ...d,
        voiceName: selectedVoice?.name ?? null,
        voiceURI: selectedVoice?.voiceURI ?? null,
        voiceLang: utterance.lang,
        chunkIndex: chunkIndexRef.current,
        chunkCount: chunksRef.current.length,
      }));

      utterance.onstart = () => {
        if (token !== playTokenRef.current) return;
        activeRef.current = true;
        setNotice(null);
        setState("playing");
        startKeepAlive();
      };
      utterance.onend = () => {
        if (token !== playTokenRef.current || stoppedRef.current) return;
        if (runsRemaining > 0) {
          // Queue the next language run for this same chunk.
          const next = extraRuns[extraRuns.length - runsRemaining];
          runsRemaining -= 1;
          const v = pickBestVoice(pool, next.lang, currentPrefs);
          const u = new SpeechSynthesisUtterance(next.text);
          u.lang = v?.lang || (next.lang === "ar" ? "ar-SA" : "en-US");
          u.rate = Math.min(1.25, speedRef.current * 1.08);
          u.pitch = next.lang === "ar" ? 1.18 : 1.22;
          u.volume = 1;
          if (v) u.voice = v;
          // Re-bind to the same handlers so the chain advances correctly.
          u.onend = utterance.onend;
          u.onerror = utterance.onerror;
          window.speechSynthesis.speak(u);
          return;
        }
        chunkIndexRef.current += 1;
        setProgress(chunksRef.current.length ? chunkIndexRef.current / chunksRef.current.length : 1);
        // Small gap to avoid the Chrome cancel/queue race.
        window.setTimeout(() => speakChunk(token), 60);
      };
      utterance.onerror = (event) => {
        if (token !== playTokenRef.current) return;
        const code = (event.error as string) || "unknown";
        const reco = recommendationFor(code, !!selectedVoice);
        setDiag((d) => ({
          ...d,
          lastError: code,
          lastErrorChunkIndex: chunkIndexRef.current,
          recommendation: reco,
        }));
        if (code === "interrupted" || code === "canceled") return;
        // Try to keep going — skip the bad chunk.
        chunkIndexRef.current += 1;
        if (chunkIndexRef.current >= chunksRef.current.length) {
          activeRef.current = false;
          stopKeepAlive();
          setState("idle");
          setNotice(copy.voiceUnavailable);
          return;
        }
        window.setTimeout(() => speakChunk(token), 60);
      };

      window.speechSynthesis.speak(utterance);
    },
    [supported, voices, langPrefix, startKeepAlive, stopKeepAlive, recommendationFor, copy.voiceUnavailable],
  );

  const stop = useCallback(
    (silent = false) => {
      stoppedRef.current = true;
      activeRef.current = false;
      playTokenRef.current += 1;
      chunksRef.current = [];
      chunkIndexRef.current = 0;
      stopKeepAlive();
      setProgress(0);
      if (supported) {
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
      }
      if (!silent) setState("idle");
    },
    [supported, stopKeepAlive],
  );

  const createAndPlay = useCallback(() => {
    if (!supported || !speechText.trim()) return;
    const chunks = splitForSpeech(speechText);
    if (!chunks.length) return;

    // Reset state cleanly.
    playTokenRef.current += 1;
    const token = playTokenRef.current;
    stoppedRef.current = false;
    activeRef.current = true;
    chunksRef.current = chunks;
    chunkIndexRef.current = 0;
    setProgress(0);
    setNotice(null);
    setDiag((d) => ({ ...d, lastError: null, lastErrorChunkIndex: null, recommendation: null, chunkIndex: 0, chunkCount: chunks.length }));

    window.dispatchEvent(new CustomEvent(VOICE_OUTPUT_START, { detail: { id: instanceIdRef.current } }));

    // Chrome has a known race: speak() right after cancel() can swallow the
    // first utterance (you hear only the first word, e.g. "Astra"). Give the
    // engine a tick to drain before queueing.
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    window.setTimeout(() => {
      if (token === playTokenRef.current) speakChunk(token);
    }, 120);
  }, [speechText, speakChunk, supported]);

  const playOrResume = () => {
    if (!supported) return;
    if (state === "paused") {
      window.speechSynthesis.resume();
      setState("playing");
      return;
    }
    createAndPlay();
  };
  const pause = () => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setState("paused");
  };
  const replay = () => createAndPlay();

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(getVoices());
    load();
    const t = window.setTimeout(load, 300);
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => {
      window.clearTimeout(t);
      window.speechSynthesis.removeEventListener?.("voiceschanged", load);
    };
  }, [supported]);

  useEffect(() => {
    const onOther = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: number }>).detail;
      if (detail?.id === instanceIdRef.current) return;
      if (!activeRef.current) return;
      stoppedRef.current = true;
      activeRef.current = false;
      stopKeepAlive();
      setState("idle");
      setProgress(0);
    };
    window.addEventListener(VOICE_OUTPUT_START, onOther);
    return () => window.removeEventListener(VOICE_OUTPUT_START, onOther);
  }, [stopKeepAlive]);

  // Stop on unmount.
  useEffect(() => () => { stop(true); }, [stop]);

  useEffect(() => {
    speedRef.current = speed;
    // Only restart playback when SPEED actually changed. Without this guard
    // the effect also fires on `state` transitions (idle→playing), which
    // cancelled the running utterance and re-spoke chunk 0 — the user
    // heard the first word ("Hello") twice.
    if (prevSpeedRef.current === speed) return;
    prevSpeedRef.current = speed;
    if (state === "playing" && activeRef.current) {
      const remaining = chunksRef.current.slice(chunkIndexRef.current);
      chunksRef.current = remaining;
      chunkIndexRef.current = 0;
      playTokenRef.current += 1;
      const token = playTokenRef.current;
      stoppedRef.current = false;
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
      window.setTimeout(() => { if (token === playTokenRef.current) speakChunk(token); }, 120);
    }
  }, [speed, state, speakChunk]);

  if (!supported || !speechText.trim()) return null;

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-background/35 p-2" dir={appLang === "ar" ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center gap-1.5">
        {state === "playing" ? (
          <Button type="button" size="icon" variant="secondary" onClick={pause} aria-label={copy.pause} title={copy.pause}>
            <Pause className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button type="button" size="icon" variant="secondary" onClick={playOrResume} aria-label={copy.play} title={copy.play}>
            <Play className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button type="button" size="icon" variant="ghost" onClick={() => stop()} aria-label={copy.stop} title={copy.stop}>
          <Square className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={replay} aria-label={copy.replay} title={copy.replay}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={createAndPlay} aria-label={copy.regenerate} title={copy.regenerate}>
          <RefreshCcw className="h-3.5 w-3.5" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="icon" variant="ghost" aria-label={copy.diagnostics} title={copy.diagnostics}>
              <Info className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 text-xs" dir={appLang === "ar" ? "rtl" : "ltr"}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">{copy.diagnostics}</span>
              <VoiceTestDialog
                appLang={appLang}
                trigger={
                  <Button type="button" size="sm" variant="outline" className="h-7">
                    <Settings2 className="me-1 h-3 w-3" /> {copy.testVoices}
                  </Button>
                }
              />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">{copy.voice}</dt>
              <dd className="truncate">{diag.voiceName ?? copy.none}</dd>
              <dt className="text-muted-foreground">{copy.lang}</dt>
              <dd className="truncate">{diag.voiceLang ?? copy.none}</dd>
              <dt className="text-muted-foreground">{copy.chunk}</dt>
              <dd>{diag.chunkCount ? `${diag.chunkIndex + 1} / ${diag.chunkCount}` : "—"}</dd>
              <dt className="text-muted-foreground">{copy.lastError}</dt>
              <dd className="truncate">
                {diag.lastError ? `${diag.lastError}${diag.lastErrorChunkIndex != null ? ` @ #${diag.lastErrorChunkIndex + 1}` : ""}` : copy.none}
              </dd>
            </dl>
            {diag.recommendation && (
              <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200">
                <span className="font-medium">{copy.recommend}: </span>{diag.recommendation}
              </p>
            )}
          </PopoverContent>
        </Popover>

        <div className="ms-2 flex min-w-40 flex-1 items-center gap-2 text-xs text-muted-foreground" dir="ltr">
          <Volume2 className="h-3.5 w-3.5 shrink-0" />
          <span className="shrink-0">{copy.speed}</span>
          <Slider value={[speed]} min={0.7} max={1.2} step={0.05} onValueChange={([v]) => setSpeed(v ?? 1)} className="min-w-20 flex-1" />
          <span className="w-9 text-end tabular-nums">{speed.toFixed(2)}×</span>
        </div>
      </div>

      {(state === "playing" || state === "paused" || progress > 0 || notice) && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/40" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }} />
        </div>
      )}
      {notice && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{notice}</span>
          <VoiceTestDialog
            appLang={appLang}
            trigger={<Button type="button" size="sm" variant="outline" className="h-7">{copy.testVoices}</Button>}
          />
        </div>
      )}
    </div>
  );
}
