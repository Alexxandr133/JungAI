import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ArrowLeft, Bot, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';
import {
  buildSpaceContextForAi,
  getProjectById,
  loadAllTabContents,
  loadProjectAiChat,
  loadProjectTabs,
  loadTabContent,
  saveProjectAiChat,
  saveProjectTabs,
  saveTabContent,
  touchProjectUpdated,
  type ProjectAiMessage,
  type ResearchProject,
} from '../../lib/researchProjectStorage';
import '../psychologist/WorkAreaEditor.css';
import '../psychologist/AIChatMarkdown.css';
import { ProjectSpaceEditorToolbar } from './ProjectSpaceEditorToolbar';
import { ProjectSpaceIntro } from './ProjectSpaceIntro';
import './ResearchProjectSpace.css';

function renderAssistantMarkdown(content: string) {
  return (
    <div className="ai-md project-space-ai-md">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{content || ''}</ReactMarkdown>
    </div>
  );
}

export default function ResearchProjectSpace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const aiMessagesRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [aiPanelWidth, setAiPanelWidth] = useState(() => {
    const saved = localStorage.getItem('project_space_ai_width');
    const n = saved ? Number(saved) : 380;
    return Number.isFinite(n) ? Math.min(640, Math.max(280, n)) : 380;
  });
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const touchTimerRef = useRef<number | null>(null);

  const [project, setProject] = useState<ResearchProject | null>(null);
  const [tabs, setTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('Гипотеза');
  const [saving, setSaving] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [showNewTab, setShowNewTab] = useState(false);

  const [aiMessages, setAiMessages] = useState<ProjectAiMessage[]>(() =>
    projectId ? loadProjectAiChat(projectId) : []
  );
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const aiWidthRef = useRef(aiPanelWidth);

  useEffect(() => {
    setIntroDone(false);
  }, [projectId]);

  const syncEditorEmpty = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    setEditorEmpty(!el.textContent?.replace(/\u00a0/g, ' ').trim());
  }, []);

  const loadEditorContent = useCallback(
    (tab: string) => {
      if (!projectId || !editorRef.current) return;
      editorRef.current.innerHTML = loadTabContent(projectId, tab);
      syncEditorEmpty();
    },
    [projectId, syncEditorEmpty]
  );

  useEffect(() => {
    if (!projectId) return;
    const p = getProjectById(projectId);
    if (!p) {
      navigate('/researcher/projects', { replace: true });
      return;
    }
    setProject(p);
    const loaded = loadProjectTabs(projectId);
    setTabs(loaded);
    setActiveTab(loaded[0] || 'Гипотеза');
    setAiMessages(loadProjectAiChat(projectId));
  }, [projectId, navigate]);

  // Загружаем HTML редактора только при смене проекта или вкладки — не при каждом рендере
  useEffect(() => {
    if (!projectId) return;
    loadEditorContent(activeTab);
  }, [projectId, activeTab, loadEditorContent]);

  useEffect(() => {
    aiWidthRef.current = aiPanelWidth;
  }, [aiPanelWidth]);

  useEffect(() => {
    const box = aiMessagesRef.current;
    if (!box) return;
    box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [aiMessages, aiLoading]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizeRef.current || !bodyRef.current) return;
      const rect = bodyRef.current.getBoundingClientRect();
      const next = resizeRef.current.startWidth + (resizeRef.current.startX - e.clientX);
      const max = Math.min(640, rect.width - 320);
      const clamped = Math.min(max, Math.max(280, next));
      setAiPanelWidth(clamped);
    }
    function onUp() {
      if (resizeRef.current) {
        localStorage.setItem('project_space_ai_width', String(aiWidthRef.current));
      }
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function startAiResize(e: React.MouseEvent) {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: aiPanelWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function persistEditor() {
    if (!projectId || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    saveTabContent(projectId, activeTab, html);
    syncEditorEmpty();
    setSaving(true);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => setSaving(false), 600);
    if (touchTimerRef.current) window.clearTimeout(touchTimerRef.current);
    touchTimerRef.current = window.setTimeout(() => touchProjectUpdated(projectId), 1500);
  }

  function switchTab(tab: string) {
    if (!projectId || !editorRef.current) return;
    saveTabContent(projectId, activeTab, editorRef.current.innerHTML);
    setActiveTab(tab);
  }

  function addTab(e: React.FormEvent) {
    e.preventDefault();
    const name = newTabName.trim();
    if (!name || !projectId || tabs.includes(name)) return;
    const next = [...tabs, name];
    setTabs(next);
    saveProjectTabs(projectId, next);
    setNewTabName('');
    setShowNewTab(false);
    setActiveTab(name);
  }

  function removeTab(tab: string) {
    if (!projectId || tabs.length <= 1) return;
    if (!window.confirm(`Удалить вкладку «${tab}»?`)) return;
    const next = tabs.filter((t) => t !== tab);
    setTabs(next);
    saveProjectTabs(projectId, next);
    localStorage.removeItem(`researcher_project_space.${projectId}.tab.${tab}`);
    if (activeTab === tab) setActiveTab(next[0]);
  }

  async function sendAiMessage() {
    if (!token || !projectId || !project || !aiInput.trim() || aiLoading) return;
    const userMessage = aiInput.trim();
    setAiInput('');
    const nextUser = [...aiMessages, { role: 'user' as const, content: userMessage }];
    setAiMessages(nextUser);
    setAiLoading(true);

    const contents = loadAllTabContents(projectId, tabs);
    if (editorRef.current) {
      contents[activeTab] = editorRef.current.innerHTML;
    }
    const spaceContext = buildSpaceContextForAi(project.title, tabs, contents);

    try {
      const res = await api<{ message: string; conversationHistory: ProjectAiMessage[] }>(
        '/api/ai/researcher/project/chat',
        {
          method: 'POST',
          token,
          body: {
            projectId,
            projectTitle: project.title,
            spaceContext,
            message: userMessage,
            conversationHistory: aiMessages,
          },
        }
      );
      setAiMessages(res.conversationHistory);
      saveProjectAiChat(projectId, res.conversationHistory);
    } catch (e: any) {
      const errMsg = e?.message || 'Не удалось получить ответ';
      const withErr = [...nextUser, { role: 'assistant' as const, content: `Ошибка: ${errMsg}` }];
      setAiMessages(withErr);
      saveProjectAiChat(projectId, withErr);
    } finally {
      setAiLoading(false);
    }
  }

  if (!project) return null;

  return (
    <>
      {!introDone && <ProjectSpaceIntro onComplete={() => setIntroDone(true)} />}
      <div className={`project-space-page${introDone ? '' : ' project-space-page--intro-pending'}`}>
      <ResearcherNavbar />
      <header className="project-space-header">
        <button type="button" className="project-space-back" onClick={() => navigate('/researcher/projects')}>
          <ArrowLeft size={18} />
          Проекты
        </button>
        <div className="project-space-header__title">
          <span className="project-space-header__label">Space</span>
          <h1>{project.title}</h1>
        </div>
        <div className="project-space-header__meta">
          {saving ? 'Сохранение…' : 'Сохранено'}
        </div>
      </header>

      <div ref={bodyRef} className="project-space-body">
        <section className="project-space-workspace">
          <div className="project-space-workspace__chrome">
            <div className="project-space-workspace__head">
              <span className="project-space-workspace__label">Документ проекта</span>
              <span className="project-space-workspace__tab-hint">Вкладка: {activeTab}</span>
            </div>

            <div className="project-space-tabs">
            {tabs.map((tab) => (
              <div key={tab} className="project-space-tab-wrap">
                <button
                  type="button"
                  className={activeTab === tab ? 'project-space-tab active' : 'project-space-tab'}
                  onClick={() => switchTab(tab)}
                >
                  {tab}
                </button>
                {tabs.length > 1 && (
                  <button
                    type="button"
                    className="project-space-tab-remove"
                    onClick={() => removeTab(tab)}
                    title="Удалить вкладку"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {showNewTab ? (
              <form className="project-space-new-tab" onSubmit={addTab}>
                <input
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  placeholder="Название"
                  autoFocus
                />
                <button type="submit" className="button" style={{ padding: '6px 10px', fontSize: 12 }}>
                  OK
                </button>
                <button type="button" className="button secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setShowNewTab(false)}>
                  ×
                </button>
              </form>
            ) : (
              <button type="button" className="project-space-tab-add" onClick={() => setShowNewTab(true)}>
                <Plus size={14} />
              </button>
            )}
            </div>

            <ProjectSpaceEditorToolbar editorRef={editorRef} onChange={persistEditor} />
          </div>

          <div className="project-space-editor-scroll">
            {editorEmpty && (
              <div className="project-space-editor-placeholder" aria-hidden>
                Начните писать гипотезу, метод или заметки…
              </div>
            )}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="workarea-editor project-space-editor"
              onInput={persistEditor}
              dir="ltr"
            />
          </div>
        </section>

        <div
          className="project-space-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину панели ИИ"
          onMouseDown={startAiResize}
        />

        <aside
          className="project-space-ai-panel"
          aria-label="ИИ-ассистент проекта"
          style={{ width: aiPanelWidth, flexShrink: 0 }}
        >
          <div className="project-space-ai-panel__head">
            <div className="project-space-ai-panel__icon-wrap">
              <Bot size={22} />
            </div>
            <div className="project-space-ai-panel__title-row">
              <div className="project-space-ai-panel__badge">Изолированный контекст</div>
              <div className="project-space-ai-panel__title">ИИ-ассистент space</div>
              <div className="project-space-ai-panel__hint">
                Ассистент работает только с материалами проекта.
              </div>
            </div>
            {aiMessages.length > 0 && (
              <button
                type="button"
                className="project-space-ai-clear"
                onClick={() => {
                  if (!projectId) return;
                  if (!window.confirm('Очистить историю чата?')) return;
                  setAiMessages([]);
                  saveProjectAiChat(projectId, []);
                }}
                title="Очистить чат"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <div ref={aiMessagesRef} className="project-space-ai-messages">
            {aiMessages.length === 0 && (
              <div className="project-space-ai-empty">
                Задайте вопрос по гипотезам, методам и заметкам в вкладках слева. ИИ не имеет доступа к базе снов и другим проектам.
              </div>
            )}
            {aiMessages.map((msg, i) => (
              <div key={i} className={msg.role === 'user' ? 'project-space-ai-msg user' : 'project-space-ai-msg assistant'}>
                {msg.role === 'assistant' ? renderAssistantMarkdown(msg.content) : msg.content}
              </div>
            ))}
            {aiLoading && <div className="project-space-ai-msg assistant loading">Думаю…</div>}
          </div>

          <div className="project-space-ai-input">
            <label htmlFor="project-space-ai-textarea">Вопрос по материалам</label>
            <textarea
              id="project-space-ai-textarea"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendAiMessage();
                }
              }}
              placeholder="Вопрос по материалам проекта…"
              rows={2}
              disabled={aiLoading}
            />
            <button type="button" className="button" onClick={sendAiMessage} disabled={!aiInput.trim() || aiLoading}>
              Отправить
            </button>
          </div>
        </aside>
      </div>
    </div>
    </>
  );
}
