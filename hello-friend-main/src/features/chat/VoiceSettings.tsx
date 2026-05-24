import { useEffect, useState } from "react";

// Global, app-wide TTS preferences persisted in localStorage and shared between
// the VoiceOutput player and the "Test my voices" picker dialog.
export type VoicePrefs = {
  arVoiceURI: string | null;
  enVoiceURI: string | null;
  preferFemale: boolean;
};

const STORAGE_KEY = "astra-voice-prefs-v1";
const EVENT = "astra-voice-prefs-changed";

const DEFAULT: VoicePrefs = { arVoiceURI: null, enVoiceURI: null, preferFemale: true };

export function loadVoicePrefs(): VoicePrefs {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function saveVoicePrefs(patch: Partial<VoicePrefs>) {
  if (typeof window === "undefined") return;
  const next = { ...loadVoicePrefs(), ...patch };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

export function useVoicePrefs(): VoicePrefs {
  // Start with DEFAULT so server and first client render match. Hydrate from
  // localStorage after mount to avoid React hydration mismatches (#418).
  const [prefs, setPrefs] = useState<VoicePrefs>(DEFAULT);
  useEffect(() => {
    setPrefs(loadVoicePrefs());
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<VoicePrefs>).detail;
      if (detail) setPrefs(detail);
      else setPrefs(loadVoicePrefs());
    };
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return prefs;
}

// Heuristic — surface the most natural female voice the system offers.
const FEMALE_HINTS = [
  "female", "woman", "samantha", "victoria", "karen", "moira", "tessa", "fiona",
  "zira", "hazel", "susan", "linda", "amy", "joanna", "salli", "kimberly", "ivy",
  "ella", "ava", "allison", "kendra", "nicole", "emma", "olivia", "sophia",
  "google us english", "google uk english female",
  // Arabic female-coded names commonly shipped by Apple / Microsoft / Google
  "hoda", "laila", "salma", "naayf", "amira", "zariyah", "زينة", "هدى", "ليلى",
];
const MALE_HINTS = ["male", "man", "daniel", "alex", "fred", "david", "mark", "george", "tom", "ahmed", "khalid"];

// Voices that tend to sound brighter / more lively across platforms.
const ENERGETIC_HINTS = [
  "ava", "ella", "joanna", "salli", "kimberly", "ivy", "amy",
  "samantha", "victoria", "zira", "olivia", "emma", "sophia",
  "google us english", "natural", "neural", "premium", "enhanced",
  "هدى", "hoda", "salma", "laila", "amira",
];

function score(voice: SpeechSynthesisVoice, preferFemale: boolean) {
  const n = voice.name.toLowerCase();
  let s = 0;
  if (voice.localService) s += 5;
  if (n.includes("google")) s += 4;
  if (n.includes("natural") || n.includes("neural") || n.includes("premium") || n.includes("enhanced")) s += 6;
  if (ENERGETIC_HINTS.some((h) => n.includes(h))) s += 4;
  if (preferFemale) {
    if (FEMALE_HINTS.some((h) => n.includes(h))) s += 8;
    if (MALE_HINTS.some((h) => n.includes(h))) s -= 6;
  }
  return s;
}

export function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  langPrefix: "ar" | "en",
  prefs: VoicePrefs,
): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  const saved = langPrefix === "ar" ? prefs.arVoiceURI : prefs.enVoiceURI;
  if (saved) {
    const exact = voices.find((v) => v.voiceURI === saved);
    if (exact) return exact;
  }
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  const pool = matching.length ? matching : voices;
  return [...pool].sort((a, b) => score(b, prefs.preferFemale) - score(a, prefs.preferFemale))[0];
}
