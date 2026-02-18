'use client';

import { decodeJwtClaims, isJwtExpired } from '@shared/auth/jwt';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe } from '@features/auth/api';

const TOKEN_KEY = 'ce_access_token';

/** Email del admin de plataforma; si coincide, se trata como isPlatformAdmin aunque la API no lo indique. */
const PLATFORM_ADMIN_EMAIL = 'platform@proveedor.local';

export type AuthState = {
  token: string | null;
  /** False hasta que se lee localStorage en el cliente; evita hidratación #418 y redirección prematura. */
  hasCheckedStorage: boolean;
  /** True cuando hay token pero aún no se ha cargado el user (getMe); evita redirigir a login al refrescar. */
  isRestoringSession: boolean;
  /** Momento en que expira la sesión (exp del JWT) o null si no se puede determinar. */
  sessionExpiresAt: Date | null;
  /** Segundos aproximados restantes antes de que expire el JWT (se actualiza cada minuto). */
  sessionRemainingSeconds: number | null;
  user: { id: string; email: string; role: 'ADMIN' | 'USER'; profilePictureUrl?: string | null } | null;
  permissions: string[];
  /** Módulos habilitados para el tenant (SaaS). Si vacío/undefined, no se filtra nav por módulo. */
  enabledModules: string[];
  /** true cuando el usuario no pertenece a ningún tenant (acceso al panel del proveedor). */
  isPlatformAdmin: boolean;
  /** Si true, el usuario debe cambiar la contraseña (ej. temporal). */
  mustChangePassword: boolean;
  isAuthenticated: boolean;
  login: (token: string, mustChangePassword?: boolean) => void;
  logout: () => void;
  clearMustChangePassword: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(TOKEN_KEY);
  if (!stored || isJwtExpired(stored)) {
    if (stored) localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return stored;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; role: 'ADMIN' | 'USER'; profilePictureUrl?: string | null } | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const [sessionRemainingSeconds, setSessionRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    const stored = readStoredToken();
    if (stored) setToken(stored);
    setHasCheckedStorage(true);
  }, []);

  useEffect(() => {
    if (!token) {
      setSessionExpiresAt(null);
      setSessionRemainingSeconds(null);
      return;
    }
    const claims = decodeJwtClaims(token);
    if (claims?.exp) {
      const expiresAt = new Date(claims.exp * 1000);
      setSessionExpiresAt(expiresAt);
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setSessionRemainingSeconds(Number.isFinite(remaining) ? remaining : null);
    } else {
      setSessionExpiresAt(null);
      setSessionRemainingSeconds(null);
    }
  }, [token]);

  useEffect(() => {
    if (!sessionExpiresAt) return;
    const updateRemaining = () => {
      const remaining = Math.floor((sessionExpiresAt.getTime() - Date.now()) / 1000);
      setSessionRemainingSeconds(remaining > 0 && Number.isFinite(remaining) ? remaining : 0);
    };
    updateRemaining();
    const id = setInterval(updateRemaining, 60_000);
    return () => clearInterval(id);
  }, [sessionExpiresAt]);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getMe(token);
      setUser(res.user);
      setPermissions(res.permissions ?? []);
      setEnabledModules(res.tenant?.enabledModules ?? []);
      setIsPlatformAdmin(Boolean(res.isPlatformAdmin || res.user?.email === PLATFORM_ADMIN_EMAIL));
    } catch {
      setUser(null);
      setPermissions([]);
      setEnabledModules([]);
      setIsPlatformAdmin(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setPermissions([]);
      setEnabledModules([]);
      setIsPlatformAdmin(false);
      setSessionExpiresAt(null);
      setSessionRemainingSeconds(null);
      return;
    }
    const claims = decodeJwtClaims(token);
    const id = claims?.sub;
    const role = claims?.role;
    // La API no incluye email en el JWT por seguridad; getMe() lo rellenará.
    if (!id || !role) {
      setUser(null);
      setPermissions([]);
      setEnabledModules([]);
      return;
    }
    const emailFromToken = claims?.email ?? '';
    setUser({ id, email: emailFromToken, role });
    setIsPlatformAdmin(Boolean(claims?.isPlatformAdmin || emailFromToken === PLATFORM_ADMIN_EMAIL));
    getMe(token)
      .then((res) => {
        setUser(res.user);
        setPermissions(res.permissions ?? []);
        setEnabledModules(res.tenant?.enabledModules ?? []);
        setIsPlatformAdmin(Boolean(res.isPlatformAdmin || res.user?.email === PLATFORM_ADMIN_EMAIL));
      })
      .catch((err: { status?: number }) => {
        // Solo cerrar sesión si el servidor responde 401 (token inválido/expirado).
        // Errores de red o 5xx no deben sacar al usuario.
        if (err?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
          setPermissions([]);
          setEnabledModules([]);
          setIsPlatformAdmin(false);
        } else {
          setPermissions([]);
          setEnabledModules([]);
        }
      });
  }, [token]);

  const value = useMemo<AuthState>(() => {
    const isRestoringSession = Boolean(token && !user);
    return {
      token,
      hasCheckedStorage,
      isRestoringSession,
      sessionExpiresAt,
      sessionRemainingSeconds,
      user,
      permissions,
      enabledModules,
      isPlatformAdmin,
      mustChangePassword,
      isAuthenticated: Boolean(token && user),
      login: (newToken: string, mustChange = false) => {
        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        setMustChangePassword(mustChange);
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setPermissions([]);
        setEnabledModules([]);
        setIsPlatformAdmin(false);
        setMustChangePassword(false);
        setSessionExpiresAt(null);
        setSessionRemainingSeconds(null);
      },
      clearMustChangePassword: () => setMustChangePassword(false),
      refreshMe,
    };
  }, [
    token,
    hasCheckedStorage,
    user,
    permissions,
    enabledModules,
    isPlatformAdmin,
    mustChangePassword,
    sessionExpiresAt,
    sessionRemainingSeconds,
    refreshMe,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

