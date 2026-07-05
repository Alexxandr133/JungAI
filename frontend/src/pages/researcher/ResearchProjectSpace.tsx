import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  BookOpen,
  FileText,
  FolderOpen,
  History,
  Lightbulb,
  ListTodo,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  AI_CONTEXT_WINDOW_TOKENS,
  deriveDisplayContextUsage,
  type ContextUsage,
} from '../../lib/aiContextTypes';
import { applyProjectAgentAction } from '../../lib/projectSpaceAgentActions';
import { resolveAgentDreamSettings } from '../../lib/projectSpaceAgentMentions';
import { actionLabel, type ProjectAgentAction } from '../../lib/projectSpaceAgentTypes';
import {
  captureProjectSpaceSnapshot,
  loadSpaceChangeHistory,
  markSpaceChangeReverted,
  pushSpaceChange,
  restoreProjectSpaceSnapshot,
  type SpaceChangeRecord,
} from '../../lib/projectSpaceChangeHistory';
import { loadResearcherAiSettings } from '../../lib/researcherAiSettings';
import {
  buildFullSpaceContextForAi,
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
  type SpaceActiveTool,
} from '../../lib/researchProjectStorage';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';
import { AiAssistantMarkdown } from '../../components/AiAssistantMarkdown';
import { AiContextRing } from '../../components/AiContextRing';
import '../psychologist/WorkAreaEditor.css';
import '../psychologist/AIChatMarkdown.css';
import { ProjectSpaceEditorToolbar } from './ProjectSpaceEditorToolbar';
import { ProjectSpaceIntro } from './ProjectSpaceIntro';
import {
  ProjectSpaceHypothesesTool,
  ProjectSpaceMaterialsTool,
  ProjectSpaceSourcesTool,
  ProjectSpaceTasksTool,
} from './ProjectSpaceToolPanels';
import './ResearchProjectSpace.css';

const SPACE_TOOLS: Array<{
  id: SpaceActiveTool | 'ai';
  label: string;
  Icon: typeof FileText;
  toggle?: boolean;
}> = [
  { id: 'document', label: 'Документ', Icon: FileText },
  { id: 'hypotheses', label: 'Гипотезы', Icon: Lightbulb },
  { id: 'sources', label: 'Источники', Icon: BookOpen },
  { id: 'tasks', label: 'Задачи', Icon: ListTodo, toggle: true },
  { id: 'materials', label: 'Материалы', Icon: FolderOpen },
  { id: 'ai', label: 'Агент', Icon: Bot, toggle: true },
];

type SidePanelTab = 'tasks' | 'agent';

