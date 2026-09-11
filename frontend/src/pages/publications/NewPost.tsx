import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PublicationComposer } from './PublicationComposer';
import { ImageDropzone } from './ImageDropzone';
import { ThreadCard } from './ThreadCard';
import {
  DEFAULT_FLAIRS,
  canCreateForum,
  canSpeakAsCommunity,
  excerptFromHtml,
  resolvePostType,
  type ForumCommunity,
  type ForumPost
} from './forumUtils';
import { toPersistedImageUrl } from '../../lib/publicationImageUpload';
import './communities.css';

export default function NewPostPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('id');
  const presetCommunity = params.get('community') || '';
  const [communities, setCommunities] = useState<ForumCommunity[]>([]);
  const [title, setTitle] = useState('');
  const [flair, setFlair] = useState('Пост');
  const [communityId, setCommunityId] = useState(presetCommunity);
  const [authorMode, setAuthorMode] = useState<'account' | 'community'>('account');
  const [html, setHtml] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = communities.find((c) => c.id === communityId) || null;
  const canAsCommunity = canSpeakAsCommunity(user?.role, selected?.currentRole);

  useEffect(() => {
    if (!token) return;
    api<{ items: ForumCommunity[] }>('/api/communities', { token })
      .then((res) => {
        const all = res.items || [];
        const mine = all.filter((c) => c.isSubscribed || c.currentRole);
        setCommunities(mine);
        if (presetCommunity && !mine.some((c) => c.id === presetCommunity)) {
          // keep preset only if still subscribed; otherwise clear
          if (!editId) setCommunityId('');
        }
      })
      .catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (!token || !editId) return;
    api<{ item: ForumPost & { content: string; communityId?: string | null } }>(`/api/publications/posts/${editId}`, { token })
      .then((res) => {
        const item = res.item;
        setTitle(item.title || '');
        setHtml(item.content || '');
        setImageUrl(item.imageUrl || '');
        setFlair(resolvePostType(item.flair));
        setCommunityId(item.communityId || item.community?.id || '');
        setAuthorMode(item.authorMode === 'community' ? 'community' : 'account');
        if (item.community && !(item.community as ForumCommunity).currentRole) {
          setCommunities((prev) =>
            prev.some((c) => c.id === item.community!.id)
              ? prev
              : [...prev, { ...(item.community as ForumCommunity), isSubscribed: true }]
          );
        }
      })
      .catch((e: any) => setError(e?.message || 'Не удалось открыть черновик'));
  }, [token, editId]);

  useEffect(() => {
    if (authorMode === 'community' && !canAsCommunity) setAuthorMode('account');
  }, [authorMode, canAsCommunity]);

  async function save(status: 'draft' | 'published') {
    if (!token || !canCreateForum(user?.role)) return;
    if (!title.trim() || !html.trim()) return;
    setSaving(true);
    setError('');
    const body = {
      title: title.trim(),
      content: html.trim(),
      imageUrl: toPersistedImageUrl(imageUrl),
      communityId: communityId || null,
      authorMode: authorMode === 'community' && canAsCommunity ? 'community' : 'account',
      flair: resolvePostType(flair),
      status
    };
    try {
      if (editId) {
        await api(`/api/publications/posts/${editId}`, { method: 'PATCH', token, body });
        if (status === 'published') {
          await api(`/api/publications/posts/${editId}/publish`, { method: 'POST', token });
        }
        navigate(status === 'published' ? `/publications/post/${editId}` : '/communities?scope=mine');
      } else {
        const res = await api<{ item: { id: string } }>('/api/publications/posts', { method: 'POST', token, body });
        navigate(status === 'published' ? `/publications/post/${res.item.id}` : '/communities?scope=mine');
      }
    } catch (e: any) {
      setError(e?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  const previewPost: ForumPost = {
    id: 'preview',
    title: title || 'Без заголовка',
    content: html,
    imageUrl,
    flair,
    createdAt: new Date().toISOString(),
    commentsCount: 0,
    reactionsCount: 0,
    author: { id: user?.id || '', email: user?.email, role: user?.role },
    community: selected
      ? { id: selected.id, slug: selected.slug, name: selected.name, avatarUrl: selected.avatarUrl }
      : null,
    authorMode
  };

  if (!canCreateForum(user?.role)) {
    return (
      <div className="forum">
        <UniversalNavbar />
        <main className="forum__main">Нет доступа к созданию постов.</main>
      </div>
    );
  }

  return (
    <div className="forum">
      <UniversalNavbar />
      <main className="forum__main forum__main--hub">
        <div className="forum__page forum__page--bleed">
          <div className="forum__compose">
            <div className="forum__hub-title-row">
              <div className="forum__hub-title-block">
                <h1 className="forum__h1 forum__h1--hub">{editId ? 'Редактировать пост' : 'Новый пост'}</h1>
                <p className="forum__lead forum__lead--hub">Заголовок, тип, сообщество и текст.</p>
              </div>
              <Link className="forum__new-post" to="/communities">
                Отмена
              </Link>
            </div>
            {error && <div className="forum__error">{error}</div>}
            <div className="forum__segment">
              <button type="button" className={tab === 'edit' ? 'is-active' : ''} onClick={() => setTab('edit')}>
                Редактор
              </button>
              <button type="button" className={tab === 'preview' ? 'is-active' : ''} onClick={() => setTab('preview')}>
                Превью
              </button>
            </div>
            {tab === 'preview' ? (
              <div>
                <ThreadCard post={previewPost} />
                {excerptFromHtml(html) ? null : (
                  <div className="forum__muted" style={{ marginTop: 6 }}>
                    Excerpt появится из текста.
                  </div>
                )}
                {html ? (
                  <div className="forum__body forum__body--wide" style={{ marginTop: 16 }} dangerouslySetInnerHTML={{ __html: html }} />
                ) : null}
              </div>
            ) : (
              <>
                <input className="forum__input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок" />
                <div>
                  <div className="forum__rail-label" style={{ marginBottom: 8 }}>Тип обсуждения</div>
                  <div className="forum__chips">
                    {DEFAULT_FLAIRS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`forum__chip${flair === item ? ' is-active' : ''}`}
                        onClick={() => setFlair(flair === item ? '' : item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="forum__muted">
                  Сообщество
                  <select className="forum__select" value={communityId} onChange={(e) => setCommunityId(e.target.value)}>
                    <option value="">Без сообщества</option>
                    {communities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {communities.length === 0 && (
                  <div className="forum__muted">Подпишитесь на сообщество, чтобы публиковать в нём.</div>
                )}
                <div>
                  <div className="forum__rail-label" style={{ marginBottom: 8 }}>От лица</div>
                  <div className="forum__segment">
                    <button type="button" className={authorMode === 'account' ? 'is-active' : ''} onClick={() => setAuthorMode('account')}>
                      Аккаунт
                    </button>
                    <button
                      type="button"
                      className={authorMode === 'community' ? 'is-active' : ''}
                      disabled={!canAsCommunity}
                      onClick={() => canAsCommunity && setAuthorMode('community')}
                    >
                      Сообщество
                    </button>
                  </div>
                  {!canAsCommunity && communityId && (
                    <div className="forum__muted" style={{ marginTop: 6 }}>
                      От лица сообщества могут писать владелец и модераторы.
                    </div>
                  )}
                </div>
                <ImageDropzone label="Изображение поста" value={imageUrl} onChange={setImageUrl} kind="post" />
                <PublicationComposer html={html} onChange={setHtml} />
              </>
            )}
            <div className="forum__actions">
              <button type="button" className="forum__text-btn forum__text-btn--strong" disabled={saving || !title.trim() || !html.trim()} onClick={() => void save('draft')}>
                Сохранить черновик
              </button>
              <button type="button" className="forum__new-post" disabled={saving || !title.trim() || !html.trim()} onClick={() => void save('published')}>
                Опубликовать
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
