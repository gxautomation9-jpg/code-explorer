import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eraser, Languages, Mic, MicOff, Send, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type VoiceLang = "ar" | "en";

type Segment = {
  text: string;
  confidence: number; // 0..1
  lang: VoiceLang;
};

type RecognitionAlt = { transcript: string; confidence?: number };
type RecognitionResult = { isFinal: boolean; length: number; 0: RecognitionAlt };
type RecognitionResultList = { length: number; [index: number]: RecognitionResult };
type RecognitionEvent = Event & { resultIndex: number; results: RecognitionResultList };
type RecognitionErrorEvent = Event & { error?: string; message?: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

function cleanSpacing(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function getRecognitionLanguage(lang: VoiceLang) {
  return lang === "ar" ? "ar-SA" : "en-US";
}

const FILLERS_EN = /\b(uh+|u+m+|er+|hmm+|like|you know|i mean|sort of|kind of|basically|literally|actually)\b/gi;
const FILLERS_AR = /\b(يعني|اه+|ايه+|إيه+|طب|طيب|اممم+|امم+|يا عم|بصراحة|في الواقع|على فكرة)\b/g;

function removeFillers(text: string) {
  return cleanSpacing(text.replace(FILLERS_EN, "").replace(FILLERS_AR, ""));
}

function fixPunctuation(text: string) {
  let t = text;
  // Normalize Arabic punctuation when next to Arabic words
  t = t.replace(/\s+([,.!?،؛؟])/g, "$1");
  t = t.replace(/([,.!?،؛؟])(\S)/g, "$1 $2");
  // Capitalize sentence starts in latin
  t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p1, p2) => p1 + p2.toUpperCase());
  return cleanSpacing(t);
}

function trimMessy(text: string) {
  return cleanSpacing(text.replace(/[\u200e\u200f\u202a-\u202e]/g, ""));
}

