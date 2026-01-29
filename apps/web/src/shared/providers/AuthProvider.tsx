'use client';

import { decodeJwtClaims, isJwtExpired } from '@shared/auth/jwt';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

const TOKEN_KEY = 'ce_access_token';

export type AuthState = {
  token: string | null;
  user: { id: string; email: string; role: 'ADMIN' | 'USER' } | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored && !isJwtExpired(stored)) {
      setToken(stored);
    } else if (stored) {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  const user = useMemo(() => {
    if (!token) return null;
    const claims = decodeJwtClaims(token);
    const id = claims?.sub;
    const email = claims?.email;
    const role = claims?.role;
    if (!id || !email || !role) return null;
    return { id, email, role };
  }, [token]);

  const value = useMemo<AuthState>(() => {
    return {
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login: (newToken: string) => {
        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      },
    };
  }, [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