export default function ResearchProjectSpace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const aiMessagesRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [activeTool, setActiveTool] = useState<SpaceActiveTool>('document');
  const [aiOpen, setAiOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('agent');
  const sidePanelOpen = aiOpen || tasksOpen;
  const [toolRefreshKey, setToolRefreshKey] = useState(0);
  const [aiPanelWidth, setAiPanelWidth] = useState(() => {
    const saved = localStorage.getItem('project_space_ai_width');
    const n = saved ? Number(saved) : 380;
    return Number.isFinite(n) ? Math.min(640, Math.max(280, n)) : 380;
  });
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const touchTimerRef = useRef<number | null>(null);
  const aiWidthRef = useRef(aiPanelWidth);

  const [project, setProject] = useState<ResearchProject | null>(null);
  const [tabs, setTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('Гипотеза');
  const [saving, setSaving] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [showNewTab, setShowNewTab] = useState(false);
  const [aiMessages, setAiMessages] = useState<ProjectAiMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const [participants, setParticipants] = useState<Array<{ clientId: string; label: string; count: number }>>([]);
  const [changeHistory, setChangeHistory] = useState<SpaceChangeRecord[]>([]);
  const [showChanges, setShowChanges] = useState(false);
  const [agentDreams, setAgentDreams] = useState(() => {
    const s = loadResearcherAiSettings();
    return {
      includeDreamsInContext: s.includeDreamsInContext,
      dreamsContextRange: s.dreamsContextRange,
      dreamSampleSize: s.dreamSampleSize,
      participantClientId: s.participantClientId,
    };
  });

  useEffect(() => {
    setIntroDone(false);
    setActiveTool('document');
    setAiOpen(false);
    setTasksOpen(false);
    setSidePanelTab('agent');
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    setChangeHistory(loadSpaceChangeHistory(projectId));
  }, [projectId, toolRefreshKey]);

  useEffect(() => {
    if (!token || !aiOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{
          participants: Array<{ clientId: string; label: string; count: number }>;
        }>('/api/ai/researcher/dream-scope-preview', {
          method: 'POST',
          token,
          body: {
            includeDreamsInContext: agentDreams.includeDreamsInContext,
            dreamSampleSize: agentDreams.dreamSampleSize,
            participantClientId: agentDreams.participantClientId || undefined,
          },
        });
        if (!cancelled) setParticipants(res.participants || []);
      } catch {
        if (!cancelled) setParticipants([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, aiOpen, agentDreams.includeDreamsInContext, agentDreams.dreamSampleSize, agentDreams.participantClientId]);

  const displayContextUsage = useMemo(
    () => deriveDisplayContextUsage(contextUsage, aiMessages, aiInput),
    [contextUsage, aiMessages, aiInput]
  );

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

  useEffect(() => {
    if (!projectId || activeTool !== 'document') return;
    loadEditorContent(activeTab);
  }, [projectId, activeTab, activeTool, loadEditorContent, toolRefreshKey]);

  useEffect(() => {
    aiWidthRef.current = aiPanelWidth;
  }, [aiPanelWidth]);

  useEffect(() => {
    aiMessagesRef.current?.scrollTo({ top: aiMessagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [aiMessages, aiLoading]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizeRef.current || !bodyRef.current) return;
      const rect = bodyRef.current.getBoundingClientRect();
      const next = resizeRef.current.startWidth + (resizeRef.current.startX - e.clientX);
      const max = Math.min(640, rect.width - 320);
      setAiPanelWidth(Math.min(max, Math.max(280, next)));
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

  function handleToolClick(toolId: SpaceActiveTool | 'ai', toggle?: boolean) {
    if (toggle) {
      if (toolId === 'ai') {
        setAiOpen((v) => {
          if (!v) setSidePanelTab('agent');
          return !v;
        });
      } else if (toolId === 'tasks') {
        setTasksOpen((v) => {
          if (!v) setSidePanelTab('tasks');
          return !v;
        });
      }
      return;
    }
    setActiveTool(toolId as SpaceActiveTool);
  }

  function persistEditor() {
    if (!projectId || !editorRef.current) return;
    saveTabContent(projectId, activeTab, editorRef.current.innerHTML);
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

  function buildContext() {
    if (!projectId || !project) return '';
    const contents = loadAllTabContents(projectId, tabs);
    if (editorRef.current && activeTool === 'document') {
      contents[activeTab] = editorRef.current.innerHTML;
    }
    return buildFullSpaceContextForAi(projectId, project.title, tabs, contents);
  }

  function applyAgentAction(messageIndex: number, actionIndex: number, action: ProjectAgentAction) {
    if (!projectId) return;
    const snapshot = captureProjectSpaceSnapshot(projectId, tabs);
    const result = applyProjectAgentAction(projectId, action, tabs);
    if (!result.ok) {
      window.alert(result.error || 'Не удалось применить действие');
      return;
    }
    pushSpaceChange(projectId, {
      id: `chg-${Date.now()}`,
      at: new Date().toISOString(),
      label: actionLabel(action),
      action,
      snapshot,
    });
    setChangeHistory(loadSpaceChangeHistory(projectId));
    if (result.tabs.length !== tabs.length) setTabs(result.tabs);
    if (result.switchTool === 'tasks') {
      setTasksOpen(true);
      setSidePanelTab('tasks');
    } else if (result.switchTool) {
      setActiveTool(result.switchTool);
    }
    if (result.reloadTab) {
      setActiveTab(result.reloadTab);
      setToolRefreshKey((k) => k + 1);
    } else {
      setToolRefreshKey((k) => k + 1);
    }
    setSaving(true);
    setTimeout(() => setSaving(false), 600);

    setAiMessages((prev) => {
      const next = prev.map((m, mi) => {
        if (mi !== messageIndex) return m;
        const applied = new Set(m.appliedActionIndexes || []);
        applied.add(actionIndex);
        return { ...m, appliedActionIndexes: [...applied] };
      });
      saveProjectAiChat(projectId, next);
      return next;
    });
  }

  function revertSpaceChange(changeId: string) {
    if (!projectId) return;
    const record = changeHistory.find((r) => r.id === changeId);
    if (!record || record.revertedAt) return;
    if (!window.confirm(`Отменить изменение «${record.label}»?`)) return;
    const nextTabs = restoreProjectSpaceSnapshot(projectId, record.snapshot);
    setTabs(nextTabs);
    markSpaceChangeReverted(projectId, changeId);
    setChangeHistory(loadSpaceChangeHistory(projectId));
    setActiveTool('document');
    setToolRefreshKey((k) => k + 1);
  }

  function rejectAgentAction(messageIndex: number, actionIndex: number) {
    if (!projectId) return;
    setAiMessages((prev) => {
      const next = prev.map((m, mi) => {
        if (mi !== messageIndex) return m;
        const rejected = new Set(m.rejectedActionIndexes || []);
        rejected.add(actionIndex);
        return { ...m, rejectedActionIndexes: [...rejected] };
      });
      saveProjectAiChat(projectId, next);
      return next;
    });
  }

  async function sendAiMessage() {
    if (!token || !projectId || !project || !aiInput.trim() || aiLoading) return;
    const userMessage = aiInput.trim();
    setAiInput('');
    const nextUser = [...aiMessages, { role: 'user' as const, content: userMessage }];
    setAiMessages(nextUser);
    setAiLoading(true);

    const dreamOpts = resolveAgentDreamSettings(userMessage, participants, {
      includeDreamsInContext: agentDreams.includeDreamsInContext,
      participantClientId: agentDreams.participantClientId,
      dreamsContextRange: agentDreams.dreamsContextRange,
      dreamSampleSize: agentDreams.dreamSampleSize,
    });

    try {
      const res = await api<{
        message: string;
        actions?: ProjectAgentAction[];
        conversationHistory: ProjectAiMessage[];
        contextUsage?: ContextUsage;
      }>('/api/ai/researcher/project/chat', {
        method: 'POST',
        token,
        body: {
          projectId,
          projectTitle: project.title,
          spaceContext: buildContext(),
          documentTabs: tabs,
          message: userMessage,
          conversationHistory: aiMessages,
          agentMode: true,
          includeDreamsInContext: dreamOpts.includeDreamsInContext,
          dreamsContextRange: dreamOpts.dreamsContextRange,
          dreamSamplingMode: dreamOpts.dreamSamplingMode,
          dreamSampleSize: dreamOpts.dreamSampleSize,
          participantClientId: dreamOpts.participantClientId,
        },
      });
      if (res.contextUsage) {
        setContextUsage({
          ...res.contextUsage,
          contextWindowTokens: res.contextUsage.contextWindowTokens || AI_CONTEXT_WINDOW_TOKENS,
        });
      }
      setAiMessages((prev) => {
        const merged = res.conversationHistory.map((msg, i) => {
          const old = prev[i];
          if (!old || old.role !== 'assistant' || msg.role !== 'assistant') return msg;
          return {
            ...msg,
            appliedActionIndexes: old.appliedActionIndexes,
            rejectedActionIndexes: old.rejectedActionIndexes,
          };
        });
        saveProjectAiChat(projectId, merged);
        return merged;
      });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Не удалось получить ответ';
      const withErr = [...nextUser, { role: 'assistant' as const, content: `Ошибка: ${errMsg}` }];
      setAiMessages(withErr);
      saveProjectAiChat(projectId, withErr);
    } finally {
      setAiLoading(false);
    }
  }

  if (!project || !projectId) return null;

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
            <h1>{project.title}</h1>
          </div>
          <div className="project-space-header__actions">
            <nav className="project-space-tools" aria-label="Инструменты проекта">
              {SPACE_TOOLS.map(({ id, label, Icon, toggle }) => {
                const active = toggle
                  ? id === 'ai'
                    ? aiOpen
                    : id === 'tasks'
                      ? tasksOpen
                      : false
                  : activeTool === id;
                const toggleTitle =
                  id === 'ai'
                    ? aiOpen
                      ? 'Скрыть агента'
                      : 'Открыть агента'
                    : id === 'tasks'
                      ? tasksOpen
                        ? 'Скрыть задачи'
                        : 'Открыть задачи'
                      : label;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`project-space-tools__btn${active ? ' active' : ''}${toggle ? ' toggle' : ''}`}
                    title={toggle ? toggleTitle : label}
                    aria-pressed={active}
                    onClick={() => handleToolClick(id, toggle)}
                  >
                    <Icon size={17} strokeWidth={2} aria-hidden />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="project-space-header__meta">{saving ? 'Сохранение…' : 'Сохранено'}</div>
          </div>
        </header>

        <div ref={bodyRef} className="project-space-body">
          <section className="project-space-workspace">
            {activeTool === 'document' && (
              <>
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
                        <button
                          type="button"
                          className="button secondary"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                          onClick={() => setShowNewTab(false)}
                        >
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
              </>
            )}
            {activeTool === 'hypotheses' && (
              <ProjectSpaceHypothesesTool key={toolRefreshKey} projectId={projectId} />
            )}
            {activeTool === 'sources' && <ProjectSpaceSourcesTool key={toolRefreshKey} projectId={projectId} />}
            {activeTool === 'materials' && (
              <ProjectSpaceMaterialsTool key={toolRefreshKey} projectId={projectId} />
            )}
          </section>

          {sidePanelOpen && (
            <>
              <div
                className="project-space-resizer"
                role="separator"
                aria-orientation="vertical"
                aria-label="Изменить ширину боковой панели"
                onMouseDown={startAiResize}
              />
              <aside
                className={`project-space-ai-panel${sidePanelTab === 'tasks' && !(aiOpen && tasksOpen) ? ' project-space-ai-panel--tasks' : ''}`}
                aria-label="Боковая панель проекта"
                style={{ width: aiPanelWidth, flexShrink: 0 }}
              >
                {aiOpen && tasksOpen && (
                  <div className="project-space-side-panel__tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={sidePanelTab === 'tasks'}
                      className={sidePanelTab === 'tasks' ? 'active' : ''}
                      onClick={() => setSidePanelTab('tasks')}
                    >
                      <ListTodo size={15} />
                      Задачи
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={sidePanelTab === 'agent'}
                      className={sidePanelTab === 'agent' ? 'active' : ''}
                      onClick={() => setSidePanelTab('agent')}
                    >
                      <Bot size={15} />
                      Агент
                    </button>
                  </div>
                )}

                {tasksOpen && (sidePanelTab === 'tasks' || !aiOpen) && (
                  <>
                    <div className="project-space-ai-panel__head project-space-ai-panel__head--tasks">
                      <div className="project-space-ai-panel__icon-wrap project-space-ai-panel__icon-wrap--tasks">
                        <ListTodo size={22} />
                      </div>
                      <div className="project-space-ai-panel__title-row">
                        <div className="project-space-ai-panel__badge project-space-ai-panel__badge--tasks">
                          Задачи проекта
                        </div>
                        <div className="project-space-ai-panel__title">Задачи</div>
                        <div className="project-space-ai-panel__hint">
                          Чек-лист этапов — документ остаётся на экране.
                        </div>
                      </div>
                    </div>
                    <ProjectSpaceTasksTool key={toolRefreshKey} projectId={projectId} embedded />
                  </>
                )}

                {aiOpen && (sidePanelTab === 'agent' || !tasksOpen) && (
                  <>
                <div className="project-space-ai-panel__head">
                  <div className="project-space-ai-panel__icon-wrap">
                    <Sparkles size={22} />
                  </div>
                  <div className="project-space-ai-panel__title-row">
                    <div className="project-space-ai-panel__badge">ИИ-агент проекта</div>
                    <div className="project-space-ai-panel__title">Агент</div>
                    <div className="project-space-ai-panel__hint">
                      Документ, гипотезы, все сны выбранного участника. «Участник» = выбранный в списке.
                    </div>
                  </div>
                  <div className="project-space-ai-panel__tools">
                    {displayContextUsage && (
                      <AiContextRing usage={displayContextUsage} loading={aiLoading} size={40} />
                    )}
                    {changeHistory.some((c) => !c.revertedAt) && (
                      <button
                        type="button"
                        className={`project-space-ai-changes${showChanges ? ' active' : ''}`}
                        onClick={() => setShowChanges((v) => !v)}
                        title="История изменений"
                      >
                        <History size={16} />
                      </button>
                    )}
                    {aiMessages.length > 0 && (
                      <button
                        type="button"
                        className="project-space-ai-clear"
                        onClick={() => {
                          if (!window.confirm('Очистить историю агента?')) return;
                          setAiMessages([]);
                          saveProjectAiChat(projectId, []);
                        }}
                        title="Очистить"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {showChanges && changeHistory.length > 0 && (
                  <div className="project-space-ai-changes-panel">
                    <div className="project-space-ai-changes-panel__title">История изменений</div>
                    {changeHistory.slice(0, 12).map((rec) => (
                      <div
                        key={rec.id}
                        className={`project-space-ai-change${rec.revertedAt ? ' reverted' : ''}`}
                      >
                        <div className="project-space-ai-change__label">{rec.label}</div>
                        <div className="project-space-ai-change__meta">
                          {new Date(rec.at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        {!rec.revertedAt && (
                          <button
                            type="button"
                            className="project-space-ai-change__revert"
                            onClick={() => revertSpaceChange(rec.id)}
                          >
                            Отменить
                          </button>
                        )}
                        {rec.revertedAt && (
                          <span className="project-space-ai-change__reverted">Отменено</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div ref={aiMessagesRef} className="project-space-ai-messages">
                  {aiMessages.length === 0 && (
                    <div className="project-space-ai-empty">
                      Попросите агента структурировать гипотезы, вставить таблицу в документ, добавить задачи или
                      проанализировать материалы проекта.
                    </div>
                  )}
                  {aiMessages.map((msg, msgIndex) => (
                    <div
                      key={msgIndex}
                      className={msg.role === 'user' ? 'project-space-ai-msg user' : 'project-space-ai-msg assistant'}
                    >
                      {msg.role === 'assistant' ? (
                        <AiAssistantMarkdown content={msg.content} className="project-space-ai-md" />
                      ) : (
                        msg.content
                      )}
                      {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                        <div className="project-space-agent-actions">
                          <div className="project-space-agent-actions__label">Предложенные действия</div>
                          {msg.actions.map((action, actionIndex) => {
                            const applied = msg.appliedActionIndexes?.includes(actionIndex);
                            const rejected = msg.rejectedActionIndexes?.includes(actionIndex);
                            const settled = applied || rejected;
                            return (
                              <div
                                key={actionIndex}
                                className={`project-space-agent-actions__row${applied ? ' applied' : ''}${rejected ? ' rejected' : ''}`}
                              >
                                <span className="project-space-agent-actions__desc">{actionLabel(action)}</span>
                                {!settled && (
                                  <div className="project-space-agent-actions__buttons">
                                    <button
                                      type="button"
                                      className="project-space-agent-actions__btn project-space-agent-actions__btn--apply"
                                      onClick={() => applyAgentAction(msgIndex, actionIndex, action)}
                                    >
                                      Применить
                                    </button>
                                    <button
                                      type="button"
                                      className="project-space-agent-actions__btn project-space-agent-actions__btn--reject"
                                      onClick={() => rejectAgentAction(msgIndex, actionIndex)}
                                    >
                                      Отклонить
                                    </button>
                                  </div>
                                )}
                                {applied && (
                                  <span className="project-space-agent-actions__status">✓ Применено</span>
                                )}
                                {rejected && (
                                  <span className="project-space-agent-actions__status rejected">✕ Отклонено</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                  {aiLoading && <div className="project-space-ai-msg assistant loading">Агент думает…</div>}
                </div>

                <div className="project-space-ai-input">
                  <div className="project-space-ai-dreams">
                    <label className="project-space-ai-dreams__toggle">
                      <input
                        type="checkbox"
                        checked={agentDreams.includeDreamsInContext}
                        onChange={(e) =>
                          setAgentDreams((d) => ({ ...d, includeDreamsInContext: e.target.checked }))
                        }
                      />
                      Сны в контексте
                    </label>
                    {agentDreams.includeDreamsInContext && (
                      <select
                        value={agentDreams.participantClientId}
                        onChange={(e) =>
                          setAgentDreams((d) => ({ ...d, participantClientId: e.target.value }))
                        }
                        className="project-space-ai-dreams__select"
                        title="Участник — все его сны попадут в контекст"
                      >
                        <option value="">Все участники</option>
                        {participants.map((p) => (
                          <option key={p.clientId} value={p.clientId}>
                            {p.label} ({p.count})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <label htmlFor="project-space-ai-textarea">Задача для агента</label>
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
                    placeholder="Например: создай таблицу снов участника во вкладке Данные…"
                    rows={2}
                    disabled={aiLoading}
                  />
                  <button
                    type="button"
                    className="button"
                    onClick={() => sendAiMessage()}
                    disabled={!aiInput.trim() || aiLoading}
                  >
                    Отправить
                  </button>
                </div>
                  </>
                )}
              </aside>
            </>
          )}
        </div>
      </div>
    </>
  );
}
