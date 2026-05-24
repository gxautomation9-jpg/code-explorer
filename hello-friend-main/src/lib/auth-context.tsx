import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AnonUser = { id: string; email: string };
type AuthCtx = {
  user: AnonUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ user: null, loading: false, signOut: async () => {} });

const KEY = "astra:anon-id";

function genId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AnonUser | null>(null);

  useEffect(() => {
    let id = sessionStorage.getItem(KEY);
    if (!id) { id = genId(); sessionStorage.setItem(KEY, id); }
    setUser({ id, email: "guest@astra.ai" });
  }, []);

  return (
    <Ctx.Provider value={{
      user,
      loading: false,
      signOut: async () => {
        sessionStorage.clear();
        const id = genId();
        sessionStorage.setItem(KEY, id);
        setUser({ id, email: "guest@astra.ai" });
      },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
