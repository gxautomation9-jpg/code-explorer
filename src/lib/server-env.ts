// Captures the Cloudflare Worker `env` binding from the fetch handler and
// exposes a uniform getter that works on Cloudflare, Node, and dev.
//
// On Cloudflare, secrets set in the dashboard are delivered via the `env`
// argument to fetch(request, env, ctx) — NOT on process.env. We stash that
// env here on the first request so any server code can read from it.

let workerEnv: Record<string, unknown> | undefined;

export function setWorkerEnv(env: unknown) {
  if (env && typeof env === "object") {
    workerEnv = env as Record<string, unknown>;
  }
}

export function getServerEnv(name: string): string | undefined {
  const fromProcess =
    typeof process !== "undefined" ? (process.env?.[name] as string | undefined) : undefined;
  if (fromProcess) return fromProcess;
  const fromWorker = workerEnv?.[name];
  return typeof fromWorker === "string" ? fromWorker : undefined;
}

export function requireServerEnv(name: string): string {
  const value = getServerEnv(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
