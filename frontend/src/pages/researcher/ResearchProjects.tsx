import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, getApiBaseUrl } from '../../lib/api';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';
import { PlatformIcon } from '../../components/icons';
import {
  loadProjects,
  saveProjects,
  type ResearchProject,
} from '../../lib/researchProjectStorage';
import './ResearchProjects.css';

export default function ResearcherProjects() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [matrix, setMatrix] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, matrixRes] = await Promise.all([
          api('/api/research/stats', { token }),
          api('/api/research/matrix', { token }),
        ]);
        setStats(statsRes);
        setMatrix(matrixRes);
      } catch (e: any) {
        setError(e.message || 'Не удалось загрузить данные');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  function persistProjects(list: ResearchProject[]) {
    setProjects(list);
    saveProjects(list);
  }

  function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const now = new Date().toISOString();
    const project: ResearchProject = {
      id: `proj-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      createdAt: now,
      updatedAt: now,
    };
    persistProjects([project, ...projects]);
    setNewTitle('');
    setNewDesc('');
    setShowForm(false);
    navigate(`/researcher/projects/${project.id}`);
  }

  function deleteProject(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!window.confirm('Удалить проект?')) return;
    persistProjects(projects.filter((p) => p.id !== id));
  }

  async function exportData() {
    if (!token || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/research/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Ошибка экспорта');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jungai-research-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Не удалось экспортировать');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ResearcherNavbar />
      <main className="research-projects">
        <header className="research-projects__header">
          <div>
            <h1>
              <span className="research-projects__icon">
                <PlatformIcon name="microscope" size={32} strokeWidth={1.4} />
              </span>
              Исследовательские проекты
            </h1>
            <p>Рабочие space с вкладками, заметками и локальным ИИ по каждому проекту.</p>
          </div>
          <button type="button" className="button" onClick={exportData} disabled={exporting}>
            {exporting ? 'Экспорт…' : '↓ Экспорт JSON'}
          </button>
        </header>

        {error && <div className="research-projects__error">{error}</div>}

        <div className="research-projects__stats">
          {stats && (
            <>
              <div className="research-projects__stat card">
                <div className="research-projects__stat-value">{stats.counts?.dreams ?? '—'}</div>
                <div className="research-projects__stat-label">Снов</div>
              </div>
              <div className="research-projects__stat card">
                <div className="research-projects__stat-value">{stats.counts?.clients ?? '—'}</div>
                <div className="research-projects__stat-label">Участников</div>
              </div>
              <div className="research-projects__stat card">
                <div className="research-projects__stat-value">{stats.counts?.amplifications ?? '—'}</div>
                <div className="research-projects__stat-label">Амплификаций</div>
              </div>
            </>
          )}
        </div>

        <section className="research-projects__list-section">
          <div className="research-projects__list-header">
            <h2>Мои проекты</h2>
            <button type="button" className="button secondary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Отмена' : '+ Новый проект'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={addProject} className="research-projects__form">
              <input
                placeholder="Название проекта"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
              <textarea
                placeholder="Краткое описание (опционально)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
              />
              <button type="submit" className="button">
                Создать и открыть space
              </button>
            </form>
          )}

          {projects.length === 0 ? (
            <p className="research-projects__empty">Создайте проект — откроется space с вкладками и ИИ.</p>
          ) : (
            <div className="research-projects__widget-grid">
              {projects.map((p) => (
                <article
                  key={p.id}
                  className="research-projects__widget card card-hover-shimmer"
                  onClick={() => navigate(`/researcher/projects/${p.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/researcher/projects/${p.id}`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="research-projects__widget-icon">
                    <PlatformIcon name="file" size={28} strokeWidth={1.4} />
                  </span>
                  <span className="research-projects__widget-title">{p.title}</span>
                  {p.description && (
                    <span className="research-projects__widget-desc">{p.description}</span>
                  )}
                  <time className="research-projects__widget-date">
                    {new Date(p.updatedAt).toLocaleDateString('ru-RU')}
                  </time>
                  <button
                    type="button"
                    className="research-projects__widget-delete"
                    onClick={(e) => deleteProject(e, p.id)}
                    title="Удалить"
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {loading ? (
          <div className="research-projects__loading">Загрузка матрицы символов…</div>
        ) : matrix?.cooccurrence?.length > 0 ? (
          <section className="card research-projects__matrix">
            <h2>Топ коррелирующих символов</h2>
            <p className="research-projects__matrix-lead">
              Символы, которые чаще всего встречаются в одних и тех же снах.
            </p>
            <div className="research-projects__matrix-grid">
              {matrix.cooccurrence.slice(0, 12).map((item: any) => {
                const maxCount = item.correlations?.[0]?.count ?? 1;
                return (
                  <div key={item.symbol} className="research-projects__matrix-card">
                    <div className="research-projects__matrix-card-head">
                      <strong>{item.symbol}</strong>
                      <span>{item.correlations?.length ?? 0} связей</span>
                    </div>
                    <div className="research-projects__matrix-bars">
                      {(item.correlations ?? []).slice(0, 5).map((c: any) => (
                        <div key={c.symbol} className="research-projects__matrix-row">
                          <span className="research-projects__matrix-row-label">{c.symbol}</span>
                          <div className="research-projects__matrix-row-track">
                            <div
                              className="research-projects__matrix-row-fill"
                              style={{ width: `${Math.max(8, (c.count / maxCount) * 100)}%` }}
                            />
                          </div>
                          <span className="research-projects__matrix-row-count">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
