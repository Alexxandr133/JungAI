import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export default function DreamCreate() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [symbols, setSymbols] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const symArr = symbols.trim() ? symbols.split(',').map(s => s.trim()) : [];
      if (token) {
        await api('/api/dreams', { method: 'POST', token, body: { title, content, symbols: symArr } });
      } else {
        // Для гостей сохраняем в localStorage
        const guestDreams = JSON.parse(localStorage.getItem('guest_dreams') || '[]');
        const newDream = {
          id: `guest-${Date.now()}`,
          title,
          content,
          symbols: symArr,
          createdAt: new Date().toISOString(),
          isGuest: true
        };
        guestDreams.push(newDream);
        localStorage.setItem('guest_dreams', JSON.stringify(guestDreams));
      }
      navigate('/dreams');
    } catch (e: any) {
      setError(e.message || 'Failed to create');
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>Новая запись сна</h3>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <input placeholder="Заголовок" value={title} onChange={e => setTitle(e.target.value)} required />
        <textarea placeholder="Описание" value={content} onChange={e => setContent(e.target.value)} required />
        <input placeholder="Символы (через запятую)" value={symbols} onChange={e => setSymbols(e.target.value)} />
        <button type="submit">Создать</button>
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </form>
    </div>
  );
}
