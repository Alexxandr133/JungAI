import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlignCenter, AlignLeft, AlignRight, List, ListOrdered, Redo2, Undo2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { PlatformIcon } from '../../components/icons';
import { PostModal } from './PostModal';

type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  ownerId: string;
};
type Author = { id: string; email: string; role: string; name?: string | null; avatarUrl?: string | null };
type FeedPost = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  authorId: string;
  communityId?: string | null;
  createdAt: string;
  commentsCount: number;
  status?: string;
  authorMode?: string;
  author: Author | null;
  community?: { id: string; slug: string; name: string; avatarUrl?: string | null } | null;
};
const fieldStyle: any = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'var(--surface-2)',
  color: 'var(--text)'
};

function canCreate(role?: string) {
  return role === 'psychologist' || role === 'researcher' || role === 'admin';
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const diffHours = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (diffHours < 1) return 'только что';
  if (diffHours < 24) return `${diffHours} ч назад`;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
}

function sanitizePastedRichHtml(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.body.querySelectorAll('*').forEach((el) => {
      const node = el as HTMLElement;
      node.style.removeProperty('background');
      node.style.removeProperty('background-color');
      node.style.removeProperty('color');
      const style = node.getAttribute('style') || '';
      const cleaned = style
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((rule) => {
          const key = rule.split(':')[0]?.trim().toLowerCase();
          return key !== 'background' && key !== 'background-color' && key !== 'color';
        })
        .join('; ');
      if (cleaned) node.setAttribute('style', cleaned);
      else node.removeAttribute('style');
    });
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

export default function PublicationsPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const isCreator = canCreate(user?.role);

  const [communities, setCommunities] = useState<Community[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDescription, setNewCommunityDescription] = useState('');
  const [newCommunityAvatarUrl, setNewCommunityAvatarUrl] = useState('');
  const [newCommunityCoverUrl, setNewCommunityCoverUrl] = useState('');
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [authorMode, setAuthorMode] = useState<'account' | 'community'>('account');
  const [postCommunityId, setPostCommunityId] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [fontSizePx, setFontSizePx] = useState(16);
  const [textColor, setTextColor] = useState('#1f2937');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  async function loadFeed() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await api<{ posts: FeedPost[]; communities: Community[] }>('/api/publications/me', { token });
      setFeed(res.posts || []);
      setCommunities(res.communities || []);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить ленту');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed().catch(() => undefined);
  }, [token]);

  async function fileToDataUrl(file: File | null): Promise<string> {
    if (!file) return '';
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function createCommunity() {
    if (!token || !isCreator) return;
    if (!newCommunityName.trim() || !newCommunityDescription.trim()) return;
    setPending((s) => ({ ...s, community: true }));
    try {
      await api('/api/communities', {
        method: 'POST',
        token,
        body: {
          name: newCommunityName.trim(),
          description: newCommunityDescription.trim(),
          avatarUrl: newCommunityAvatarUrl.trim() || null,
          coverUrl: newCommunityCoverUrl.trim() || null
        }
      });
      setShowCommunityModal(false);
      setNewCommunityName('');
      setNewCommunityDescription('');
      setNewCommunityAvatarUrl('');
      setNewCommunityCoverUrl('');
      await loadFeed();
    } finally {
      setPending((s) => ({ ...s, community: false }));
    }
  }

  async function createPost() {
    if (!token || !isCreator) return;
    if (!title.trim() || !editorHtml.trim()) return;
    if (authorMode === 'community' && !postCommunityId) return;
    setPending((s) => ({ ...s, post: true }));
    try {
      await api('/api/publications/posts', {
        method: 'POST',
        token,
        body: {
          title: title.trim(),
          content: editorHtml.trim(),
          imageUrl: imageUrl.trim() || null,
          communityId: authorMode === 'community' ? postCommunityId : null,
          authorMode,
          status: 'draft'
        }
      });
      setTitle('');
      setEditorHtml('');
      if (editorRef.current) editorRef.current.innerHTML = '';
      setImageUrl('');
      setAuthorMode('account');
      setPostCommunityId('');
      await loadFeed();
    } finally {
      setPending((s) => ({ ...s, post: false }));
    }
  }

  async function publishPost(postId: string) {
    if (!token) return;
    await api(`/api/publications/posts/${postId}/publish`, { method: 'POST', token });
    await loadFeed();
  }

  async function deletePost(postId: string) {
    if (!token) return;
    if (!window.confirm('Точно удалить публикацию? Это действие нельзя отменить.')) return;
    await api(`/api/publications/posts/${postId}`, { method: 'DELETE', token });
    await loadFeed();
  }

  async function savePost(post: FeedPost) {
    if (!token) return;
    await api(`/api/publications/posts/${post.id}`, {
      method: 'PATCH',
      token,
      body: { title: post.title, content: post.content, imageUrl: post.imageUrl || null }
    });
    setEditingPostId(null);
    await loadFeed();
  }

  function saveSelectionRange() {
    const root = editorRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;
    savedRangeRef.current = range.cloneRange();
  }

  function restoreSelectionRange() {
    const selection = window.getSelection();
    if (!selection || !savedRangeRef.current) return;
    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  }

  function placeCaretAfter(node: Node) {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
  }

  function applyEditorCommand(command: string, value?: string) {
    if (command !== 'undo' && command !== 'redo') {
      editorRef.current?.focus();
      restoreSelectionRange();
    }
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setEditorHtml(editorRef.current.innerHTML);
      saveSelectionRange();
    }
  }

  function applyFontSize(nextPx: number) {
    setFontSizePx(nextPx);
    const root = editorRef.current;
    if (!root) return;
    root.focus();
    restoreSelectionRange();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    if (!root.contains(range.commonAncestorContainer)) return;

    if (range.collapsed) {
      // Если нет выделения, сохраняем стандартное поведение для следующего ввода.
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('fontSize', false, '7');
      root.querySelectorAll('font[size="7"]').forEach((node) => {
        const span = document.createElement('span');
        span.style.fontSize = `${nextPx}px`;
        span.innerHTML = node.innerHTML || '&#8203;';
        node.replaceWith(span);
      });
      saveSelectionRange();
      setEditorHtml(root.innerHTML);
      return;
    }

    const selected = range.extractContents();
    const span = document.createElement('span');
    span.style.fontSize = `${nextPx}px`;
    span.appendChild(selected);
    // Убираем вложенные font-size, чтобы новый размер применялся гарантированно.
    span.querySelectorAll<HTMLElement>('[style*="font-size"]').forEach((el) => {
      el.style.removeProperty('font-size');
      if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
    });
    range.insertNode(span);

    placeCaretAfter(span);
    setEditorHtml(root.innerHTML);
  }

  function applyHeading(tag: 'p' | 'h2' | 'h3' | 'blockquote') {
    applyEditorCommand('formatBlock', tag);
  }

  function applyTextColor(nextColor: string) {
    setTextColor(nextColor);
    applyEditorCommand('foreColor', nextColor);
  }

  function insertLink() {
    const url = window.prompt('Вставьте ссылку (https://...)');
    if (!url) return;
    const normalized = /^(https?:)?\/\//i.test(url) ? url : `https://${url}`;
    applyEditorCommand('createLink', normalized);
  }

  function clearFormatting() {
    applyEditorCommand('removeFormat');
    applyEditorCommand('unlink');
  }

  function handleEditorPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html) {
      document.execCommand('insertHTML', false, sanitizePastedRichHtml(html));
      return;
    }
    document.execCommand('insertText', false, text || '');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UniversalNavbar />
      <main style={{ flex: 1, padding: '24px clamp(16px, 4vw, 42px)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 16 }}>
          <aside className="card" style={{ padding: 16, alignSelf: 'start' }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Мой профиль</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
                {(user?.email || 'U').slice(0, 1).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{user?.email || 'Пользователь'}</div>
                <div className="small" style={{ color: 'var(--text-muted)' }}>{user?.role || 'role'}</div>
              </div>
            </div>

            <div style={{ fontWeight: 800, marginBottom: 12 }}>Мои сообщества</div>
            {isCreator && (
              <div
                onClick={() => setShowCommunityModal(true)}
                style={{
                  border: '1px dashed rgba(124,58,237,0.45)',
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.14), rgba(59,130,246,0.1))',
                  borderRadius: 14,
                  padding: 14,
                  cursor: 'pointer',
                  marginBottom: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <PlatformIcon name="plus" size={15} strokeWidth={2} />
                  Создать сообщество
                </div>
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                  Отдельный блок для создания, не как карточка сообщества
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gap: 10, maxHeight: '65vh', overflowY: 'auto' }}>
              {communities.map((community) => (
                <div
                  key={community.id}
                  onClick={() => navigate(`/publications/community/${community.slug}`)}
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    cursor: 'pointer',
                    background: 'var(--surface-2)'
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, padding: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: 'rgba(255,255,255,0.08)',
                        display: 'grid',
                        placeItems: 'center'
                      }}
                    >
                      {community.avatarUrl ? (
                        <img src={community.avatarUrl} alt={community.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <PlatformIcon name="users" size={16} strokeWidth={2} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{community.name}</div>
                      <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {community.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section>
            <div className="card" style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: 28 }}>Публикации</h1>
                  <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                    Ваши публикации, комментарии и реакции
                  </div>
                </div>
              </div>
            </div>

            {isCreator && (
              <div className="card" style={{ padding: 16, marginBottom: 16, display: 'grid', gap: 10 }}>
                <input style={fieldStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок публикации" />
                <div style={{ display: 'grid', gap: 6 }}>
                  <label className="small">Фото публикации</label>
                  <input
                    type="file"
                    accept="image/*"
                    style={fieldStyle}
                    onChange={async (e) => setImageUrl(await fileToDataUrl(e.target.files?.[0] || null))}
                  />
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  <label className="small">Публиковать от лица</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className={authorMode === 'account' ? 'button' : 'button secondary'} type="button" onClick={() => { setAuthorMode('account'); setPostCommunityId(''); }}>
                      Аккаунта
                    </button>
                    {communities.map((c) => (
                      <button
                        key={c.id}
                        className={authorMode === 'community' && postCommunityId === c.id ? 'button' : 'button secondary'}
                        type="button"
                        onClick={() => { setAuthorMode('community'); setPostCommunityId(c.id); }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    border: '1px solid rgba(148,163,184,0.28)',
                    borderRadius: 12,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                    padding: 10,
                    display: 'grid',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      value={fontSizePx}
                      onChange={(e) => applyFontSize(Number(e.target.value))}
                      style={{ ...fieldStyle, width: 110, padding: '8px 10px', borderRadius: 10 }}
                      title="Размер текста"
                    >
                      {[12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
                        <option key={size} value={size}>{size}px</option>
                      ))}
                    </select>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => applyTextColor(e.target.value)}
                      title="Цвет текста"
                      style={{ width: 40, height: 36, border: 'none', background: 'transparent', cursor: 'pointer' }}
                    />
                    <button className="button secondary" type="button" onClick={() => applyHeading('p')}>P</button>
                    <button className="button secondary" type="button" onClick={() => applyHeading('h2')}>H2</button>
                    <button className="button secondary" type="button" onClick={() => applyHeading('h3')}>H3</button>
                    <button className="button secondary" type="button" onClick={() => applyHeading('blockquote')}>Цитата</button>
                    <button className="button secondary" type="button" onClick={insertLink}>Ссылка</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="button secondary" type="button" onClick={() => applyEditorCommand('bold')}><b>B</b></button>
                    <button className="button secondary" type="button" onClick={() => applyEditorCommand('italic')}><i>I</i></button>
                    <button className="button secondary" type="button" onClick={() => applyEditorCommand('underline')}><u>U</u></button>
                    <button className="button secondary" type="button" onClick={() => applyEditorCommand('strikeThrough')}><s>S</s></button>
                    <button className="button secondary" type="button" onClick={() => applyEditorCommand('insertUnorderedList')} title="Маркированный список" aria-label="Маркированный список">
                      <List size={16} strokeWidth={2} />
                    </button>
                    <button className="button secondary" type="button" onClick={() => applyEditorCommand('insertOrderedList')} title="Нумерованный список" aria-label="Нумерованный список">
                      <ListOrdered size={16} strokeWidth={2} />
                    </button>
                    <button className="button secondary" type="button" onClick={() => applyEditorCommand('justifyLeft')} title="Выровнять по левому краю" aria-label="Выровнять по левому краю">
                      <AlignLeft size={16} strokeWidth={2} />
                    </button>
                    <button className="button secondary" type="button" onClick={() => applyEditorCommand('justifyCenter')} title="Выровнять по центру" aria-label="Выровнять по центру">
                      <AlignCenter size={16} strokeWidth={2} />
                    </button>
                    <button className="button secondary" type="button" onClick={() => applyEditorCommand('justifyRight')} title="Выровнять по правому краю" aria-label="Выровнять по правому краю">
                      <AlignRight size={16} strokeWidth={2} />
                    </button>
                    <button className="button secondary" type="button" onClick={() => applyEditorCommand('undo')} title="Отменить" aria-label="Отменить">
                      <Undo2 size={16} strokeWidth={2} />
                    </button>
                    <button className="button secondary" type="button" onClick={() => applyEditorCommand('redo')} title="Повторить" aria-label="Повторить">
                      <Redo2 size={16} strokeWidth={2} />
                    </button>
                    <button className="button secondary" type="button" onClick={clearFormatting}>Очистить формат</button>
                  </div>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onPaste={handleEditorPaste}
                  onMouseUp={saveSelectionRange}
                  onKeyUp={saveSelectionRange}
                  onInput={(e) => setEditorHtml((e.target as HTMLDivElement).innerHTML)}
                  style={{
                    ...fieldStyle,
                    minHeight: 260,
                    lineHeight: 1.7,
                    direction: 'ltr',
                    textAlign: 'left',
                    unicodeBidi: 'plaintext',
                    border: '1px solid rgba(148,163,184,0.35)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                    padding: '14px 16px'
                  }}
                />
                {!editorHtml.trim() && (
                  <div className="small" style={{ color: 'var(--text-muted)', marginTop: -6 }}>
                    Поделитесь опытом, методикой или кейсом. Пример: начните с H2, добавьте список шагов, выделите ключевые мысли жирным и вставьте ссылку на источник.
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>
                    Публикация создается как черновик
                  </div>
                  <button className="button" disabled={pending.post || !title.trim() || !editorHtml.trim() || (authorMode === 'community' && !postCommunityId)} onClick={createPost}>
                    {pending.post ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </div>
            )}

            {error && <div className="card" style={{ padding: 12, marginBottom: 12, color: '#ef4444' }}>{error}</div>}
            {loading && <div className="small" style={{ color: 'var(--text-muted)' }}>Загрузка ленты...</div>}

            <div style={{ display: 'grid', gap: 12 }}>
              {feed.map((post) => (
                <article
                  key={post.id}
                  className="card"
                  style={{ padding: 16, cursor: 'pointer', overflow: 'hidden' }}
                  onClick={() => setSelectedPostId(post.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, minWidth: 0 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{post.title}</div>
                      <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                        {post.authorMode === 'community' && post.community
                          ? `${post.community.name} (сообщество)`
                          : (post.author?.name || post.author?.email || 'Автор')} • {post.author?.role || 'user'} • {formatDate(post.createdAt)}
                      </div>
                      <div className="small" style={{ color: post.status === 'draft' ? '#f59e0b' : 'var(--text-muted)', marginTop: 4 }}>
                        {post.status === 'draft' ? 'Черновик' : 'Опубликовано'}
                      </div>
                    </div>
                    {post.community?.slug && (
                      <button
                        className="button secondary"
                        style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/publications/community/${post.community?.slug}`);
                        }}
                      >
                        {post.community.name}
                      </button>
                    )}
                  </div>
                  {post.imageUrl && (
                    <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                      <img src={post.imageUrl} alt={post.title} style={{ width: '100%', maxHeight: 340, objectFit: 'cover' }} />
                    </div>
                  )}
                  {editingPostId === post.id ? (
                    <div style={{ display: 'grid', gap: 8, marginBottom: 12 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        style={fieldStyle}
                        value={post.title}
                        onChange={(e) => setFeed((s) => s.map((x) => (x.id === post.id ? { ...x, title: e.target.value } : x)))}
                      />
                      <textarea
                        style={fieldStyle}
                        rows={4}
                        value={post.content}
                        onChange={(e) => setFeed((s) => s.map((x) => (x.id === post.id ? { ...x, content: e.target.value } : x)))}
                      />
                    </div>
                  ) : (
                    <div style={{ lineHeight: 1.6, marginBottom: 12, direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext', maxWidth: '100%', overflowWrap: 'anywhere', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: post.content }} />
                  )}
                  <div className="small" style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <PlatformIcon name="message" size={14} strokeWidth={2} /> {post.commentsCount} комментариев • Открыть статью
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                    {editingPostId === post.id ? (
                      <>
                        <button className="button" onClick={() => savePost(post)}>Сохранить</button>
                        <button className="button secondary" onClick={() => setEditingPostId(null)}>Отмена</button>
                      </>
                    ) : (
                      <>
                        <button className="button secondary" onClick={() => setEditingPostId(post.id)}>Редактировать</button>
                        {post.status === 'draft' && <button className="button" onClick={() => publishPost(post.id)}>Опубликовать</button>}
                        <button className="button secondary" onClick={() => deletePost(post.id)}>Удалить</button>
                      </>
                    )}
                  </div>
                </article>
              ))}
              {!loading && feed.length === 0 && (
                <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Лента пока пустая. Создайте первое сообщество и публикацию.
                </div>
              )}
            </div>
          </section>

        </div>
      </main>

      {showCommunityModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 'min(560px, 95vw)', padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Новое сообщество</div>
            <input style={fieldStyle} value={newCommunityName} onChange={(e) => setNewCommunityName(e.target.value)} placeholder="Название сообщества" />
            <textarea
              style={fieldStyle}
              value={newCommunityDescription}
              onChange={(e) => setNewCommunityDescription(e.target.value)}
              rows={4}
              placeholder="Описание и цель сообщества"
            />
            <div style={{ display: 'grid', gap: 6 }}>
              <label className="small">Аватар сообщества</label>
              <input
                type="file"
                accept="image/*"
                style={fieldStyle}
                onChange={async (e) => setNewCommunityAvatarUrl(await fileToDataUrl(e.target.files?.[0] || null))}
              />
              {newCommunityAvatarUrl && (
                <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 10, background: 'var(--surface-2)' }}>
                  <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>Предпросмотр аватарки</div>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
                    <img src={newCommunityAvatarUrl} alt="avatar-preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label className="small">Обложка сообщества</label>
              <input
                type="file"
                accept="image/*"
                style={fieldStyle}
                onChange={async (e) => setNewCommunityCoverUrl(await fileToDataUrl(e.target.files?.[0] || null))}
              />
              {newCommunityCoverUrl && (
                <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 10, background: 'var(--surface-2)' }}>
                  <div className="small" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>Предпросмотр обложки</div>
                  <div style={{ width: '100%', maxHeight: 160, borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
                    <img src={newCommunityCoverUrl} alt="cover-preview" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="button secondary" onClick={() => setShowCommunityModal(false)}>
                Отмена
              </button>
              <button className="button" disabled={pending.community} onClick={createCommunity}>
                {pending.community ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedPostId && <PostModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />}
    </div>
  );
}

