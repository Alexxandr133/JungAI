import { useEffect, useState } from 'react';
import { FolderPlus, X } from 'lucide-react';
import { addSpaceMaterial, loadProjects, type ResearchProject } from '../../lib/researchProjectStorage';
import './ResearchProjectSpace.css';

type Props = {
  open: boolean;
  content: string;
  defaultTitle?: string;
  sourceLabel?: string;
  previewHint?: string;
  onClose: () => void;
  onSaved?: (projectId: string) => void;
};

export function AddToProjectMaterialModal({
  open,
  content,
  defaultTitle,
  sourceLabel = 'Основной AI-чат',
  previewHint = 'Будет сохранён текст — его увидит ИИ-агент внутри проекта.',
  onClose,
  onSaved,
}: Props) {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const list = loadProjects();
    setProjects(list);
    setProjectId(list[0]?.id || '');
    const firstLine = content.split('\n').find((l) => l.trim())?.trim() || '';
    setTitle(
      defaultTitle?.trim() ||
        firstLine.replace(/^#+\s*/, '').slice(0, 120) ||
        'Материал'
    );
    setError(null);
  }, [open, content, defaultTitle]);

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) {
      setError('Выберите проект');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      addSpaceMaterial(projectId, {
        title: title.trim() || 'Материал',
        content,
        source: sourceLabel,
      });
      onSaved?.(projectId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="project-material-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="project-material-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="project-material-modal-title"
      >
        <div className="project-material-modal__head">
          <h3 id="project-material-modal-title">
            <FolderPlus size={20} />
            Добавить к материалам проекта
          </h3>
          <button type="button" className="project-material-modal__close" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        {projects.length === 0 ? (
          <p className="project-material-modal__empty">
            Сначала создайте проект в разделе «Проекты».
          </p>
        ) : (
          <form onSubmit={handleSave} className="project-material-modal__form">
            <label>
              Проект
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Название материала
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <p className="project-material-modal__preview-hint">{previewHint}</p>
            {error && <p className="project-material-modal__error">{error}</p>}
            <div className="project-material-modal__actions">
              <button type="button" className="button secondary" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="button" disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
