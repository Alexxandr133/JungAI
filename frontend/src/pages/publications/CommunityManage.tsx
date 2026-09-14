import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { useAuth } from '../../context/AuthContext';
import { api, resolvePublicFileUrl } from '../../lib/api';
import { ImageDropzone } from './ImageDropzone';
import { canManageCommunity, type ForumCommunity } from './forumUtils';
import { toPersistedImageUrl } from '../../lib/publicationImageUpload';
import './communities.css';

type Member = {
  id: string;
  userId: string;
  role: string;
  joinedAt?: string;
  user?: { id: string; name?: string | null; email?: string | null; avatarUrl?: string | null } | null;
};

export default function CommunityManage() {
  const { id = '' } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<ForumCommunity | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [memberBusy, setMemberBusy] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const canManage = canManageCommunity(user?.role, community?.currentRole);
  const isOwner = community?.currentRole === 'owner' || user?.role === 'admin';
  const dirty = useMemo(() => {
    if (!community) return false;
    return (
      name !== (community.name || '') ||
      slug !== (community.slug || '') ||
      description !== (community.description || '') ||
      avatarUrl !== (community.avatarUrl || '') ||
      coverUrl !== (community.coverUrl || '') ||
      isPrivate !== Boolean(community.isPrivate)
    );
  }, [community, name, slug, description, avatarUrl, coverUrl, isPrivate]);

  const pendingMembers = useMemo(() => members.filter((m) => m.role === 'pending'), [members]);
  const activeMembers = useMemo(() => members.filter((m) => m.role !== 'pending'), [members]);

  async function load() {
    if (!token || !id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api<{ community: ForumCommunity; members: Member[] }>(
        `/api/communities/id/${id}`,
        { token }
      );
      setCommunity(res.community);
      setMembers(res.members || []);
      setName(res.community.name || '');
      setSlug(res.community.slug || '');
      setDescription(res.community.description || '');
      setAvatarUrl(toPersistedImageUrl(res.community.avatarUrl) || '');
      setCoverUrl(toPersistedImageUrl(res.community.coverUrl) || '');
      setIsPrivate(Boolean(res.community.isPrivate));
      if (
        (res.community.avatarUrl && String(res.community.avatarUrl).startsWith('data:')) ||
        (res.community.coverUrl && String(res.community.coverUrl).startsWith('data:'))
      ) {
        setError('Старый логотип/обложка в устаревшем формате сброшены — загрузите файлы заново и сохраните.');
      }
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить сообщество');
      setCommunity(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [token, id]);

  async function save() {
    if (!token || !community || !canManage) return;
    setSaving(true);
    setError('');
    try {
      const res = await api<{ item: ForumCommunity }>(`/api/communities/${community.id}`, {
        method: 'PATCH',
        token,
        body: {
          name,
          slug,
          description,
          avatarUrl: toPersistedImageUrl(avatarUrl),
          coverUrl: toPersistedImageUrl(coverUrl),
          isPrivate
        }
      });
      setCommunity((c) => (c ? { ...c, ...res.item, currentRole: c.currentRole, isPrivate: Boolean(res.item.isPrivate ?? isPrivate) } : c));
      navigate(`/publications/community/${res.item.slug || slug}`);
    } catch (e: any) {
      setError(e?.message || 'Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  }

  async function acceptJoin(userId: string) {
    if (!token || !community) return;
    setMemberBusy(userId);
    try {
      await api(`/api/communities/${community.id}/join-requests/${userId}/accept`, {
        method: 'POST',
        token
      });
      setMembers((list) => list.map((m) => (m.userId === userId ? { ...m, role: 'member' } : m)));
    } catch (e: any) {
      setError(e?.message || 'Не удалось принять заявку');
    } finally {
      setMemberBusy('');
    }
  }

  async function rejectJoin(userId: string) {
    if (!token || !community) return;
    setMemberBusy(userId);
    try {
      await api(`/api/communities/${community.id}/join-requests/${userId}/reject`, {
        method: 'POST',
        token
      });
      setMembers((list) => list.filter((m) => m.userId !== userId));
    } catch (e: any) {
      setError(e?.message || 'Не удалось отклонить заявку');
    } finally {
      setMemberBusy('');
    }
  }

  async function setMemberRole(userId: string, role: 'member' | 'moderator') {
    if (!token || !community) return;
    setMemberBusy(userId);
    try {
      await api(`/api/communities/${community.id}/members/${userId}`, {
        method: 'PATCH',
        token,
        body: { role }
      });
      setMembers((list) => list.map((m) => (m.userId === userId ? { ...m, role } : m)));
    } catch (e: any) {
      setError(e?.message || 'Не удалось изменить роль');
    } finally {
      setMemberBusy('');
    }
  }

  async function removeMember(userId: string) {
    if (!token || !community) return;
    if (!window.confirm('Удалить участника из сообщества?')) return;
    setMemberBusy(userId);
    try {
      await api(`/api/communities/${community.id}/members/${userId}`, { method: 'DELETE', token });
      setMembers((list) => list.filter((m) => m.userId !== userId));
    } catch (e: any) {
      setError(e?.message || 'Не удалось удалить участника');
    } finally {
      setMemberBusy('');
    }
  }

  async function deleteCommunity() {
    if (!token || !community || !isOwner) return;
    if (deleteConfirm.trim().toLowerCase() !== 'удалить') {
      setError('Введите «удалить» для подтверждения');
      return;
    }
    setSaving(true);
    try {
      await api(`/api/communities/${community.id}`, { method: 'DELETE', token });
      navigate('/communities');
    } catch (e: any) {
      setError(e?.message || 'Не удалось удалить сообщество');
    } finally {
      setSaving(false);
    }
  }

  const coverSrc = resolvePublicFileUrl(coverUrl) || coverUrl;
  const avatarSrc = resolvePublicFileUrl(avatarUrl) || avatarUrl;

  return (
    <div className={`forum${dirty ? ' forum--manage-dirty' : ''}`}>
      <UniversalNavbar />
      <main className="forum__main forum__main--hub">
        <div className="forum__page forum__page--bleed">
          <div className="forum__manage">
            <div className="forum__hub-title-row">
              <div>
                <p className="forum__muted" style={{ margin: '0 0 4px' }}>
                  Настройки
                </p>
                <h1 className="forum__h1 forum__h1--hub">Управление сообществом</h1>
              </div>
              {community && (
                <Link className="forum__new-post" to={`/publications/community/${community.slug}`}>
                  К сообществу
                </Link>
              )}
            </div>

            {loading && <div className="forum__muted">Загрузка...</div>}
            {error && <div className="forum__error">{error}</div>}
            {!loading && !community && !error && (
              <div className="forum__muted">Сообщество не найдено.</div>
            )}
            {!loading && community && !canManage && (
              <div>
                <p className="forum__muted">У вас нет прав на редактирование этого сообщества.</p>
                <Link to="/communities" className="forum__new-post">
                  К сообществам
                </Link>
              </div>
            )}

            {!loading && community && canManage && (
              <div className="forum__manage-layout">
                <div className="forum__manage-form">
                  <section className="forum__manage-zone">
                    <p className="forum__manage-eyebrow">Это видят участники</p>
                    <h2 className="forum__manage-title">Публичный профиль</h2>
                    <p className="forum__manage-sub">Название, описание и оформление сообщества</p>

                    <div className="forum__manage-section">
                      <h3 className="forum__manage-section-title">Основное</h3>
                      <label className="forum__muted">
                        Название
                        <input className="forum__input" value={name} onChange={(e) => setName(e.target.value)} />
                      </label>
                      <label className="forum__muted">
                        Адрес (slug)
                        <input className="forum__input" value={slug} onChange={(e) => setSlug(e.target.value)} />
                      </label>
                      <label className="forum__muted">
                        Описание
                        <textarea
                          className="forum__textarea"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={4}
                        />
                      </label>
                    </div>

                    <div className="forum__manage-section">
                      <h3 className="forum__manage-section-title">Доступ</h3>
                      <label className="forum__manage-check">
                        <input
                          type="checkbox"
                          checked={isPrivate}
                          onChange={(e) => setIsPrivate(e.target.checked)}
                        />
                        <span>
                          <strong>Приватное сообщество</strong>
                          <span className="forum__muted" style={{ display: 'block', marginTop: 4 }}>
                            Посты видят только участники. Новые подписчики отправляют заявку — её нужно принять или отклонить.
                          </span>
                        </span>
                      </label>
                    </div>

                    <div className="forum__manage-section">
                      <h3 className="forum__manage-section-title">Оформление</h3>
                      <ImageDropzone label="Логотип / аватар" value={avatarUrl} onChange={setAvatarUrl} kind="avatar" />
                      <ImageDropzone label="Обложка" value={coverUrl} onChange={setCoverUrl} kind="cover" />
                    </div>
                  </section>

                  <section className="forum__manage-zone forum__manage-zone--account">
                    <p className="forum__manage-eyebrow">Безопасность</p>
                    <h2 className="forum__manage-title">Участники</h2>
                    <p className="forum__manage-sub">Роли, заявки и удаление из сообщества</p>

                    {pendingMembers.length > 0 && (
                      <div className="forum__manage-section">
                        <h3 className="forum__manage-section-title">Заявки ({pendingMembers.length})</h3>
                        <div className="forum__manage-members">
                          {pendingMembers.map((m) => {
                            const label = m.user?.name || m.user?.email || m.userId;
                            const busy = memberBusy === m.userId;
                            return (
                              <div key={m.id} className="forum__manage-member">
                                <div className="forum__manage-member-main">
                                  <span className="forum__avatar">
                                    {resolvePublicFileUrl(m.user?.avatarUrl) ? (
                                      <img src={resolvePublicFileUrl(m.user?.avatarUrl) || ''} alt="" />
                                    ) : (
                                      label.slice(0, 1).toUpperCase()
                                    )}
                                  </span>
                                  <div>
                                    <div className="forum__manage-member-name">{label}</div>
                                    <div className="forum__muted">Ожидает решения</div>
                                  </div>
                                </div>
                                <div className="forum__manage-member-actions">
                                  <button
                                    type="button"
                                    className="forum__new-post"
                                    disabled={busy}
                                    onClick={() => void acceptJoin(m.userId)}
                                  >
                                    Принять
                                  </button>
                                  <button
                                    type="button"
                                    className="forum__text-btn"
                                    disabled={busy}
                                    onClick={() => void rejectJoin(m.userId)}
                                  >
                                    Отклонить
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="forum__manage-members">
                      {activeMembers.map((m) => {
                        const label = m.user?.name || m.user?.email || m.userId;
                        const busy = memberBusy === m.userId;
                        return (
                          <div key={m.id} className="forum__manage-member">
                            <div className="forum__manage-member-main">
                              <span className="forum__avatar">
                                {resolvePublicFileUrl(m.user?.avatarUrl) ? (
                                  <img src={resolvePublicFileUrl(m.user?.avatarUrl) || ''} alt="" />
                                ) : (
                                  label.slice(0, 1).toUpperCase()
                                )}
                              </span>
                              <div>
                                <div className="forum__manage-member-name">{label}</div>
                                <div className="forum__muted">
                                  {m.role === 'owner'
                                    ? 'Владелец'
                                    : m.role === 'moderator'
                                      ? 'Модератор'
                                      : 'Участник'}
                                </div>
                              </div>
                            </div>
                            <div className="forum__manage-member-actions">
                              {isOwner && m.role === 'member' && (
                                <button
                                  type="button"
                                  className="forum__text-btn"
                                  disabled={busy}
                                  onClick={() => void setMemberRole(m.userId, 'moderator')}
                                >
                                  Сделать модератором
                                </button>
                              )}
                              {isOwner && m.role === 'moderator' && (
                                <button
                                  type="button"
                                  className="forum__text-btn"
                                  disabled={busy}
                                  onClick={() => void setMemberRole(m.userId, 'member')}
                                >
                                  Снять модератора
                                </button>
                              )}
                              {m.role !== 'owner' && (isOwner || m.role === 'member') && (
                                <button
                                  type="button"
                                  className="forum__text-btn forum__text-btn--danger"
                                  disabled={busy}
                                  onClick={() => void removeMember(m.userId)}
                                >
                                  Удалить
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {isOwner && (
                    <section className="forum__manage-zone forum__manage-zone--danger">
                      <p className="forum__manage-eyebrow">DELETE</p>
                      <h2 className="forum__manage-title">Удаление сообщества</h2>
                      <p className="forum__manage-sub">
                        Удалятся все посты, ответы и участники. Введите «удалить» для подтверждения.
                      </p>
                      <input
                        className="forum__input"
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder="удалить"
                      />
                      <button
                        type="button"
                        className="forum__danger-btn"
                        disabled={saving}
                        onClick={() => void deleteCommunity()}
                      >
                        Удалить сообщество навсегда
                      </button>
                    </section>
                  )}
                </div>

                <aside className="forum__manage-preview">
                  <p className="forum__manage-eyebrow">Превью</p>
                  <div className="forum__manage-card">
                    <div className="forum__manage-card-cover">
                      {coverSrc ? <img src={coverSrc} alt="" /> : <div className="forum__manage-card-cover-empty" />}
                    </div>
                    <div className="forum__manage-card-body">
                      <span className="forum__avatar forum__avatar-lg">
                        {avatarSrc ? <img src={avatarSrc} alt="" /> : (name || 'С').slice(0, 1).toUpperCase()}
                      </span>
                      <h3>{name || 'Без названия'}</h3>
                      <p>{description || 'Описание появится здесь'}</p>
                      <div className="forum__muted">/{slug || 'slug'}</div>
                      {isPrivate ? <div className="forum__muted">Приватное</div> : null}
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>

        {dirty && canManage && (
          <div className="forum__manage-bar">
            <span>Есть несохранённые изменения</span>
            <div className="forum__actions">
              <button type="button" className="forum__text-btn" onClick={() => void load()} disabled={saving}>
                Сбросить
              </button>
              <button type="button" className="forum__new-post" disabled={saving} onClick={() => void save()}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
