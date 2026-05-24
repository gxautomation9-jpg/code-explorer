// Server-only implementation. NEVER import from client code.
// All createServerFn handlers call into this module via dynamic import.
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCookie, setCookie } from "@tanstack/react-start/server";

const COOKIE = "astra_admin_session";
const SESSION_TTL_MS = 60 * 60 * 1000;

function secret() {
  const s = process.env.ADMIN_PANEL_PASSWORD;
  if (!s) throw new Error("Admin not configured");
  return s;
}
function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}
function makeToken() {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `v1.${exp}`;
  return `${payload}.${sign(payload)}`;
}
function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [v, expStr, sig] = parts;
  if (v !== "v1") return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = sign(`${v}.${expStr}`);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch { return false; }
}
export function isAuthed() { return verifyToken(getCookie(COOKIE)); }
function requireAdmin() { if (!isAuthed()) throw new Error("Unauthorized"); }

const attempts = new Map<string, { n: number; until: number }>();
function checkLock(ip: string) {
  const r = attempts.get(ip);
  if (r && r.until > Date.now()) throw new Error("Too many attempts. Try later.");
}
function recordFail(ip: string) {
  const r = attempts.get(ip) ?? { n: 0, until: 0 };
  r.n += 1;
  if (r.n >= 5) { r.until = Date.now() + 15 * 60 * 1000; r.n = 0; }
  attempts.set(ip, r);
}
function clearFail(ip: string) { attempts.delete(ip); }

const BUCKET = "astra-config";
const SETTINGS_PATH = "settings.json";
export type Settings = { autoPurgeEnabled: boolean; updatedAt: string };
const DEFAULT_SETTINGS: Settings = { autoPurgeEnabled: false, updatedAt: new Date(0).toISOString() };

async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET);
  if (!data) await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
}
export async function readSettings(): Promise<Settings> {
  try {
    await ensureBucket();
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(SETTINGS_PATH);
    if (error || !data) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(await data.text()) as Partial<Settings>) };
  } catch { return DEFAULT_SETTINGS; }
}
async function writeSettings(next: Settings) {
  await ensureBucket();
  const blob = new Blob([JSON.stringify(next)], { type: "application/json" });
  await supabaseAdmin.storage.from(BUCKET).upload(SETTINGS_PATH, blob, {
    upsert: true, contentType: "application/json", cacheControl: "10",
  });
}

export async function doLogin(password: string) {
  checkLock("global");
  const pw = secret();
  const a = Buffer.from(password);
  const b = Buffer.from(pw);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) { recordFail("global"); throw new Error("Invalid password"); }
  clearFail("global");
  setCookie(COOKIE, makeToken(), {
    httpOnly: true, secure: true, sameSite: "none", path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return { ok: true };
}
export function doLogout() {
  setCookie(COOKIE, "", { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: 0 });
  return { ok: true };
}

export async function getStats() {
  requireAdmin();
  let userCount = 0;
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    userCount += data.users.length;
    if (data.users.length < 1000) break;
    page += 1;
    if (page > 50) break;
  }
  let storageBytes = 0;
  let storageFiles = 0;
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    for (const b of buckets ?? []) {
      const { data: files } = await supabaseAdmin.storage.from(b.name).list("", { limit: 1000 });
      for (const f of files ?? []) {
        storageBytes += (f.metadata as { size?: number } | null)?.size ?? 0;
        storageFiles += 1;
      }
    }
  } catch { /* ignore */ }
  return {
    users: userCount,
    storage: { usedBytes: storageBytes, files: storageFiles, quotaBytes: 1024 * 1024 * 1024 },
    settings: await readSettings(),
  };
}

export async function listUsers() {
  requireAdmin();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error("Failed to list users");
  return {
    users: data.users.map((u) => ({
      id: u.id, email: u.email ?? null,
      createdAt: u.created_at, lastSignIn: u.last_sign_in_at ?? null,
    })),
  };
}

export async function deleteUser(userId: string) {
  requireAdmin();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setAutoPurge(enabled: boolean): Promise<Settings> {
  requireAdmin();
  const next: Settings = { autoPurgeEnabled: enabled, updatedAt: new Date().toISOString() };
  await writeSettings(next);
  return next;
}
