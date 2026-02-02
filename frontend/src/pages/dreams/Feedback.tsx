import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export default function DreamFeedbackPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      // If unauthenticated, do not call backend; use demo empty list
      if (!token) { setItems([]); return; }
      const res = await api<{ items: any[] }>(`/api/dreams/${id}/feedback`, { token: token ?? undefined });
      setItems(res.items);
    } catch (e: any) { setError(e.message || 'Failed to load'); }
  }

  useEffect(() => { if (id) load(); }, [id, token]);

  async function addFeedback(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      if (!token) { setError('Требуется авторизация'); return; }
      await api(`/api/dreams/${id}/feedback`, { method: 'POST', token: token ?? undefined, body: { content } });
      setContent('');
      await load();
    } catch (e: any) { setError(e.message || 'Failed to create'); }
  }

  const canPost = user?.role === 'psychologist' || user?.role === 'admin';

  return (
    <div style={{ padding: 16 }}>
      <h3>Обратная связь по сну</h3>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <ul>
        {items.map(f => (
          <li key={f.id}>{new Date(f.createdAt).toLocaleString()} — {f.content}</li>
        ))}
      </ul>
      {canPost && (
        <form onSubmit={addFeedback} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
          <textarea placeholder="Комментарий психолога" value={content} onChange={e => setContent(e.target.value)} required />
          <button type="submit">Оставить комментарий</button>
        </form>
      )}
    </div>
  );
}
