import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const m = await import("@/lib/astra-admin-impl.server");
    return m.doLogin(data.password);
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const m = await import("@/lib/astra-admin-impl.server");
  return m.doLogout();
});

export const adminCheck = createServerFn({ method: "GET" }).handler(async () => {
  const m = await import("@/lib/astra-admin-impl.server");
  return { ok: m.isAuthed() };
});

export const adminStats = createServerFn({ method: "GET" }).handler(async () => {
  const m = await import("@/lib/astra-admin-impl.server");
  return m.getStats();
});

export const adminListUsers = createServerFn({ method: "GET" }).handler(async () => {
  const m = await import("@/lib/astra-admin-impl.server");
  return m.listUsers();
});

export const adminDeleteUser = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const m = await import("@/lib/astra-admin-impl.server");
    return m.deleteUser(data.userId);
  });

export const adminSetAutoPurge = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const m = await import("@/lib/astra-admin-impl.server");
    return m.setAutoPurge(data.enabled);
  });
