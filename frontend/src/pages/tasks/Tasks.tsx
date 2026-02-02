import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export default function TasksPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api<{ items: any[] }>('/api/tasks', { token: token ?? undefined });
      setItems(res.items);
    } catch (e: any) { setError(e.message || 'Failed to load'); }
  }

  useEffect(() => { load(); }, [token]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      await api('/api/tasks', { method: 'POST', token: token ?? undefined, body: { title, description, dueAt: dueAt || null } });
      setTitle(''); setDescription(''); setDueAt('');
      await load();
    } catch (e: any) { setError(e.message || 'Failed to create'); }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api(`/api/tasks/${id}`, { method: 'PUT', token: token ?? undefined, body: { status } });
      await load();
    } catch (e: any) { setError(e.message || 'Failed to update'); }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>Задачи</h3>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <ul>
        {items.map(t => (
          <li key={t.id}>
            <b>{t.title}</b> — {t.status}
            <button onClick={() => updateStatus(t.id, 'in_progress')} style={{ marginLeft: 8 }}>В работу</button>
            <button onClick={() => updateStatus(t.id, 'done')} style={{ marginLeft: 4 }}>Готово</button>
          </li>
        ))}
      </ul>

      <section style={{ marginTop: 16 }}>
        <h4>Создать задачу</h4>
        <form onSubmit={createTask} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
          <input placeholder="Заголовок" value={title} onChange={e => setTitle(e.target.value)} required />
          <textarea placeholder="Описание" value={description} onChange={e => setDescription(e.target.value)} />
          <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} />
          <button type="submit">Создать</button>
        </form>
      </section>
    </div>
  );
}
