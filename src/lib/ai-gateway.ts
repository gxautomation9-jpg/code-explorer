import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Google Gemini exposes an OpenAI-compatible endpoint.
// Docs: https://ai.google.dev/gemini-api/docs/openai
export const createGeminiProvider = (apiKey: string) =>
  createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
