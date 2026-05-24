import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { getServerEnv } from "@/lib/server-env";

const MODEL = "gemini-2.5-flash-preview-tts";
const MAX_TEXT_LENGTH = 4_500;

function base64ToBytes(value: string) {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pcmToWav(pcm: Uint8Array, sampleRate = 24_000) {
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  new Uint8Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const requestBody = await request.json().catch(() => null) as { text?: unknown } | null;
        const text = typeof requestBody?.text === "string" ? requestBody.text.trim() : "";
        if (!text) return new Response("text required", { status: 400 });
        if (text.length > MAX_TEXT_LENGTH) return new Response("text too long", { status: 413 });

        const key = getServerEnv("GEMINI_API_KEY");
        if (!key) return new Response("voice key missing", { status: 503 });

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
                },
              },
            }),
          },
        );

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error("/api/tts failed", response.status, detail.slice(0, 300));
          // Pass through 429 (rate limit) so the client can surface a meaningful message and fall back.
          const status = response.status === 429 ? 429 : 502;
          const reason = response.status === 429 ? "rate_limited" : "upstream_failed";
          return new Response(JSON.stringify({ error: reason, detail: detail.slice(0, 300) }), {
            status,
            headers: { "content-type": "application/json" },
          });
        }

        const payload = await response.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
        };
        const inline = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
        if (!inline?.data) return new Response("voice audio missing", { status: 502 });

        const audio = base64ToBytes(inline.data);
        const sampleRate = Number(inline.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24_000);
        const audioBody = inline.mimeType?.includes("wav") ? audio : pcmToWav(audio, sampleRate);

        return new Response(audioBody, {
          headers: {
            "content-type": "audio/wav",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});