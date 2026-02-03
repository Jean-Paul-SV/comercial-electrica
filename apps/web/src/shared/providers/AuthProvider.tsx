'use client';

import { decodeJwtClaims, isJwtExpired } from '@shared/auth/jwt';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe } from '@features/auth/api';

const TOKEN_KEY = 'ce_access_token';

export type AuthState = {
  token: string | null;
  user: { id: string; email: string; role: 'ADMIN' | 'USER' } | null;
  permissions: string[];
  /** Módulos habilitados para el tenant (SaaS). Si vacío/undefined, no se filtra nav por módulo. */
  enabledModules: string[];
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
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [user, setUser] = useState<{ id: string; email: string; role: 'ADMIN' | 'USER' } | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getMe(token);
      setUser(res.user);
      setPermissions(res.permissions ?? []);
      setEnabledModules(res.tenant?.enabledModules ?? []);
    } catch {
      setUser(null);
      setPermissions([]);
      setEnabledModules([]);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setPermissions([]);
      setEnabledModules([]);
      return;
    }
    const claims = decodeJwtClaims(token);
    const id = claims?.sub;
    const email = claims?.email;
    const role = claims?.role;
    if (!id || !email || !role) {
      setUser(null);
      setPermissions([]);
      setEnabledModules([]);
      return;
    }
    setUser({ id, email, role });
    getMe(token)
      .then((res) => {
        setUser(res.user);
        setPermissions(res.permissions ?? []);
        setEnabledModules(res.tenant?.enabledModules ?? []);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setPermissions([]);
        setEnabledModules([]);
      });
  }, [token]);

  const value = useMemo<AuthState>(() => {
    return {
      token,
      user,
      permissions,
      enabledModules,
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
        setMustChangePassword(false);
      },
      clearMustChangePassword: () => setMustChangePassword(false),
      refreshMe,
    };
  }, [token, user, permissions, enabledModules, mustChangePassword, refreshMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

