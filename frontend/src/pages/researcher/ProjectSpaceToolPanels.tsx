import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Check, FileUp, FolderOpen, Globe, Lightbulb, ListTodo, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  addSpaceMaterial,
  loadSpaceHypotheses,
  loadSpaceMaterials,
  loadSpaceSources,
  loadSpaceTasks,
  saveSpaceHypotheses,
  saveSpaceMaterials,
  saveSpaceSources,
  saveSpaceTasks,
  type SpaceHypothesis,
  type SpaceMaterial,
  type SpaceSource,
  type SpaceTask,
} from '../../lib/researchProjectStorage';
import { AiAssistantMarkdown } from '../../components/AiAssistantMarkdown';
const HYPOTHESIS_STATUS: Record<
  SpaceHypothesis['status'],
  { label: string; color: string }
> = {
  draft: { label: 'Черновик', color: 'rgba(148, 163, 184, 0.35)' },
  testing: { label: 'Проверка', color: 'rgba(234, 179, 8, 0.35)' },
  confirmed: { label: 'Подтверждена', color: 'rgba(34, 197, 94, 0.35)' },
  rejected: { label: 'Отклонена', color: 'rgba(239, 68, 68, 0.35)' },
};

type ToolShellProps = {
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
};

function ToolShell({ icon, title, hint, children }: ToolShellProps) {
  return (
    <section className="project-space-tool">
      <div className="project-space-tool__head">
        <div className="project-space-tool__icon">{icon}</div>
        <div>
          <h2 className="project-space-tool__title">{title}</h2>
          <p className="project-space-tool__hint">{hint}</p>
        </div>
      </div>
      <div className="project-space-tool__body">{children}</div>
    </section>
  );
}

