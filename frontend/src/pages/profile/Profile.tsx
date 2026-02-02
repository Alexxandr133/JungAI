import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ProfilePage() {
  const { token, user } = useAuth();
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState('');
  const [interests, setInterests] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/me/profile', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const p = await res.json();
          setName(p?.name ?? '');
          setAge(p?.age ?? '');
          setGender(p?.gender ?? '');
          const ints = Array.isArray(p?.interests) ? p.interests.join(', ') : '';
          setInterests(ints);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load profile');
      }
    })();
  }, [token]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setStatus(null); setError(null);
    try {
      const payload = { name, age: age === '' ? null : Number(age), gender, interests: interests.trim() ? interests.split(',').map(s => s.trim()) : [] };
      const res = await fetch('/api/me/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      setStatus('Сохранено');
    } catch (e: any) { setError(e.message || 'Failed to save'); }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>Профиль</h3>
      <div style={{ marginBottom: 12 }}>Почта: <b>{user?.email}</b>, роль: <b>{user?.role}</b></div>
      {status && <div style={{ color: 'green' }}>{status}</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={save} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <input placeholder="Имя" value={name} onChange={e => setName(e.target.value)} />
        <input type="number" placeholder="Возраст" value={age} onChange={e => setAge(e.target.value === '' ? '' : Number(e.target.value))} />
        <input placeholder="Пол" value={gender} onChange={e => setGender(e.target.value)} />
        <input placeholder="Интересы (через запятую)" value={interests} onChange={e => setInterests(e.target.value)} />
        <button type="submit">Сохранить</button>
      </form>
    </div>
  );
}
