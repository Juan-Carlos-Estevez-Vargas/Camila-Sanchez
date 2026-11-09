import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessPolicy } from "@/domain/permissions";
import type { Profile, SessionUser } from "@/domain/types";
import { disablePushOnThisDevice } from "@/services/notifications/browserNotifications";
import { useBackend } from "./BackendContext";

interface AuthState {
  loading: boolean;
  user: SessionUser | null;
  profile: Profile | null;
  policy: AccessPolicy;
  /** ¿Tengo activada la verificación en dos pasos? */
  twoStepEnabled: boolean;
  /**
   * Entró con contraseña o enlace pero falta el código de la app. Mientras
   * tanto `user` es null (la app se comporta como sin sesión) y se muestra la
   * pantalla del código.
   */
  twoStepPending: SessionUser | null;
  refresh(): Promise<void>;
  /** everywhere=true cierra también la sesión en los demás dispositivos. */
  signOut(options?: { everywhere?: boolean }): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [policy, setPolicy] = useState(AccessPolicy.anonymous());
  const [twoStepEnabled, setTwoStepEnabled] = useState(false);
  const [twoStepPending, setTwoStepPending] = useState<SessionUser | null>(null);

  const load = useCallback(async (signedIn: SessionUser | null) => {
    const twoStep = signedIn
      ? await backend.auth.twoStepStatus().catch(() => ({ enabled: false, pending: false }))
      : { enabled: false, pending: false };
    setTwoStepEnabled(twoStep.enabled);
    setTwoStepPending(twoStep.pending ? signedIn : null);
    const sessionUser = twoStep.pending ? null : signedIn;
    setUser(sessionUser);
    if (!sessionUser) {
      setProfile(null);
      setPolicy(AccessPolicy.anonymous());
      setLoading(false);
      return;
    }
    try {
      const [p, permissions] = await Promise.all([
        backend.users.getProfile(sessionUser.id),
        backend.users.myPermissions(),
      ]);
      setProfile(p);
      setPolicy(p?.isActive ? new AccessPolicy(p.role, permissions) : AccessPolicy.anonymous());
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    let active = true;
    void backend.auth.getSession().then((u) => {
      if (active) void load(u);
    });
    const off = backend.auth.onChange((u) => {
      // Diferido: Supabase recomienda no llamar a la API dentro del callback.
      setTimeout(() => active && void load(u), 0);
    });
    return () => {
      active = false;
      off();
    };
  }, [backend, load]);

  const value = useMemo<AuthState>(() => ({
    loading,
    user,
    profile,
    policy,
    twoStepEnabled,
    twoStepPending,
    refresh: () => backend.auth.getSession().then(load),
    signOut: async (options) => {
      // Antes de salir: este dispositivo deja de recibir los avisos de la cuenta.
      await disablePushOnThisDevice(backend.push).catch(() => undefined);
      await backend.auth.signOut(options);
      await load(null);
    },
  }), [backend, load, loading, policy, profile, twoStepEnabled, twoStepPending, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
