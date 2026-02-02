import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export default function ClientDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [date, setDate] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const s = await api<{ items: any[] }>(`/api/clients/${id}/sessions`, { token: token ?? undefined });
      const n = await api<{ items: any[] }>(`/api/clients/${id}/notes`, { token: token ?? undefined });
      setSessions(s.items);
      setNotes(n.items);
    } catch (e: any) { setError(e.message || 'Failed to load'); }
  }

  useEffect(() => { if (id) load(); }, [id, token]);

  async function addSession(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      await api(`/api/clients/${id}/sessions`, { method: 'POST', token: token ?? undefined, body: { date, summary, videoUrl } });
      setDate(''); setSummary(''); setVideoUrl('');
      await load();
    } catch (e: any) { setError(e.message || 'Failed to create'); }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      await api(`/api/clients/${id}/notes`, { method: 'POST', token: token ?? undefined, body: { content: noteContent } });
      setNoteContent('');
      await load();
    } catch (e: any) { setError(e.message || 'Failed to create'); }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>Клиент</h3>
      {error && <div style={{ color: 'red' }}>{error}</div>}

      <section style={{ marginTop: 8 }}>
        <h4>Сессии</h4>
        <ul>
          {sessions.map(s => (
            <li key={s.id}>{new Date(s.date).toLocaleString()} — {s.summary} {s.videoUrl ? `(видео: ${s.videoUrl})` : ''}</li>
          ))}
        </ul>
        <form onSubmit={addSession} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
          <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} required />
          <input placeholder="Краткое резюме" value={summary} onChange={e => setSummary(e.target.value)} />
          <input placeholder="Ссылка на видео" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
          <button type="submit">Добавить сессию</button>
        </form>
      </section>

      <section style={{ marginTop: 16 }}>
        <h4>Заметки</h4>
        <ul>
          {notes.map(n => (
            <li key={n.id}>{new Date(n.createdAt).toLocaleString()} — {n.content}</li>
          ))}
        </ul>
        <form onSubmit={addNote} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
          <textarea placeholder="Заметка" value={noteContent} onChange={e => setNoteContent(e.target.value)} required />
          <button type="submit">Добавить заметку</button>
        </form>
      </section>
    </div>
  );
}
