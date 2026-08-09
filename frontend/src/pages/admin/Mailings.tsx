import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { AdminNavbar } from '../../components/AdminNavbar';
import { MailHtmlEditor } from '../../components/MailHtmlEditor';
import { renderMailVarsPreview, wrapCampaignEmailPreview } from '../../lib/mailPreview';
import './Mailings.css';

type Tab = 'groups' | 'templates' | 'campaigns';

type MailGroup = { id: string; name: string; description?: string | null; memberCount: number };
type MailMember = { id: string; email: string; source: string; userId?: string | null };
type MailTemplate = { id: string; name: string; subject: string; bodyHtml: string };
type MailCampaign = {
  id: string;
  subject: string;
  status: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  group?: { id: string; name: string };
  createdAt: string;
};
type PlatformUser = { id: string; email: string; role: string };
type CampaignPreview = {
  memberCount: number;
  unsubscribedCount: number;
  deliverableCount: number;
  willSendCount: number;
  capped: boolean;
  maxRecipients: number;
  subject: string;
  previewHtml: string;
  smtpConfigured: boolean;
  _groupId?: string;
};

export default function AdminMailings() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState<Tab>('groups');
  const [error, setError] = useState<string | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [checklist, setChecklist] = useState<Array<{ id: string; label: string; done: boolean | null }>>([]);
  const [testTo, setTestTo] = useState('');
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [groups, setGroups] = useState<MailGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<MailMember[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [manualEmails, setManualEmails] = useState('');
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [platformRole, setPlatformRole] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [platformQ, setPlatformQ] = useState('');

  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<MailTemplate | null>(null);

  const [campaigns, setCampaigns] = useState<MailCampaign[]>([]);
  const [campGroupId, setCampGroupId] = useState('');
  const [campTemplateId, setCampTemplateId] = useState('');
  const [campSubject, setCampSubject] = useState('');
  const [campBody, setCampBody] = useState('');
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!token) return;
    const s = await api<any>('/api/admin/mail/status', { token });
    setSmtpConfigured(Boolean(s.smtpConfigured));
    setChecklist(s.checklist || []);
  }, [token]);

  const loadGroups = useCallback(async () => {
    if (!token) return;
    const res = await api<{ items: MailGroup[] }>('/api/admin/mail/groups', { token });
    setGroups(res.items || []);
  }, [token]);

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    const res = await api<{ items: MailTemplate[] }>('/api/admin/mail/templates', { token });
    setTemplates(res.items || []);
  }, [token]);

  const loadCampaigns = useCallback(async () => {
    if (!token) return;
    const res = await api<{ items: MailCampaign[] }>('/api/admin/mail/campaigns', { token });
    setCampaigns(res.items || []);
  }, [token]);

  const loadMembers = useCallback(
    async (groupId: string) => {
      if (!token) return;
      const res = await api<{ items: MailMember[] }>(`/api/admin/mail/groups/${groupId}/members`, { token });
      setMembers(res.items || []);
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    setError(null);
    Promise.all([loadStatus(), loadGroups(), loadTemplates(), loadCampaigns()]).catch((e: any) =>
      setError(e.message || 'Ошибка загрузки')
    );
  }, [token, loadStatus, loadGroups, loadTemplates, loadCampaigns]);

  useEffect(() => {
    if (selectedGroupId) loadMembers(selectedGroupId).catch(() => {});
  }, [selectedGroupId, loadMembers]);

  useEffect(() => {
    if (tab !== 'campaigns') return;
    const t = setInterval(() => {
      loadCampaigns().catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [tab, loadCampaigns]);

  async function createGroup() {
    if (!token || !newGroupName.trim()) return;
    setBusy(true);
    try {
      const g = await api<MailGroup>('/api/admin/mail/groups', {
        method: 'POST',
        token,
        body: { name: newGroupName.trim() },
      });
      setNewGroupName('');
      await loadGroups();
      setSelectedGroupId(g.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function addManual() {
    if (!token || !selectedGroupId || !manualEmails.trim()) return;
    setBusy(true);
    try {
      await api(`/api/admin/mail/groups/${selectedGroupId}/members/manual`, {
        method: 'POST',
        token,
        body: { emails: manualEmails },
      });
      setManualEmails('');
      await loadMembers(selectedGroupId);
      await loadGroups();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function searchPlatformUsers() {
    if (!token) return;
    const params = new URLSearchParams();
    if (platformRole) params.set('role', platformRole);
    if (platformQ.trim()) params.set('q', platformQ.trim());
    const res = await api<{ items: PlatformUser[] }>(`/api/admin/users?${params.toString()}`, { token });
    setPlatformUsers(res.items || []);
    setSelectedUserIds([]);
  }

  async function addFromPlatform() {
    if (!token || !selectedGroupId) return;
    setBusy(true);
    try {
      await api(`/api/admin/mail/groups/${selectedGroupId}/members/from-platform`, {
        method: 'POST',
        token,
        body: {
          userIds: selectedUserIds.length ? selectedUserIds : undefined,
          role: !selectedUserIds.length && platformRole ? platformRole : undefined,
        },
      });
      await loadMembers(selectedGroupId);
      await loadGroups();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberId: string) {
    if (!token || !selectedGroupId) return;
    await api(`/api/admin/mail/groups/${selectedGroupId}/members/${memberId}`, { method: 'DELETE', token });
    await loadMembers(selectedGroupId);
    await loadGroups();
  }

  async function saveTemplate() {
    if (!token || !editingTemplate) return;
    setBusy(true);
    try {
      if (editingTemplate.id.startsWith('new-')) {
        await api('/api/admin/mail/templates', {
          method: 'POST',
          token,
          body: {
            name: editingTemplate.name,
            subject: editingTemplate.subject,
            bodyHtml: editingTemplate.bodyHtml,
          },
        });
      } else {
        await api(`/api/admin/mail/templates/${editingTemplate.id}`, {
          method: 'PATCH',
          token,
          body: {
            name: editingTemplate.name,
            subject: editingTemplate.subject,
            bodyHtml: editingTemplate.bodyHtml,
          },
        });
      }
      setEditingTemplate(null);
      await loadTemplates();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function applyTemplate(id: string) {
    setCampTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setCampSubject(t.subject);
      setCampBody(t.bodyHtml);
    }
  }

  useEffect(() => {
    if (user?.email && !testTo) setTestTo(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  async function runPreview() {
    if (!token || !campGroupId) {
      setError('Выберите группу для превью');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const p = await api<CampaignPreview>('/api/admin/mail/campaigns/preview', {
        method: 'POST',
        token,
        body: { groupId: campGroupId, subject: campSubject, bodyHtml: campBody },
      });
      setPreview({ ...p, _groupId: campGroupId });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTestEmail() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await api<{ ok: boolean; to: string }>('/api/admin/mail/test-send', {
        method: 'POST',
        token,
        body: {
          to: testTo.trim() || undefined,
          subject: campSubject.trim() || 'Тест рассылки JungAI',
          bodyHtml: campBody.trim() || '<p>Это тестовое письмо из админки JungAI.</p>',
        },
      });
      setOkMsg(`Тест отправлен на ${res.to}`);
    } catch (e: any) {
      setError(e.message || 'Не удалось отправить тест');
    } finally {
      setBusy(false);
    }
  }

  async function startCampaign() {
    if (!token || !campGroupId || !campSubject.trim() || !campBody.trim()) {
      setError('Выберите группу и заполните тему/текст письма');
      return;
    }
    if (!smtpConfigured) {
      setError('SMTP не настроен на этом backend (проверьте backend/.env и перезапуск npm run dev)');
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      let p = preview;
      if (!p || p._groupId !== campGroupId) {
        p = await api<CampaignPreview>('/api/admin/mail/campaigns/preview', {
          method: 'POST',
          token,
          body: { groupId: campGroupId, subject: campSubject, bodyHtml: campBody },
        });
        setPreview({ ...p, _groupId: campGroupId });
      }
      const n = p?.willSendCount ?? 0;
      if (!n) {
        setError('В группе нет получателей. Добавьте email во вкладке «Группы», затем снова нажмите «Отправить».');
        return;
      }
      if (!window.confirm(`Отправить ${n} писем?`)) return;

      await api('/api/admin/mail/campaigns', {
        method: 'POST',
        token,
        body: {
          groupId: campGroupId,
          subject: campSubject.trim(),
          bodyHtml: campBody,
          start: true,
        },
      });
      setOkMsg(`Кампания запущена (${n} в очереди)`);
      setPreview(null);
      await loadCampaigns();
    } catch (e: any) {
      setError(e.message || 'Не удалось запустить кампанию');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AdminNavbar />
      <main className="admin-mailings">
        <h1>Рассылки</h1>
        <p className="admin-mailings__hint">
          Только email через SMTP. Лимит 500 адресатов / кампания, пауза ~2.5 с между письмами, обязательная отписка.
          Не используйте сторонние базы без согласия.
        </p>

        {!smtpConfigured && (
          <div className="admin-mailings__warn">SMTP не настроен — создание черновиков возможно, отправка недоступна.</div>
        )}

        <div className="admin-mailings__checklist">
          <div className="admin-mailings__checklist-title">Чек-лист домена (вручную в DNS)</div>
          <ul>
            {checklist.map((c) => (
              <li key={c.id}>
                <span>{c.done === true ? '✓' : c.done === false ? '✗' : '○'}</span> {c.label}
              </li>
            ))}
          </ul>
        </div>

        {error && <div className="admin-mailings__error">{error}</div>}
        {okMsg && <div className="admin-mailings__ok">{okMsg}</div>}

        <div className="admin-mailings__tabs">
          {(
            [
              ['groups', 'Группы'],
              ['templates', 'Шаблоны'],
              ['campaigns', 'Кампании'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'button' : 'button secondary'}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'groups' && (
          <div className="admin-mailings__grid">
            <section className="card admin-mailings__panel">
              <h2>Группы</h2>
              <div className="admin-mailings__row">
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Название группы"
                />
                <button type="button" className="button" disabled={busy} onClick={createGroup}>
                  Создать
                </button>
              </div>
              <div className="admin-mailings__list">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`admin-mailings__list-item${selectedGroupId === g.id ? ' is-active' : ''}`}
                    onClick={() => setSelectedGroupId(g.id)}
                  >
                    <strong>{g.name}</strong>
                    <span>{g.memberCount} чел.</span>
                  </button>
                ))}
                {!groups.length && <div className="small" style={{ color: 'var(--text-muted)' }}>Пока нет групп</div>}
              </div>
            </section>

            <section className="card admin-mailings__panel">
              <h2>Участники группы</h2>
              {!selectedGroupId ? (
                <div className="small" style={{ color: 'var(--text-muted)' }}>Выберите группу слева</div>
              ) : (
                <>
                  <h3>Добавить вручную</h3>
                  <textarea
                    rows={3}
                    value={manualEmails}
                    onChange={(e) => setManualEmails(e.target.value)}
                    placeholder="email1@..., email2@... (через запятую или с новой строки)"
                  />
                  <button type="button" className="button" disabled={busy} onClick={addManual}>
                    Добавить email
                  </button>

                  <h3 style={{ marginTop: 20 }}>Из пользователей платформы</h3>
                  <div className="admin-mailings__row">
                    <select value={platformRole} onChange={(e) => setPlatformRole(e.target.value)}>
                      <option value="">Все роли</option>
                      <option value="psychologist">psychologist</option>
                      <option value="client">client</option>
                      <option value="researcher">researcher</option>
                      <option value="admin">admin</option>
                    </select>
                    <input
                      value={platformQ}
                      onChange={(e) => setPlatformQ(e.target.value)}
                      placeholder="Поиск email"
                    />
                    <button type="button" className="button secondary" onClick={searchPlatformUsers}>
                      Найти
                    </button>
                  </div>
                  {platformUsers.length > 0 && (
                    <div className="admin-mailings__platform-list">
                      {platformUsers.slice(0, 80).map((u) => (
                        <label key={u.id} className="admin-mailings__platform-item">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u.id)}
                            onChange={(e) =>
                              setSelectedUserIds((prev) =>
                                e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)
                              )
                            }
                          />
                          <span>
                            {u.email} <em>({u.role})</em>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  <button type="button" className="button" disabled={busy} onClick={addFromPlatform} style={{ marginTop: 8 }}>
                    {selectedUserIds.length
                      ? `Добавить выбранных (${selectedUserIds.length})`
                      : platformRole
                        ? `Добавить всех с ролью ${platformRole}`
                        : 'Добавить найденных / по роли'}
                  </button>

                  <h3 style={{ marginTop: 20 }}>Текущий список</h3>
                  <div className="admin-mailings__members">
                    {members.map((m) => (
                      <div key={m.id} className="admin-mailings__member">
                        <span>
                          {m.email} <em>({m.source})</em>
                        </span>
                        <button type="button" className="button secondary" onClick={() => removeMember(m.id)}>
                          Удалить
                        </button>
                      </div>
                    ))}
                    {!members.length && <div className="small" style={{ color: 'var(--text-muted)' }}>Пусто</div>}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {tab === 'templates' && (
          <div className="admin-mailings__grid">
            <section className="card admin-mailings__panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Шаблоны</h2>
                <button
                  type="button"
                  className="button"
                  onClick={() =>
                    setEditingTemplate({
                      id: `new-${Date.now()}`,
                      name: 'Новый шаблон',
                      subject: '',
                      bodyHtml: '<p>Здравствуйте{{#name}}, {{name}}{{/name}}!</p>\n<p></p>\n<p><a href="{{unsubscribeUrl}}">Отписаться</a></p>',
                    })
                  }
                >
                  Новый
                </button>
              </div>
              <div className="admin-mailings__list">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`admin-mailings__list-item${editingTemplate?.id === t.id ? ' is-active' : ''}`}
                    onClick={() => setEditingTemplate({ ...t })}
                  >
                    <strong>{t.name}</strong>
                    <span>{t.subject}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="card admin-mailings__panel">
              <h2>Редактор</h2>
              {!editingTemplate ? (
                <div className="small" style={{ color: 'var(--text-muted)' }}>Выберите шаблон</div>
              ) : (
                <>
                  <label className="small">Название</label>
                  <input
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  />
                  <label className="small">Тема</label>
                  <input
                    value={editingTemplate.subject}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  />
                  <label className="small">Текст письма</label>
                  <MailHtmlEditor
                    value={editingTemplate.bodyHtml}
                    onChange={(html) => setEditingTemplate({ ...editingTemplate, bodyHtml: html })}
                    minHeight={180}
                  />
                  <label className="small" style={{ marginTop: 10 }}>Как увидит получатель</label>
                  <iframe
                    title="template-preview"
                    className="admin-mailings__iframe"
                    srcDoc={wrapCampaignEmailPreview(
                      renderMailVarsPreview(editingTemplate.bodyHtml, { name: 'Иван', email: 'user@example.com' })
                    )}
                  />
                  <button type="button" className="button" disabled={busy} onClick={saveTemplate} style={{ marginTop: 10 }}>
                    Сохранить
                  </button>
                </>
              )}
            </section>
          </div>
        )}

        {tab === 'campaigns' && (
          <div className="admin-mailings__grid">
            <section className="card admin-mailings__panel">
              <h2>Новая кампания</h2>
              <label className="small">Группа</label>
              <select value={campGroupId} onChange={(e) => setCampGroupId(e.target.value)}>
                <option value="">—</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.memberCount})
                  </option>
                ))}
              </select>
              <label className="small">Шаблон</label>
              <select
                value={campTemplateId}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">— свой текст —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <label className="small">Тема</label>
              <input value={campSubject} onChange={(e) => setCampSubject(e.target.value)} />
              <label className="small">Текст письма</label>
              <MailHtmlEditor value={campBody} onChange={setCampBody} minHeight={160} />

              <label className="small" style={{ marginTop: 10 }}>Предпросмотр письма</label>
              <iframe
                title="campaign-live-preview"
                className="admin-mailings__iframe"
                srcDoc={wrapCampaignEmailPreview(
                  renderMailVarsPreview(campBody, {
                    name: 'Тест',
                    email: testTo || user?.email || 'user@example.com',
                  })
                )}
              />

              <div className="admin-mailings__test-box">
                <div className="small" style={{ fontWeight: 700 }}>Тест на один адрес</div>
                <div className="admin-mailings__row">
                  <input
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="ваш@email.com (пусто = email из аккаунта)"
                  />
                  <button type="button" className="button secondary" disabled={busy || !smtpConfigured} onClick={sendTestEmail}>
                    Отправить тест
                  </button>
                </div>
              </div>

              <div className="admin-mailings__row">
                <button type="button" className="button secondary" disabled={busy || !campGroupId} onClick={runPreview}>
                  Проверить группу
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy || !campGroupId || !campSubject.trim() || !campBody.trim() || !smtpConfigured}
                  onClick={startCampaign}
                >
                  Отправить кампанию{preview?.willSendCount ? ` (${preview.willSendCount})` : ''}
                </button>
              </div>
              {!smtpConfigured && (
                <div className="small" style={{ color: '#f59e0b' }}>
                  SMTP на этом backend не виден — проверьте backend/.env и перезапустите сервер.
                </div>
              )}
              {smtpConfigured && campGroupId && (groups.find((g) => g.id === campGroupId)?.memberCount ?? 0) === 0 && (
                <div className="small" style={{ color: '#f59e0b' }}>
                  В выбранной группе 0 участников — сначала добавьте email во вкладке «Группы».
                </div>
              )}
              {preview && (
                <div className="admin-mailings__preview-meta">
                  В группе: {preview.memberCount}, отписались: {preview.unsubscribedCount}, к отправке:{' '}
                  {preview.willSendCount}
                  {preview.capped ? ' (обрезано по лимиту 500)' : ''}
                </div>
              )}
            </section>
            <section className="card admin-mailings__panel">
              <h2>История</h2>
              <div className="admin-mailings__list">
                {campaigns.map((c) => (
                  <div key={c.id} className="admin-mailings__campaign">
                    <strong>{c.subject}</strong>
                    <div className="small">
                      {c.group?.name || '—'} · {c.status} · sent {c.sentCount}/{c.totalCount}
                      {c.failedCount ? ` · fail ${c.failedCount}` : ''}
                      {c.skippedCount ? ` · skip ${c.skippedCount}` : ''}
                    </div>
                  </div>
                ))}
                {!campaigns.length && <div className="small" style={{ color: 'var(--text-muted)' }}>Пока нет кампаний</div>}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
