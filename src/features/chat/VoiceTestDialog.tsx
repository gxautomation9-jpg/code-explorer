import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Check, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { loadVoicePrefs, saveVoicePrefs, pickBestVoice } from "@/features/chat/VoiceSettings";

const SAMPLES = {
  en: "Hello, I'm Astra. This is a quick test of my English voice — clear, calm, and natural.",
  ar: "مرحباً، أنا أسترا. هذا اختبار سريع لصوتي العربي — واضح، هادئ، وطبيعي.",
};

export function VoiceTestDialog({ appLang, trigger }: { appLang: "ar" | "en"; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [prefs, setPrefs] = useState(() => loadVoicePrefs());
  const [playingURI, setPlayingURI] = useState<string | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported || !open) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    const t = window.setTimeout(load, 250);
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => {
      window.clearTimeout(t);
      window.speechSynthesis.removeEventListener?.("voiceschanged", load);
      window.speechSynthesis.cancel();
      setPlayingURI(null);
    };
  }, [open, supported]);

  const arVoices = useMemo(() => voices.filter((v) => v.lang.toLowerCase().startsWith("ar")), [voices]);
  const enVoices = useMemo(() => voices.filter((v) => v.lang.toLowerCase().startsWith("en")), [voices]);

  const test = (voice: SpeechSynthesisVoice, lang: "ar" | "en") => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(SAMPLES[lang]);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;
    u.onstart = () => setPlayingURI(voice.voiceURI);
    u.onend = () => setPlayingURI(null);
    u.onerror = () => setPlayingURI(null);
    utterRef.current = u;
    window.setTimeout(() => window.speechSynthesis.speak(u), 60);
  };

  const stop = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setPlayingURI(null);
  };

  const select = (voice: SpeechSynthesisVoice, lang: "ar" | "en") => {
    const patch = lang === "ar" ? { arVoiceURI: voice.voiceURI } : { enVoiceURI: voice.voiceURI };
    saveVoicePrefs(patch);
    setPrefs((p) => ({ ...p, ...patch }));
  };

  const togglePreferFemale = (v: boolean) => {
    saveVoicePrefs({ preferFemale: v });
    setPrefs((p) => ({ ...p, preferFemale: v }));
  };

  const playFullSample = (lang: "ar" | "en") => {
    const v = pickBestVoice(voices, lang, prefs);
    if (!v) return;
    test(v, lang);
  };

  const renderList = (list: SpeechSynthesisVoice[], lang: "ar" | "en") => {
    const selectedURI = lang === "ar" ? prefs.arVoiceURI : prefs.enVoiceURI;
    const auto = pickBestVoice(voices, lang, prefs);
    if (list.length === 0) {
      return (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          {appLang === "ar"
            ? `لا توجد أصوات ${lang === "ar" ? "عربية" : "إنجليزية"} مثبّتة في هذا المتصفح. ثبّت صوتاً من إعدادات النظام.`
            : `No ${lang === "ar" ? "Arabic" : "English"} voices installed in this browser. Install one from your OS settings.`}
        </p>
      );
    }
    return (
      <div className="space-y-1">
        {list.map((v) => {
          const isPlaying = playingURI === v.voiceURI;
          const isSelected = selectedURI === v.voiceURI || (!selectedURI && auto?.voiceURI === v.voiceURI);
          return (
            <div
              key={v.voiceURI}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${
                isSelected ? "border-primary/60 bg-primary/5" : "border-border/60"
              }`}
            >
              <Button
                type="button"
                size="icon"
                variant={isPlaying ? "secondary" : "ghost"}
                onClick={() => (isPlaying ? stop() : test(v, lang))}
                aria-label={isPlaying ? "Stop" : "Test"}
                className="h-7 w-7"
              >
                {isPlaying ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{v.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {v.lang}
                  {v.localService ? " · local" : " · cloud"}
                  {!selectedURI && auto?.voiceURI === v.voiceURI ? (appLang === "ar" ? " · افتراضي" : " · auto-pick") : ""}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                onClick={() => select(v, lang)}
                className="h-7"
              >
                {isSelected ? <Check className="h-3 w-3" /> : appLang === "ar" ? "اختر" : "Use"}
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl" dir={appLang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{appLang === "ar" ? "اختبر أصواتك" : "Test my voices"}</DialogTitle>
          <DialogDescription>
            {appLang === "ar"
              ? "شغّل عيّنة قصيرة بكل صوت متاح ثم اختر الأفضل لقراءة الردود."
              : "Play a short sample with each available voice and choose the one that sounds best for replies."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border border-border/60 p-2">
          <div className="flex items-center gap-2 text-sm">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="prefer-female">{appLang === "ar" ? "تفضيل صوت أنثوي" : "Prefer a female voice"}</Label>
          </div>
          <Switch id="prefer-female" checked={prefs.preferFemale} onCheckedChange={togglePreferFemale} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{appLang === "ar" ? "العربية" : "Arabic"}</h3>
              <Button size="sm" variant="outline" onClick={() => playFullSample("ar")} className="h-7">
                <Play className="me-1 h-3 w-3" /> {appLang === "ar" ? "عيّنة" : "Sample"}
              </Button>
            </div>
            <ScrollArea className="h-64 rounded-md border border-border/60 p-2">{renderList(arVoices, "ar")}</ScrollArea>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{appLang === "ar" ? "الإنجليزية" : "English"}</h3>
              <Button size="sm" variant="outline" onClick={() => playFullSample("en")} className="h-7">
                <Play className="me-1 h-3 w-3" /> {appLang === "ar" ? "عيّنة" : "Sample"}
              </Button>
            </div>
            <ScrollArea className="h-64 rounded-md border border-border/60 p-2">{renderList(enVoices, "en")}</ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {appLang === "ar" ? "تم" : "Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
