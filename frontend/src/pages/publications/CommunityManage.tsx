import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  ownerId: string;
};

export default function CommunityManage() {
  const { id = '' } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const community = useMemo(() => communities.find((x) => x.id === id) || null, [communities, id]);
  const canManage = !!community && (community.ownerId === user?.id || user?.role === 'admin');

  useEffect(() => {
    if (!token) return;
    api<{ items: Community[] }>('/api/communities', { token })
      .then((res) => setCommunities(res.items || []))
      .catch((e: any) => setError(e?.message || 'Не удалось загрузить сообщество'));
  }, [token]);

  useEffect(() => {
    if (!community) return;
    setName(community.name || '');
    setSlug(community.slug || '');
    setDescription(community.description || '');
    setAvatarUrl(community.avatarUrl || '');
    setCoverUrl(community.coverUrl || '');
  }, [community]);

  async function save() {
    if (!token || !community) return;
    setSaving(true);
    setError('');
    try {
      await api(`/api/communities/${community.id}`, {
        method: 'PATCH',
        token,
        body: { name, slug, description, avatarUrl: avatarUrl || null, coverUrl: coverUrl || null }
      });
      navigate(`/publications/community/${slug}`);
    } catch (e: any) {
      setError(e?.message || 'Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UniversalNavbar />
      <main style={{ padding: '24px clamp(16px, 4vw, 42px)', flex: 1 }}>
        <div className="card" style={{ padding: 18, maxWidth: 820, marginInline: 'auto' }}>
          <h1 style={{ marginTop: 0 }}>Управление сообществом</h1>
          {!community && !error && <div className="small">Загрузка...</div>}
          {error && <div style={{ color: '#ef4444', marginBottom: 10 }}>{error}</div>}
          {community && !canManage && (
            <div>
              <div style={{ marginBottom: 10 }}>У вас нет прав на редактирование этого сообщества.</div>
              <Link to="/publications" className="button secondary">В ленту</Link>
            </div>
          )}
          {community && canManage && (
            <div style={{ display: 'grid', gap: 10 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Описание" />
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="URL аватара (опционально)" />
              <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="URL обложки (опционально)" />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <Link className="button secondary" to={`/publications/community/${community.slug}`}>Отмена</Link>
                <button className="button" disabled={saving} onClick={save}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
