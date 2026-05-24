import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  adminLogin, adminLogout, adminCheck,
  adminStats, adminListUsers, adminDeleteUser, adminSetAutoPurge,
} from "@/lib/astra-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShieldCheck, LogOut, Trash2, Database, Users, Settings as Cog } from "lucide-react";

export const Route = createFileRoute("/gx-control")({
  validateSearch: (s: Record<string, unknown>) => ({ key: typeof s.key === "string" ? s.key : undefined }),
  head: () => ({ meta: [{ title: "GX Control" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: GxControl,
});

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function GxControl() {
  const check = useServerFn(adminCheck);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => { check().then((r) => setAuthed(r.ok)).catch(() => setAuthed(false)); }, [check]);

  if (authed === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return authed ? <Dashboard onLogout={() => setAuthed(false)} /> : <LoginScreen onAuthed={() => setAuthed(true)} />;
}

function LoginScreen({ onAuthed }: { onAuthed: () => void }) {
  const login = useServerFn(adminLogin);
  const { key } = Route.useSearch();
  const [pw, setPw] = useState(key ?? "");
  const [busy, setBusy] = useState(false);
  const triedRef = useRef(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try { await login({ data: { password: pw } }); onAuthed(); }
    catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (key && !triedRef.current) { triedRef.current = true; void submit(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-sm border-electric/20 p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-electric" />
          <h1 className="text-lg font-semibold">GX Control</h1>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Input type="password" autoFocus placeholder="Access password"
            value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button type="submit" disabled={busy || !pw} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

type Stats = Awaited<ReturnType<typeof adminStats>>;
type UserRow = { id: string; email: string | null; createdAt: string; lastSignIn: string | null };

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const getStats = useServerFn(adminStats);
  const listUsers = useServerFn(adminListUsers);
  const delUser = useServerFn(adminDeleteUser);
  const setPurge = useServerFn(adminSetAutoPurge);
  const logout = useServerFn(adminLogout);

  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([getStats(), listUsers()]);
      setStats(s); setUsers(u.users);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }, [getStats, listUsers]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = async (id: string, email: string | null) => {
    if (!confirm(`Permanently delete user ${email ?? id}? This cannot be undone.`)) return;
    try { await delUser({ data: { userId: id } }); toast.success("User deleted"); refresh(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const togglePurge = async (enabled: boolean) => {
    try {
      const next = await setPurge({ data: { enabled } });
      setStats((p) => (p ? { ...p, settings: next } : p));
      toast.success(enabled ? "Auto-purge enabled (3 days)" : "Auto-purge disabled");
    } catch (e) { toast.error((e as Error).message); }
  };

  const doLogout = async () => { await logout(); onLogout(); };

  const pct = stats ? Math.min(100, (stats.storage.usedBytes / stats.storage.quotaBytes) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-electric" />
          <h1 className="font-semibold">GX Control</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={doLogout}>
          <LogOut className="me-2 h-4 w-4" />Logout
        </Button>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        {loading && !stats ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview"><Database className="me-2 h-4 w-4" />Overview</TabsTrigger>
              <TabsTrigger value="users"><Users className="me-2 h-4 w-4" />Users</TabsTrigger>
              <TabsTrigger value="controls"><Cog className="me-2 h-4 w-4" />Controls</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 grid gap-4 md:grid-cols-3">
              <Card className="p-4">
                <div className="text-xs uppercase text-muted-foreground">Users</div>
                <div className="mt-1 text-3xl font-semibold">{stats?.users ?? 0}</div>
              </Card>
              <Card className="p-4 md:col-span-2">
                <div className="text-xs uppercase text-muted-foreground">Storage</div>
                <div className="mt-1 text-2xl font-semibold">
                  {fmtBytes(stats?.storage.usedBytes ?? 0)}
                  <span className="ms-2 text-sm font-normal text-muted-foreground">
                    of {fmtBytes(stats?.storage.quotaBytes ?? 0)} · {stats?.storage.files ?? 0} files
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-electric transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {fmtBytes(Math.max(0, (stats?.storage.quotaBytes ?? 0) - (stats?.storage.usedBytes ?? 0)))} remaining
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="mt-4">
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="p-3">Email</th><th className="p-3">Created</th><th className="p-3">Last sign-in</th><th className="p-3 text-end">Actions</th></tr>
                  </thead>
                  <tbody>
                    {(users ?? []).map((u) => (
                      <tr key={u.id} className="border-t">
                        <td className="p-3">{u.email ?? <span className="text-muted-foreground">(no email)</span>}</td>
                        <td className="p-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="p-3 text-muted-foreground">{u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString() : "—"}</td>
                        <td className="p-3 text-end">
                          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(u.id, u.email)}>
                            <Trash2 className="me-1 h-3.5 w-3.5" />Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {(users?.length ?? 0) === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No users</td></tr>
                    )}
                  </tbody>
                </table>
              </Card>
              <p className="mt-3 text-xs text-muted-foreground">Chat content is private to each user and never exposed here.</p>
            </TabsContent>

            <TabsContent value="controls" className="mt-4 space-y-4">
              <Card className="flex items-start justify-between gap-4 p-4">
                <div>
                  <div className="font-medium">Auto-delete chat history every 3 days</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    When enabled, all users see a warning banner with a download button. After 3 days from
                    their first message, their local chat history is wiped automatically. When disabled,
                    chat history is kept indefinitely.
                  </div>
                </div>
                <Switch checked={Boolean(stats?.settings.autoPurgeEnabled)} onCheckedChange={togglePurge} />
              </Card>
              <Card className="p-4 text-sm text-muted-foreground">
                Last updated: {stats?.settings.updatedAt ? new Date(stats.settings.updatedAt).toLocaleString() : "—"}
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
