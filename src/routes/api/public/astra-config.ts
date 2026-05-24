import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/astra-config")({
  server: {
    handlers: {
      GET: async () => {
        let autoPurgeEnabled = false;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const BUCKET = "astra-config";
          const { data: bucket } = await supabaseAdmin.storage.getBucket(BUCKET);
          if (bucket) {
            const { data, error } = await supabaseAdmin.storage.from(BUCKET).download("settings.json");
            if (!error && data) {
              const obj = JSON.parse(await data.text()) as { autoPurgeEnabled?: boolean };
              autoPurgeEnabled = Boolean(obj.autoPurgeEnabled);
            }
          }
        } catch { /* default false */ }
        return new Response(
          JSON.stringify({ autoPurgeEnabled, retentionDays: autoPurgeEnabled ? 3 : null }),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } },
        );
      },
    },
  },
});
