import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ClientNavbar } from '../../components/ClientNavbar';

const MOOD_TAG_OPTIONS = ['спокойствие', 'тревога', 'усталость', 'надежда', 'радость', 'злость', 'грусть', 'интерес'] as const;

type JournalEntry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  content: string;
  moodTag?: string | null;
};

export default function ClientJournal() {
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const prefillConsumed = useRef(false);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editorMoodTag, setEditorMoodTag] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEntries();
  }, [token]);

  useEffect(() => {
    const prefill = (location.state as { prefill?: string } | null)?.prefill;
    if (!prefill || !token || prefillConsumed.current) return;
    prefillConsumed.current = true;
    setEditorContent(prefill);
    setEditorMoodTag('');
    setSelectedEntry(null);
    setShowEditor(true);
    // Сбрасываем state роутера, иначе закрытие модалки снова откроет её
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, token, navigate]);

  function closeEditor() {
    setShowEditor(false);
    setEditorContent('');
    setEditorMoodTag('');
    setSelectedEntry(null);
  }

  async function loadEntries() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ items: JournalEntry[] }>('/api/journal/entries', { token });
      setEntries(res.items || []);
    } catch (error) {
      console.error('Failed to load journal entries:', error);
      // Fallback to localStorage if API fails
      const saved = localStorage.getItem('client_journal_entries');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setEntries(parsed.map((e: any) => ({
            id: e.id,
            createdAt: e.date,
            updatedAt: e.date,
            content: e.content
          })));
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveEntry() {
    if (!editorContent.trim() || !token) return;
    
    try {
      if (selectedEntry) {
        // Обновляем существующую запись
        const updated = await api<JournalEntry>(`/api/journal/entries/${selectedEntry.id}`, {
          method: 'PUT',
          token,
          body: { content: editorContent.trim(), moodTag: editorMoodTag || null }
        });
        setEntries(entries.map(e => e.id === selectedEntry.id ? updated : e));
      } else {
        const newEntry = await api<JournalEntry>('/api/journal/entries', {
          method: 'POST',
          token,
          body: { content: editorContent.trim(), moodTag: editorMoodTag || null }
        });
        setEntries([newEntry, ...entries]);
      }
      closeEditor();
    } catch (error) {
      console.error('Failed to save journal entry:', error);
      alert('Не удалось сохранить запись. Попробуйте еще раз.');
    }
  }

  function openEditor(entry?: JournalEntry) {
    if (entry) {
      setSelectedEntry(entry);
      setEditorContent(entry.content);
      setEditorMoodTag(entry.moodTag || '');
    } else {
      setSelectedEntry(null);
      setEditorContent('');
      setEditorMoodTag('');
    }
    setShowEditor(true);
  }

  async function deleteEntry(id: string) {
    if (!window.confirm('Удалить эту запись?') || !token) return;
    try {
      await api(`/api/journal/entries/${id}`, {
        method: 'DELETE',
        token
      });
      setEntries(entries.filter(e => e.id !== id));
    } catch (error) {
      console.error('Failed to delete journal entry:', error);
      alert('Не удалось удалить запись. Попробуйте еще раз.');
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientNavbar />
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
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, marginBottom: 8, fontFamily: "'Lora', Georgia, serif" }}>Защищённый дневник</h1>
            <p className="small" style={{ color: 'var(--text-muted)', margin: 0, maxWidth: 420, lineHeight: 1.5 }}>
              Записи шифруются на вашем устройствах и доступны только вам и вашему психологу.
            </p>
          </div>
          <button className="button" onClick={() => openEditor()} style={{ padding: '10px 20px' }}>+ Новая запись</button>
        </div>

        <div style={{ marginTop: 12 }}>
          {loading ? (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div className="small" style={{ color: 'var(--text-muted)' }}>Загрузка...</div>
            </div>
          ) : entries.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📔</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Дневник пуст</div>
              <div className="small" style={{ color: 'var(--text-muted)' }}>Начните вести дневник, чтобы отслеживать свои мысли и эмоции</div>
              <button className="button" onClick={() => openEditor()} style={{ marginTop: 16, padding: '10px 20px' }}>Создать первую запись</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {entries.map(entry => (
                <div key={entry.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div className="small" style={{ color: 'var(--text-muted)' }}>{formatDate(entry.createdAt)}</div>
                    {entry.moodTag && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: 'var(--brand-soft, rgba(108,91,212,0.12))',
                          color: 'var(--brand)',
                        }}
                      >
                        {entry.moodTag}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="button secondary" onClick={() => openEditor(entry)} style={{ padding: '6px 10px', fontSize: 13 }}>Редактировать</button>
                      <button className="button secondary" onClick={() => deleteEntry(entry.id)} style={{ padding: '6px 10px', fontSize: 13, color: '#ff7b7b' }}>Удалить</button>
                    </div>
                  </div>
                  <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor Modal */}
        {showEditor && (
          <div onClick={closeEditor} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', padding: 12, zIndex: 50 }}>
            <div className="card" onClick={e => e.stopPropagation()} style={{ width: 'min(800px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: 16, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{selectedEntry ? 'Редактировать запись' : 'Новая запись'}</div>
                <button className="button secondary" onClick={closeEditor} style={{ padding: '6px 10px', fontSize: 13 }}>Закрыть</button>
              </div>
              <textarea
                value={editorContent}
                onChange={e => setEditorContent(e.target.value)}
                placeholder="Ваши мысли, эмоции, события..."
                style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)', color: 'var(--text)', minHeight: 300, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span className="small" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Настроение записи:</span>
                {MOOD_TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={editorMoodTag === tag ? 'button' : 'button secondary'}
                    style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600 }}
                    onClick={() => setEditorMoodTag(editorMoodTag === tag ? '' : tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="button secondary" onClick={closeEditor} style={{ padding: '8px 12px' }}>Отмена</button>
                <button className="button" onClick={saveEntry} style={{ padding: '8px 12px' }}>Сохранить</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

