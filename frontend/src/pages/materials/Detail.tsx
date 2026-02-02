import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

export default function MaterialDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const [item, setItem] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await api<{ items: any[] }>(`/api/materials`, { token: token ?? undefined });
        const found = list.items.find(x => x.id === id) ?? null;
        setItem(found);
      } catch (e: any) { setError(e.message || 'Failed to load'); }
    })();
  }, [id, token]);

  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!item) return <div style={{ padding: 16 }}>Загрузка...</div>;
  return (
    <div style={{ padding: 16 }}>
      <h3>{item.title}</h3>
      <div>Тип: {item.type}</div>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{item.content}</pre>
    </div>
  );
}