export function VoiceInput({
  appLang,
  disabled,
  onUseTranscript,
  onSendTranscript,
}: {
  appLang: "ar" | "en";
  disabled?: boolean;
  onUseTranscript: (text: string) => void;
  onSendTranscript: (text: string) => void | Promise<void>;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [voiceLang, setVoiceLang] = useState<VoiceLang>(appLang);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [draftTranscript, setDraftTranscript] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState(() => Array.from({ length: 28 }, () => 0.12));

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recordingRef = useRef(false);
  const voiceLangRef = useRef<VoiceLang>(appLang);
  const segmentsRef = useRef<Segment[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);

  voiceLangRef.current = voiceLang;

  // When the app language changes (and the panel isn't open), follow it.
  useEffect(() => {
    if (!panelOpen) setVoiceLang(appLang);
  }, [appLang, panelOpen]);

  const copy = useMemo(
    () =>
      appLang === "ar"
        ? {
            mic: "إملاء صوتي",
            listening: "أستمع الآن",
            ready: "النص النهائي",
            unsupported: "التعرّف الصوتي غير مدعوم في هذا المتصفح. جرّب Chrome أو Edge.",
            permission: "يجب السماح باستخدام الميكروفون للبدء.",
            placeholder: "سيظهر النص النهائي هنا ويمكنك تعديله قبل الإرسال…",
            interim: "النص الحي",
            start: "بدء",
            stop: "إيقاف",
            use: "استخدام",
            send: "إرسال",
            clear: "مسح",
            close: "إغلاق",
            hint: "اختر لغة الإملاء قبل التحدث",
            cleanupTitle: "أدوات تنظيف سريعة",
            removeFillers: "إزالة كلمات الحشو",
            fixPunct: "تنسيق الترقيم",
            cleanAll: "تنظيف شامل",
            lowConf: "مقاطع غير واضحة — اضغط لإعادة الاستماع أو تعديل",
            switchHint: "اللغة الحالية:",
          }
        : {
            mic: "Voice dictation",
            listening: "Listening live",
            ready: "Final transcript",
            unsupported: "Live speech recognition is not supported in this browser. Try Chrome or Edge.",
            permission: "Microphone permission is required to start.",
            placeholder: "Your final transcript appears here, editable before sending…",
            interim: "Live text",
            start: "Start",
            stop: "Stop",
            use: "Use",
            send: "Send",
            clear: "Clear",
            close: "Close",
            hint: "Pick your dictation language before speaking",
            cleanupTitle: "Quick cleanup tools",
            removeFillers: "Remove fillers",
            fixPunct: "Fix punctuation",
            cleanAll: "Clean all",
            lowConf: "Low-confidence segments — review or re-record",
            switchHint: "Listening in:",
          },
    [appLang],
  );

  const stopWaveform = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    setLevels(Array.from({ length: 28 }, () => 0.12));
  };

  const startWaveform = (stream: MediaStream) => {
    stopWaveform();
    mediaStreamRef.current = stream;
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    audioContextRef.current = audioContext;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      analyser.getByteFrequencyData(data);
      const next = Array.from({ length: 28 }, (_, index) => {
        const bucket = Math.floor((index / 28) * data.length);
        return Math.max(0.08, Math.min(1, data[bucket] / 190));
      });
      setLevels(next);
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const tearDownRecognition = () => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try { rec.stop(); } catch { /* noop */ }
    }
  };

  const stopRecording = () => {
    recordingRef.current = false;
    setIsRecording(false);
    tearDownRecognition();
    stopWaveform();
    setInterimTranscript("");
  };

  const buildDraftFromSegments = (segs: Segment[]) =>
    cleanSpacing(segs.map((s) => s.text).join(" "));

  const startRecording = async (langOverride?: VoiceLang) => {
    setPanelOpen(true);
    setError(null);

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { setError(copy.unsupported); return; }

    const targetLang = langOverride ?? voiceLangRef.current;

    try {
      let stream = mediaStreamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        startWaveform(stream);
      }

      tearDownRecognition();
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = getRecognitionLanguage(targetLang);
      recognition.onresult = (event) => {
        let interimChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const alt = result[0];
          const transcript = (alt?.transcript ?? "").trim();
          if (!transcript) continue;
          if (result.isFinal) {
            const seg: Segment = {
              text: transcript,
              confidence: typeof alt.confidence === "number" ? alt.confidence : 0.85,
              lang: voiceLangRef.current,
            };
            segmentsRef.current = [...segmentsRef.current, seg];
            setSegments(segmentsRef.current);
            setDraftTranscript(buildDraftFromSegments(segmentsRef.current));
          } else {
            interimChunk += ` ${transcript}`;
          }
        }
        setInterimTranscript(cleanSpacing(interimChunk));
      };
      recognition.onerror = (event) => {
        if (event.error === "not-allowed") setError(copy.permission);
        else if (event.error && event.error !== "no-speech" && event.error !== "aborted") {
          setError(event.message || event.error);
        }
      };
      recognition.onend = () => {
        if (!recordingRef.current) return;
        try { recognition.start(); } catch {
          setIsRecording(false);
          recordingRef.current = false;
          stopWaveform();
        }
      };

      recognitionRef.current = recognition;
      recordingRef.current = true;
      setIsRecording(true);
      recognition.start();
    } catch {
      setError(copy.permission);
      recordingRef.current = false;
      setIsRecording(false);
      stopWaveform();
    }
  };

  const switchLanguage = (next: VoiceLang) => {
    setVoiceLang(next);
    voiceLangRef.current = next;
    if (recordingRef.current) {
      // Restart recognition with the new language without dropping the mic stream
      tearDownRecognition();
      // Small async to let the engine release before re-init
      setTimeout(() => { if (recordingRef.current) startRecording(next); }, 80);
    }
  };

  const clearTranscript = () => {
    segmentsRef.current = [];
    setSegments([]);
    setDraftTranscript("");
    setInterimTranscript("");
  };

  const applyCleanup = (fn: (text: string) => string) => {
    setDraftTranscript((prev) => fn(prev));
    segmentsRef.current = segmentsRef.current.map((s) => ({ ...s, text: fn(s.text), confidence: Math.max(s.confidence, 0.9) }));
    setSegments(segmentsRef.current);
  };

  const cleanAll = () => applyCleanup((t) => fixPunctuation(removeFillers(trimMessy(t))));

  // When user edits the textarea by hand, drop segment-confidence tracking
  // for changed portions by collapsing into one high-confidence segment.
  const onDraftEdit = (value: string) => {
    setDraftTranscript(value);
    segmentsRef.current = value.trim()
      ? [{ text: value, confidence: 0.99, lang: voiceLangRef.current }]
      : [];
    setSegments(segmentsRef.current);
  };

  const useTranscript = () => {
    const text = cleanSpacing(draftTranscript || interimTranscript);
    if (!text) return;
    onUseTranscript(text);
    setPanelOpen(false);
  };

  const sendTranscript = async () => {
    const text = cleanSpacing(draftTranscript || interimTranscript);
    if (!text || isSending) return;
    setIsSending(true);
    stopRecording();
    await onSendTranscript(text);
    setIsSending(false);
    clearTranscript();
    setPanelOpen(false);
  };

  useEffect(() => () => {
    recordingRef.current = false;
    tearDownRecognition();
    stopWaveform();
  }, []);

  const hasLowConfidence = segments.some((s) => s.confidence < 0.7);
  const dirOfDraft = voiceLang === "ar" ? "rtl" : "ltr";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant={isRecording ? "secondary" : "ghost"}
          onClick={() => (isRecording ? stopRecording() : startRecording())}
          disabled={disabled}
          aria-label={copy.mic}
          className={isRecording ? "text-electric" : undefined}
        >
          {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        {panelOpen && (
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-electric/40 bg-secondary/60 p-0.5 shadow-[0_0_0_1px_rgba(64,180,255,0.15)]" dir="ltr">
              <button
                type="button"
                onClick={() => switchLanguage("ar")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${voiceLang === "ar" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                title="العربية"
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => switchLanguage("en")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${voiceLang === "en" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                title="English"
              >
                English
              </button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {copy.switchHint} <span className="font-medium text-foreground">{voiceLang === "ar" ? "العربية" : "English"}</span>
            </span>
          </div>
        )}
      </div>

      {panelOpen && (
        <div className="rounded-2xl border border-border/70 bg-card/80 p-3 shadow-lg backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Languages className="h-4 w-4 text-electric" />
              <span>{isRecording ? copy.listening : copy.ready}</span>
              <span className="text-xs font-normal text-muted-foreground">· {copy.hint}</span>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => { stopRecording(); setPanelOpen(false); }} aria-label={copy.close}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-3 flex h-14 items-center gap-1 overflow-hidden rounded-xl border border-border/60 bg-background/45 px-3" dir="ltr">
            {levels.map((level, index) => (
              <span
                key={index}
                className="w-full rounded-full bg-primary transition-[height] duration-75"
                style={{ height: `${Math.round(12 + level * 38)}px`, opacity: 0.35 + level * 0.65 }}
              />
            ))}
          </div>

          {/* Highlighted preview with low-confidence segments */}
          {segments.length > 0 && (
            <div
              className="mb-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2 text-sm leading-relaxed"
              dir={dirOfDraft}
            >
              {segments.map((s, i) => {
                const low = s.confidence < 0.7;
                return (
                  <span
                    key={i}
                    className={
                      low
                        ? "rounded bg-amber-500/15 px-1 text-amber-300 underline decoration-dotted underline-offset-4"
                        : "text-foreground"
                    }
                    title={low ? `${copy.lowConf} (${Math.round(s.confidence * 100)}%)` : `${Math.round(s.confidence * 100)}%`}
                  >
                    {s.text}{" "}
                  </span>
                );
              })}
            </div>
          )}

          <Textarea
            value={draftTranscript}
            onChange={(event) => onDraftEdit(event.target.value)}
            dir={dirOfDraft}
            placeholder={copy.placeholder}
            className="min-h-24 resize-none bg-background/35"
          />

          {interimTranscript && (
            <p className="mt-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground" dir={dirOfDraft}>
              <span className="font-medium text-foreground">{copy.interim}: </span>{interimTranscript}
            </p>
          )}
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

          {/* Cleanup toolbar */}
          {(draftTranscript || segments.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-background/30 p-1.5">
              <span className="ms-1 me-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3 w-3 text-electric" /> {copy.cleanupTitle}
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => applyCleanup(removeFillers)}>
                <Eraser className="h-3.5 w-3.5" /> {copy.removeFillers}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => applyCleanup(fixPunctuation)}>
                <Wand2 className="h-3.5 w-3.5" /> {copy.fixPunct}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={cleanAll}>
                <Sparkles className="h-3.5 w-3.5" /> {copy.cleanAll}
              </Button>
              {hasLowConfidence && (
                <span className="ms-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">
                  {copy.lowConf}
                </span>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => (isRecording ? stopRecording() : startRecording())} disabled={disabled}>
                {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {isRecording ? copy.stop : copy.start}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clearTranscript} disabled={!draftTranscript && !interimTranscript}>
                <Trash2 className="h-3.5 w-3.5" /> {copy.clear}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={useTranscript} disabled={!cleanSpacing(draftTranscript || interimTranscript)}>
                <Check className="h-3.5 w-3.5" /> {copy.use}
              </Button>
              <Button type="button" size="sm" onClick={sendTranscript} disabled={!cleanSpacing(draftTranscript || interimTranscript) || isSending || disabled}>
                <Send className="h-3.5 w-3.5" /> {copy.send}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
