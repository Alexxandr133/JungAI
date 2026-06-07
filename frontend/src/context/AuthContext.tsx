import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { AUTH_SESSION_EXPIRED_EVENT, isUnauthorizedError } from '../utils/authSession';
import { clearVerificationCache } from '../utils/verification';

type UserRole = 'psychologist' | 'client' | 'researcher' | 'admin' | 'guest';

type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  emailVerified?: boolean;
  isVerified?: boolean;
  avatarUrl?: string | null;
  name?: string | null;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  profile: { avatarUrl?: string | null; name?: string | null } | null;
  /** false — идёт первичная проверка /api/auth/me после восстановления сессии */
  authReady: boolean;
  sessionExpired: boolean;
  refreshProfile: () => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  setToken: (token: string | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('auth_user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });
  const [profile, setProfile] = useState<{ avatarUrl?: string | null; name?: string | null } | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [authReady, setAuthReady] = useState<boolean>(() => !localStorage.getItem('auth_token'));

  async function loadProfileFor(authToken: string, authUser: AuthUser) {
    try {
      if (authUser.role === 'psychologist' || authUser.role === 'admin') {
        const profileData = await api<{ avatarUrl?: string | null; name?: string | null }>('/api/psychologist/profile', {
          token: authToken,
        });
        setProfile({ avatarUrl: profileData.avatarUrl || null, name: profileData.name || null });
      } else if (authUser.role === 'client') {
        const profileData = await api<{ avatarUrl?: string | null; name?: string | null }>('/api/me/profile', { token: authToken });
        setProfile({ avatarUrl: profileData.avatarUrl || null, name: profileData.name || null });
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
  }

  async function syncUserFromServer(authToken: string): Promise<AuthUser | null> {
    try {
      const me = await api<AuthUser>('/api/auth/me', { token: authToken });
      setUser(me);
      localStorage.setItem('auth_user', JSON.stringify(me));
      setSessionExpired(false);
      clearVerificationCache();
      return me;
    } catch (e) {
      if (isUnauthorizedError(e)) {
        setSessionExpired(true);
      } else {
        console.warn('[Auth] /api/auth/me failed, keeping cached user:', e);
      }
      return null;
    }
  }

  async function refreshProfile() {
    if (!token || !user) return;
    await loadProfileFor(token, user);
  }

  async function loginWithToken(nextToken: string) {
    setSessionExpired(false);
    setAuthReady(false);
    setToken(nextToken);
    localStorage.setItem('auth_token', nextToken);
    const me = await syncUserFromServer(nextToken);
    if (me) {
      await loadProfileFor(nextToken, me);
    }
    setAuthReady(true);
  }

  function logout() {
    setUser(null);
    setToken(null);
    setProfile(null);
    setSessionExpired(false);
    setAuthReady(true);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    clearVerificationCache();
  }

  useEffect(() => {
    function onSessionExpired() {
      setSessionExpired(true);
    }
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!token) {
        setAuthReady(true);
        return;
      }

      setAuthReady(false);
      const me = await syncUserFromServer(token);
      if (cancelled) return;

      if (me) {
        await loadProfileFor(token, me);
      }
      if (!cancelled) {
        setAuthReady(true);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const value = useMemo(
    () => ({ token, user, profile, authReady, sessionExpired, refreshProfile, loginWithToken, setToken, logout }),
    [token, user, profile, authReady, sessionExpired]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
