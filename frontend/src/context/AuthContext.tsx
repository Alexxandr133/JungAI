import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { clearVerificationCache } from '../utils/verification';

type UserRole = 'psychologist' | 'client' | 'researcher' | 'admin' | 'guest';

type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  name?: string | null;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  profile: { avatarUrl?: string | null; name?: string | null } | null;
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

  async function loadProfile() {
    if (!token || !user) return;
    try {
      // Загружаем профиль в зависимости от роли
      if (user.role === 'psychologist' || user.role === 'admin') {
        const profileData = await api<{ avatarUrl?: string | null; name?: string | null }>('/api/psychologist/profile', { token });
        console.log('Profile loaded in context:', profileData);
        setProfile({ avatarUrl: profileData.avatarUrl || null, name: profileData.name || null });
      } else if (user.role === 'client') {
        // Для клиентов используем общий эндпоинт профиля
        const profileData = await api<{ avatarUrl?: string | null; name?: string | null }>('/api/me/profile', { token });
        console.log('Profile loaded in context:', profileData);
        setProfile({ avatarUrl: profileData.avatarUrl || null, name: profileData.name || null });
      }
    } catch (e) {
      // Профиль может не существовать, это нормально
      console.error('Failed to load profile:', e);
    }
  }

  async function refreshProfile() {
    await loadProfile();
  }

  async function loginWithToken(nextToken: string) {
    setToken(nextToken);
    localStorage.setItem('auth_token', nextToken);
    // Запросим /api/auth/me для получения пользователя
    const me = await api<AuthUser>('/api/auth/me', { token: nextToken });
    setUser(me);
    localStorage.setItem('auth_user', JSON.stringify(me));
    // Загружаем профиль после логина
    await loadProfile();
  }

  function logout() {
    setUser(null);
    setToken(null);
    setProfile(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    // Очищаем кэш верификации при выходе
    clearVerificationCache();
  }

  useEffect(() => {
    // Загружаем профиль при монтировании, если есть токен и пользователь
    if (token && user) {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  const value = useMemo(() => ({ token, user, profile, refreshProfile, loginWithToken, setToken, logout }), [token, user, profile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