export function ProjectSpaceHypothesesTool({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<SpaceHypothesis[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setItems(loadSpaceHypotheses(projectId));
  }, [projectId]);

  function persist(next: SpaceHypothesis[]) {
    setItems(next);
    saveSpaceHypotheses(projectId, next);
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    persist([
      {
        id: `hyp-${Date.now()}`,
        text,
        status: 'draft',
        createdAt: new Date().toISOString(),
      },
      ...items,
    ]);
    setDraft('');
  }

  return (
    <ToolShell
      icon={<Lightbulb size={22} />}
      title="Гипотезы"
      hint="Формулируйте и отслеживайте статус исследовательских гипотез."
    >
      <form className="project-space-tool__add" onSubmit={addItem}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Новая гипотеза…"
        />
        <button type="submit" className="button" disabled={!draft.trim()}>
          <Plus size={16} />
          Добавить
        </button>
      </form>
      {items.length === 0 ? (
        <p className="project-space-tool__empty">Пока нет гипотез — добавьте первую формулировку.</p>
      ) : (
        <ul className="project-space-tool__list">
          {items.map((item) => (
            <li key={item.id} className="project-space-tool__card">
              <p className="project-space-tool__card-text">{item.text}</p>
              <div className="project-space-tool__card-actions">
                <select
                  value={item.status}
                  onChange={(e) =>
                    persist(
                      items.map((h) =>
                        h.id === item.id ? { ...h, status: e.target.value as SpaceHypothesis['status'] } : h
                      )
                    )
                  }
                  style={{ borderColor: HYPOTHESIS_STATUS[item.status].color }}
                >
                  {Object.entries(HYPOTHESIS_STATUS).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="project-space-tool__icon-btn"
                  title="Удалить"
                  onClick={() => persist(items.filter((h) => h.id !== item.id))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ToolShell>
  );
}

export function ProjectSpaceSourcesTool({ projectId }: { projectId: string }) {
  const { token } = useAuth();
  const [items, setItems] = useState<SpaceSource[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', author: '', year: '', url: '', notes: '' });
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadSpaceSources(projectId));
  }, [projectId]);

  function persist(next: SpaceSource[]) {
    setItems(next);
    saveSpaceSources(projectId, next);
  }

  async function analyzeSourceUrl(item: SpaceSource) {
    if (!token || !item.url?.trim()) return;
    setAnalyzingId(item.id);
    setAnalyzeError(null);
    try {
      const res = await api<{
        summary: string;
        pageTitle?: string;
        excerpt?: string;
      }>('/api/ai/researcher/analyze-url', {
        method: 'POST',
        token,
        body: {
          url: item.url.trim(),
          researchQuestion: `Проанализируй источник «${item.title}» для исследовательского проекта.`,
        },
      });
      persist(
        loadSpaceSources(projectId).map((s) =>
          s.id === item.id
            ? {
                ...s,
                urlAnalysis: res.summary,
                urlAnalyzedAt: new Date().toISOString(),
                pageTitle: res.pageTitle || s.pageTitle,
                notes: s.notes || res.excerpt?.slice(0, 300) || s.notes,
              }
            : s
        )
      );
    } catch (e: unknown) {
      setAnalyzeError(e instanceof Error ? e.message : 'Не удалось проанализировать URL');
    } finally {
      setAnalyzingId(null);
    }
  }
  function addSource(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    persist([
      {
        id: `src-${Date.now()}`,
        title: form.title.trim(),
        author: form.author.trim(),
        year: form.year.trim(),
        url: form.url.trim(),
        notes: form.notes.trim(),
      },
      ...items,
    ]);
    setForm({ title: '', author: '', year: '', url: '', notes: '' });
    setShowForm(false);
  }

  return (
    <ToolShell
      icon={<BookOpen size={22} />}
      title="Источники"
      hint="Библиография и статьи. Вставьте URL — ИИ загрузит и проанализирует страницу."
    >
      {analyzeError && <p className="project-space-tool__error">{analyzeError}</p>}      <div className="project-space-tool__toolbar-row">
        <button type="button" className="button secondary" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} />
          {showForm ? 'Отмена' : 'Добавить источник'}
        </button>
      </div>
      {showForm && (
        <form className="project-space-tool__form-grid" onSubmit={addSource}>
          <input
            required
            placeholder="Название *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <input
            placeholder="Автор"
            value={form.author}
            onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
          />
          <input
            placeholder="Год"
            value={form.year}
            onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
          />
          <input
            placeholder="URL"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          />
          <textarea
            placeholder="Заметки"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <button type="submit" className="button">
            Сохранить
          </button>
        </form>
      )}
      {items.length === 0 ? (
        <p className="project-space-tool__empty">Добавьте книги, статьи и другие источники.</p>
      ) : (
        <ul className="project-space-tool__list">
          {items.map((item) => (
            <li key={item.id} className="project-space-tool__card">
              <div className="project-space-tool__source-title">{item.title}</div>
              <div className="project-space-tool__source-meta">
                {[item.author, item.year].filter(Boolean).join(' · ')}
              </div>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer" className="project-space-tool__link">
                  {item.url}
                </a>
              )}
              {item.notes && <p className="project-space-tool__card-notes">{item.notes}</p>}
              {item.urlAnalysis && (
                <div className="project-space-tool__analysis">
                  <strong>Анализ страницы</strong>
                  <p>{item.urlAnalysis}</p>
                  {item.urlAnalyzedAt && (
                    <time className="project-space-tool__analysis-date">
                      {new Date(item.urlAnalyzedAt).toLocaleString('ru-RU')}
                    </time>
                  )}
                </div>
              )}
              <div className="project-space-tool__card-footer">
                {item.url?.trim() && (
                  <button
                    type="button"
                    className="button secondary"
                    style={{ fontSize: 12, padding: '6px 10px' }}
                    disabled={!!analyzingId}
                    onClick={() => analyzeSourceUrl(item)}
                  >
                    <Globe size={14} />
                    {analyzingId === item.id ? 'Анализ…' : 'Проанализировать URL'}
                  </button>
                )}
                <button
                  type="button"
                  className="project-space-tool__icon-btn"
                  title="Удалить"
                  onClick={() => persist(items.filter((s) => s.id !== item.id))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>          ))}
        </ul>
      )}
    </ToolShell>
  );
}

export function ProjectSpaceTasksTool({
  projectId,
  embedded = false,
}: {
  projectId: string;
  embedded?: boolean;
}) {
  const [items, setItems] = useState<SpaceTask[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setItems(loadSpaceTasks(projectId));
  }, [projectId]);

  function persist(next: SpaceTask[]) {
    setItems(next);
    saveSpaceTasks(projectId, next);
  }

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    persist([
      ...items,
      { id: `task-${Date.now()}`, text, done: false, createdAt: new Date().toISOString() },
    ]);
    setDraft('');
  }

  const doneCount = items.filter((t) => t.done).length;

  const body = (
    <>
      <form className="project-space-tool__add" onSubmit={addTask}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Новая задача…"
        />
        <button type="submit" className="button" disabled={!draft.trim()}>
          <Plus size={16} />
          Добавить
        </button>
      </form>
      {items.length > 0 && (
        <div className="project-space-tool__progress">
          Выполнено: {doneCount} / {items.length}
          <div className="project-space-tool__progress-bar">
            <div
              className="project-space-tool__progress-fill"
              style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <p className="project-space-tool__empty">Создайте задачи для планирования исследования.</p>
      ) : (
        <ul className="project-space-tool__list project-space-tool__list--tasks">
          {items.map((item) => (
            <li key={item.id} className={`project-space-tool__task${item.done ? ' done' : ''}`}>
              <button
                type="button"
                className="project-space-tool__check"
                aria-label={item.done ? 'Снять отметку' : 'Выполнено'}
                onClick={() =>
                  persist(items.map((t) => (t.id === item.id ? { ...t, done: !t.done } : t)))
                }
              >
                {item.done && <Check size={14} strokeWidth={3} />}
              </button>
              <span className="project-space-tool__task-text">{item.text}</span>
              <button
                type="button"
                className="project-space-tool__icon-btn"
                title="Удалить"
                onClick={() => persist(items.filter((t) => t.id !== item.id))}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  if (embedded) {
    return <div className="project-space-side-tool__body">{body}</div>;
  }

  return (
    <ToolShell
      icon={<ListTodo size={22} />}
      title="Задачи"
      hint="Чек-лист этапов исследования — от сбора данных до написания выводов."
    >
      {body}
    </ToolShell>
  );
}

export function ProjectSpaceMaterialsTool({ projectId }: { projectId: string }) {
  const { token } = useAuth();
  const [items, setItems] = useState<SpaceMaterial[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setItems(loadSpaceMaterials(projectId));
  }, [projectId]);

  function persist(next: SpaceMaterial[]) {
    setItems(next);
    saveSpaceMaterials(projectId, next);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !token) return;

    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api<{
        title: string;
        content: string;
        fileName: string;
        mimeType: string;
      }>('/api/ai/researcher/project/extract-document', {
        method: 'POST',
        token,
        body: form,
      });
      const item = addSpaceMaterial(projectId, {
        title: res.title,
        content: res.content,
        source: res.fileName.endsWith('.pdf') ? 'PDF' : 'Word',
        fileName: res.fileName,
        mimeType: res.mimeType,
      });
      setItems((prev) => [item, ...prev.filter((m) => m.id !== item.id)]);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
    }
  }

  function materialPreview(content: string, fileName?: string) {
    if (fileName && content.length > 1200) {
      return `${content.slice(0, 1200)}\n\n… *(полный текст в контексте агента)*`;
    }
    return content;
  }

  return (
    <ToolShell
      icon={<FolderOpen size={22} />}
      title="Материалы проекта"
      hint="PDF, Word, фрагменты из AI-чата — всё попадает в контекст агента."
    >
      <div className="project-space-tool__materials-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="project-space-tool__file-input"
          onChange={handleFileUpload}
          disabled={uploading}
        />
        <button
          type="button"
          className="button secondary project-space-tool__upload-btn"
          disabled={uploading || !token}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp size={16} />
          {uploading ? 'Читаем файл…' : 'Загрузить PDF / DOCX'}
        </button>
      </div>
      {uploadError && <p className="project-space-tool__error">{uploadError}</p>}

      {items.length === 0 ? (
        <p className="project-space-tool__empty">
          Загрузите PDF или DOCX, либо сохраните фрагмент из основного AI-чата.
        </p>
      ) : (
        <ul className="project-space-tool__list">
          {items.map((item) => (
            <li key={item.id} className="project-space-tool__card project-space-tool__material">
              <div className="project-space-tool__material-head">
                <strong>{item.title}</strong>
                <span className="project-space-tool__material-source">
                  {item.fileName ? `${item.source} · ${item.fileName}` : item.source}
                </span>
              </div>
              <div className="project-space-tool__material-body">
                <AiAssistantMarkdown content={materialPreview(item.content, item.fileName)} />
              </div>
              <time className="project-space-tool__analysis-date">
                {new Date(item.createdAt).toLocaleString('ru-RU')}
              </time>
              <button
                type="button"
                className="project-space-tool__icon-btn project-space-tool__icon-btn--end"
                title="Удалить"
                onClick={() => persist(items.filter((m) => m.id !== item.id))}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </ToolShell>
  );
}
