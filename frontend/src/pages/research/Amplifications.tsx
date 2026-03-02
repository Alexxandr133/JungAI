import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { UniversalNavbar } from '../../components/UniversalNavbar';

type Amplification = {
  id: string;
  symbol: string;
  title: string;
  content: string;
  category?: string | null;
  tags: string[];
  authorId?: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function AmplificationsPage() {
  const { user, token } = useAuth();

  const [amplifications, setAmplifications] = useState<Amplification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingAmplification, setEditingAmplification] = useState<Amplification | null>(null);

  // Форма для создания/редактирования
  const [formData, setFormData] = useState({
    symbol: '',
    title: '',
    content: '',
    category: '',
    tags: [] as string[],
    isPublic: true
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    loadAmplifications();
  }, [token]);

  async function loadAmplifications() {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ items: Amplification[] }>('/api/amplifications', { token });
      setAmplifications(res.items || []);
    } catch (e: any) {
      setError(e.message || 'Не удалось загрузить амплификации');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !formData.symbol.trim() || !formData.title.trim() || !formData.content.trim()) return;

    try {
      if (editingAmplification) {
        await api(`/api/amplifications/${editingAmplification.id}`, {
          method: 'PUT',
          token,
          body: formData
        });
      } else {
        await api('/api/amplifications', {
          method: 'POST',
          token,
          body: formData
        });
      }
      setShowModal(false);
      setEditingAmplification(null);
      setFormData({ symbol: '', title: '', content: '', category: '', tags: [], isPublic: true });
      setTagInput('');
      await loadAmplifications();
    } catch (e: any) {
      setError(e.message || 'Не удалось сохранить амплификацию');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Удалить эту амплификацию?')) return;
    if (!token) return;

    try {
      await api(`/api/amplifications/${id}`, {
        method: 'DELETE',
        token
      });
      await loadAmplifications();
    } catch (e: any) {
      setError(e.message || 'Не удалось удалить амплификацию');
    }
  }

  function openEditModal(amp: Amplification) {
    setEditingAmplification(amp);
    setFormData({
      symbol: amp.symbol,
      title: amp.title,
      content: amp.content,
      category: amp.category || '',
      tags: Array.isArray(amp.tags) ? amp.tags : [],
      isPublic: amp.isPublic
    });
    setShowModal(true);
  }

  function openCreateModal() {
    setEditingAmplification(null);
    setFormData({ symbol: '', title: '', content: '', category: '', tags: [], isPublic: true });
    setTagInput('');
    setShowModal(true);
  }

  function addTag() {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  }

  function removeTag(tag: string) {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  }

  // Фильтрация
  const categories = Array.from(new Set(amplifications.map(a => a.category).filter(Boolean))) as string[];
  const filtered = amplifications.filter(amp => {
    const matchesSearch = !searchQuery || 
      amp.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      amp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      amp.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (Array.isArray(amp.tags) && amp.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesCategory = selectedCategory === 'all' || amp.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const canEdit = (amp: Amplification) => {
    return user?.role === 'admin' || amp.authorId === user?.id;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UniversalNavbar />
      <main
        style={{
          flex: 1,
          padding: '24px clamp(16px, 5vw, 48px)',
          maxWidth: '100%',
          overflowX: 'hidden'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Сборник амплификаций</h1>
            <div className="small" style={{ color: 'var(--text-muted)' }}>Символы, архетипы, мифы и их интерпретации</div>
          </div>
          {(user?.role === 'psychologist' || user?.role === 'admin') && (
            <button className="button" onClick={openCreateModal} style={{ padding: '8px 16px', fontSize: 14 }}>+ Добавить амплификацию</button>
          )}
        </div>

        {/* Фильтры */}
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 12, top: 10, opacity: .7 }}>🔎</span>
            <input
              style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
              placeholder="Поиск по символу, названию, содержанию..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            <option value="all">Все категории</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 10, color: '#ff7b7b' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ marginTop: 24, textAlign: 'center', padding: 24 }}>
            <div className="small" style={{ opacity: 0.7 }}>Загрузка амплификаций...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ marginTop: 24, padding: 24, background: 'var(--surface-2)', borderRadius: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Амплификации не найдены</div>
            <div style={{ color: 'var(--text-muted)' }}>
              {searchQuery || selectedCategory !== 'all' 
                ? 'Попробуйте изменить фильтры поиска'
                : 'Начните создавать амплификации для работы с символами и архетипами'}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            {filtered.map(amp => (
              <div key={amp.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ fontSize: 32 }}>🔮</div>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{amp.title}</div>
                        <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 16 }}>Символ: {amp.symbol}</div>
                      </div>
                    </div>
                    {amp.category && (
                      <div style={{ display: 'inline-block', padding: '4px 10px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
                        {amp.category}
                      </div>
                    )}
                    {Array.isArray(amp.tags) && amp.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {amp.tags.map((tag, idx) => (
                          <span key={idx} style={{ padding: '2px 8px', background: 'var(--surface-2)', borderRadius: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                      {amp.content.length > 300 ? (
                        <>
                          {amp.content.substring(0, 300)}...
                          <button
                            className="button secondary"
                            onClick={() => {
                              const full = document.getElementById(`amp-${amp.id}`);
                              if (full) {
                                full.style.display = full.style.display === 'none' ? 'block' : 'none';
                              }
                            }}
                            style={{ padding: '4px 8px', fontSize: 12, marginLeft: 8 }}
                          >
                            Показать полностью
                          </button>
                          <div id={`amp-${amp.id}`} style={{ display: 'none', marginTop: 8 }}>
                            {amp.content.substring(300)}
                          </div>
                        </>
                      ) : (
                        amp.content
                      )}
                    </div>
                  </div>
                  {(user?.role === 'psychologist' || user?.role === 'admin') && canEdit(amp) && (
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        className="button secondary"
                        onClick={() => openEditModal(amp)}
                        style={{ padding: '6px 12px', fontSize: 13 }}
                      >
                        Редактировать
                      </button>
                      <button
                        className="button secondary"
                        onClick={() => handleDelete(amp.id)}
                        style={{ padding: '6px 12px', fontSize: 13, color: '#ff7b7b' }}
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="small" style={{ color: 'var(--text-muted)' }}>
                    {amp.isPublic ? '🌐 Публичная' : '🔒 Личная'} · {new Date(amp.createdAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Модальное окно создания/редактирования */}
        {showModal && (
          <div
            onClick={() => { setShowModal(false); setEditingAmplification(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', padding: 12, zIndex: 50 }}
          >
            <div
              className="card"
              onClick={e => e.stopPropagation()}
              style={{ width: 'min(800px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: 20 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>{editingAmplification ? 'Редактировать амплификацию' : 'Новая амплификация'}</h3>
                <button
                  className="button secondary"
                  onClick={() => { setShowModal(false); setEditingAmplification(null); }}
                  style={{ padding: '6px 10px', fontSize: 13 }}
                >
                  Закрыть
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Символ *</label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                    placeholder="Например: змея, вода, лес, дракон"
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Заголовок *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Краткое название амплификации"
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Содержимое *</label>
                  <textarea
                    value={formData.content}
                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Интерпретация символа, мифы, архетипические значения, культурный контекст..."
                    required
                    rows={10}
                    style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Категория</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Например: архетип, миф, символ, животное, стихия"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Теги</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyPress={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      placeholder="Добавить тег и нажать Enter"
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)' }}
                    />
                    <button type="button" className="button secondary" onClick={addTag} style={{ padding: '8px 14px' }}>Добавить</button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {formData.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 13 }}
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1 }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={e => setFormData({ ...formData, isPublic: e.target.checked })}
                    />
                    <span>Публичная амплификация (видна всем психологам)</span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => { setShowModal(false); setEditingAmplification(null); }}
                    style={{ padding: '10px 16px' }}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="button"
                    style={{ padding: '10px 16px' }}
                  >
                    {editingAmplification ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

