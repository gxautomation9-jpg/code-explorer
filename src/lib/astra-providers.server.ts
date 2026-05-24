import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getServerEnv } from "@/lib/server-env";
import type { LanguageModel } from "ai";

// Provider order = silent fallback priority. Users never see these names.
type ProviderSpec = {
  id: string;
  label: string; // for admin/logs only — never sent to client
  build: () => LanguageModel | null;
};

function gemini(keyName: string, modelId: string) {
  const key = getServerEnv(keyName);
  if (!key) return null;
  const provider = createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    headers: { Authorization: `Bearer ${key}` },
  });
  return provider(modelId);
}

function xai(modelId: string) {
  const key = getServerEnv("XAI_API_KEY");
  if (!key) return null;
  const provider = createOpenAICompatible({
    name: "xai",
    baseURL: "https://api.x.ai/v1",
    headers: { Authorization: `Bearer ${key}` },
  });
  return provider(modelId);
}

// Ordered hierarchy: strongest first, with key rotation + cross-provider fallback.
export const PROVIDER_CHAIN: ProviderSpec[] = [
  { id: "g25p-1", label: "gemini-2.5-pro#1",   build: () => gemini("GEMINI_API_KEY_1", "gemini-2.5-pro") },
  { id: "g25p-2", label: "gemini-2.5-pro#2",   build: () => gemini("GEMINI_API_KEY_2", "gemini-2.5-pro") },
  { id: "g25p-3", label: "gemini-2.5-pro#3",   build: () => gemini("GEMINI_API_KEY_3", "gemini-2.5-pro") },
  { id: "g25p-leg", label: "gemini-2.5-pro#legacy", build: () => gemini("GEMINI_API_KEY", "gemini-2.5-pro") },
  { id: "grok-fast", label: "grok-4-fast",     build: () => xai("grok-4-fast-reasoning") },
  { id: "grok-2",    label: "grok-2",          build: () => xai("grok-2-1212") },
  { id: "g25f-1", label: "gemini-2.5-flash#1", build: () => gemini("GEMINI_API_KEY_1", "gemini-2.5-flash") },
  { id: "g25f-2", label: "gemini-2.5-flash#2", build: () => gemini("GEMINI_API_KEY_2", "gemini-2.5-flash") },
  { id: "g25f-3", label: "gemini-2.5-flash#3", build: () => gemini("GEMINI_API_KEY_3", "gemini-2.5-flash") },
  { id: "g25f-leg", label: "gemini-2.5-flash#legacy", build: () => gemini("GEMINI_API_KEY", "gemini-2.5-flash") },
  { id: "g25fl-1", label: "gemini-2.5-flash-lite#1", build: () => gemini("GEMINI_API_KEY_1", "gemini-2.5-flash-lite") },
  { id: "g25fl-2", label: "gemini-2.5-flash-lite#2", build: () => gemini("GEMINI_API_KEY_2", "gemini-2.5-flash-lite") },
  { id: "g25fl-3", label: "gemini-2.5-flash-lite#3", build: () => gemini("GEMINI_API_KEY_3", "gemini-2.5-flash-lite") },
];

export type AttemptResult = {
  model: LanguageModel;
  spec: ProviderSpec;
};

export function buildAvailableChain(): AttemptResult[] {
  const out: AttemptResult[] = [];
  for (const spec of PROVIDER_CHAIN) {
    const m = spec.build();
    if (m) out.push({ model: m, spec });
  }
  return out;
}
