import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderPlus, Mic, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ResearcherNavbar } from '../../components/ResearcherNavbar';
import { PlatformIcon } from '../../components/icons';
import { AiAssistantMarkdown } from '../../components/AiAssistantMarkdown';
import { AITranscriptionPanel } from '../psychologist/AITranscriptionPanel';
import { PsychologistAiPersonalityModal } from '../psychologist/PsychologistAiPersonalityModal';
import { RESEARCHER_STT_JOBS_KEY } from '../psychologist/transcriptionStorage';
import {
  loadResearcherAiSettings,
  saveResearcherAiSettings,
  settingsToApiBody,
  DREAM_SAMPLING_OPTIONS,
  RESEARCH_PROMPT_OPTIONS,
  type ResearcherAiSettings,
} from '../../lib/researcherAiSettings';
import {
  loadResearcherPersonalityText,
  saveResearcherPersonalityText,
  RESEARCHER_PERSONALITY_EXAMPLE,
} from '../../lib/researcherAiPersonality';
import { ResearcherAiSettingsPanel } from './ResearcherAiSettingsPanel';
import '../psychologist/AIChatMarkdown.css';
import '../../styles/tokens.css';
import './ResearcherAIChat.css';
import { AiContextRing } from '../../components/AiContextRing';
import { deriveDisplayContextUsage, type ContextUsage } from '../../lib/aiContextTypes';
import { AddToProjectMaterialModal } from './AddToProjectMaterialModal';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  analysisMemory?: string;
};

type Folder = {
  id: string;
  name: string;
  createdAt: string;
};

const STORAGE_KEY = 'researcher_ai_chats';
const FOLDERS_STORAGE_KEY = 'researcher_ai_folders';

export default function ResearcherAIChat() {
  const { token } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [aiScreen, setAiScreen] = useState<'chat' | 'transcription'>('chat');
  const [sttBusy, setSttBusy] = useState(false);
  const [aiSettings, setAiSettings] = useState<ResearcherAiSettings>(() => loadResearcherAiSettings());
  const [aiDraft, setAiDraft] = useState<ResearcherAiSettings>(() => loadResearcherAiSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [personalityText, setPersonalityText] = useState(() => loadResearcherPersonalityText());
  const [participants, setParticipants] = useState<Array<{ clientId: string; label: string; count: number }>>([]);
  const [aiQuota, setAiQuota] = useState<{
    plan: string;
    limit: number;
    used: number;
    remaining: number;
    percentageUsed: number;
    resetAt: string;
  } | null>(null);
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const [materialModalContent, setMaterialModalContent] = useState<string | null>(null);
  const [materialSavedHint, setMaterialSavedHint] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadChats();
    loadFolders();
  }, []);

  useEffect(() => {
    if (currentChatId) {
      const chat = chats.find(c => c.id === currentChatId);
      if (chat && chat.messages) {
        setMessages(chat.messages);
      } else {
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [currentChatId, chats]);

  useEffect(() => {
    setContextUsage(null);
  }, [currentChatId]);

  useEffect(() => {
    if (token) {
      refreshDreamPreview(aiSettings);
    }
  }, [token]);

  const refreshDreamPreview = useCallback(
    async (settings: ResearcherAiSettings) => {
      if (!token) return;
      try {
        const res = await api<{
          participants: Array<{ clientId: string; label: string; count: number }>;
        }>('/api/ai/researcher/dream-scope-preview', {
          method: 'POST',
          token,
          body: settingsToApiBody(settings),
        });
        setParticipants(res.participants || []);
      } catch (e) {
        console.error('Dream preview failed:', e);
      }
    },
    [token]
  );

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  function loadChats() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setChats(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.error('Failed to load chats:', e);
    }
  }

  function loadFolders() {
    try {
      const saved = localStorage.getItem(FOLDERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFolders(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.error('Failed to load folders:', e);
    }
  }

  function saveChats(newChats: Chat[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newChats));
      setChats(newChats);
    } catch (e) {
      console.error('Failed to save chats:', e);
    }
  }

  function saveFolders(newFolders: Folder[]) {
    try {
      localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(newFolders));
      setFolders(newFolders);
    } catch (e) {
      console.error('Failed to save folders:', e);
    }
  }

  function createNewChat(folderId: string | null = null) {
    const newChat: Chat = {
      id: `chat-${Date.now()}-${Math.random()}`,
      title: 'Новый чат',
      messages: [],
      folderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const newChats = [newChat, ...chats];
    saveChats(newChats);
    setCurrentChatId(newChat.id);
    setMessages([]);
  }

  function createFolder() {
    if (!newFolderName.trim()) return;
    const newFolder: Folder = {
      id: `folder-${Date.now()}-${Math.random()}`,
      name: newFolderName.trim(),
      createdAt: new Date().toISOString()
    };
    const newFolders = [...folders, newFolder];
    saveFolders(newFolders);
    setNewFolderName('');
    setShowNewFolderModal(false);
  }

  function deleteChat(chatId: string) {
    if (!window.confirm('Удалить этот чат?')) return;
    const newChats = chats.filter(c => c.id !== chatId);
    saveChats(newChats);
    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setMessages([]);
    }
  }

  function deleteFolder(folderId: string) {
    if (!window.confirm('Удалить эту папку? Все чаты в ней будут перемещены в корень.')) return;
    const newFolders = folders.filter(f => f.id !== folderId);
    const newChats = chats.map(c => c.folderId === folderId ? { ...c, folderId: null } : c);
    saveFolders(newFolders);
    saveChats(newChats);
  }

  function updateChatTitle(chatId: string, newTitle: string) {
    const newChats = chats.map(c => 
      c.id === chatId ? { ...c, title: newTitle.trim() || 'Новый чат', updatedAt: new Date().toISOString() } : c
    );
    saveChats(newChats);
    setEditingChatId(null);
    setEditingChatTitle('');
  }

  function updateFolderName(folderId: string, newName: string) {
    if (!newName.trim()) return;
    const newFolders = folders.map(f => 
      f.id === folderId ? { ...f, name: newName.trim() } : f
    );
    saveFolders(newFolders);
    setEditingFolderId(null);
    setEditingFolderName('');
  }

  function moveChatToFolder(chatId: string, folderId: string | null) {
    const newChats = chats.map(c => 
      c.id === chatId ? { ...c, folderId, updatedAt: new Date().toISOString() } : c
    );
    saveChats(newChats);
  }

  function scopeBadgeLabel(settings: ResearcherAiSettings): string {
    if (!settings.includeDreamsInContext) return 'Сны выкл.';
    const period =
      settings.dreamsContextRange === '30d'
        ? '30д'
        : settings.dreamsContextRange === '90d'
          ? '90д'
          : settings.dreamsContextRange === '365d'
            ? '1г'
            : 'все';
    const mode = DREAM_SAMPLING_OPTIONS.find((m) => m.id === settings.dreamSamplingMode)?.label || '';
    const prompt = RESEARCH_PROMPT_OPTIONS.find((p) => p.id === settings.researchPromptId)?.label || '';
    return `${period} · ${settings.dreamSampleSize} сн. · ${mode}${prompt !== 'Свободный режим' ? ` · ${prompt}` : ''}`;
  }

  function applyAiSettings() {
    saveResearcherAiSettings(aiDraft);
    setAiSettings(aiDraft);
    setSettingsOpen(false);
    refreshDreamPreview(aiDraft);
  }

  async function sendMessage() {
    if (!input.trim() || loading || !token) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    let chatId = currentChatId;
    const activeChat = chatId ? chats.find((c) => c.id === chatId) : null;
    const analysisMemory = activeChat?.analysisMemory || '';

    if (chatId && activeChat) {
      const updatedChat = {
        ...activeChat,
        messages: newMessages,
        title:
          activeChat.title === 'Новый чат' && newMessages.length === 1
            ? userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '')
            : activeChat.title,
        updatedAt: new Date().toISOString(),
      };
      saveChats(chats.map((c) => (c.id === chatId ? updatedChat : c)));
    } else {
      const newChat: Chat = {
        id: `chat-${Date.now()}-${Math.random()}`,
        title: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
        messages: newMessages,
        folderId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        analysisMemory: '',
      };
      chatId = newChat.id;
      saveChats([newChat, ...chats]);
      setCurrentChatId(newChat.id);
    }

    try {
      const response = await api<{
        message: string;
        conversationHistory: Message[];
        quota?: typeof aiQuota;
        contextUsage?: ContextUsage;
        analysisMemory?: string;
        analysisMemoryUpdated?: boolean;
        dreamMeta?: { poolCount: number; selectedCount: number };
      }>('/api/ai/researcher/chat', {
        method: 'POST',
        token,
        body: {
          message: userMessage,
          conversationHistory: messages,
          personalization: personalityText.trim(),
          analysisMemory,
          ...settingsToApiBody(aiSettings),
        },
      });

      const finalMessages = response.conversationHistory;
      setMessages(finalMessages);
      if (response.quota) setAiQuota(response.quota);
      if (response.contextUsage) setContextUsage(response.contextUsage);

      if (chatId) {
        saveChats(
          chats.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: finalMessages,
                  updatedAt: new Date().toISOString(),
                  analysisMemory:
                    response.analysisMemoryUpdated && response.analysisMemory
                      ? response.analysisMemory
                      : c.analysisMemory,
                }
              : c
          )
        );
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Ошибка: ${error.message || 'Не удалось отправить сообщение'}`,
      };
      const errorMessages = [...newMessages, errorMessage];
      setMessages(errorMessages);

      if (chatId) {
        saveChats(
          chats.map((c) =>
            c.id === chatId ? { ...c, messages: errorMessages, updatedAt: new Date().toISOString() } : c
          )
        );
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const chatsByFolder = folders.map(folder => ({
    folder,
    chats: chats.filter(c => c.folderId === folder.id)
  }));

  const rootChats = chats.filter(c => !c.folderId);

  const displayContextUsage = useMemo(
    () => deriveDisplayContextUsage(contextUsage, messages, input),
    [contextUsage, messages, input]
  );

  return (
    <div className="researcher-ai-root">
      <ResearcherNavbar />
      <div className="researcher-ai-shell">
        <div className="researcher-ai-sidebar" style={{ width: sidebarOpen ? 280 : 0 }}>
          {sidebarOpen && (
            <div className="researcher-ai-sidebar__inner">
              <div className="researcher-ai-sidebar__header">
                <button
                  className="button"
                  onClick={() => createNewChat()}
                  style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 600 }}
                >
                  + Новый чат
                </button>
                <button
                  className="button secondary"
                  onClick={() => setShowNewFolderModal(true)}
                  style={{ width: '100%', padding: '10px', marginTop: 8, fontSize: 13 }}
                >
                  + Новая папка
                </button>
              </div>

              <div className="researcher-ai-sidebar__list">
                {/* Root chats */}
                {rootChats.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    {rootChats.map(chat => (
                      <div
                        key={chat.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          marginBottom: 4,
                          background: currentChatId === chat.id ? 'var(--primary)22' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          position: 'relative',
                        }}
                        onClick={() => setCurrentChatId(chat.id)}
                        onMouseEnter={(e) => {
                          if (currentChatId !== chat.id) {
                            e.currentTarget.style.background = 'var(--surface-2)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentChatId !== chat.id) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <span style={{ fontSize: 16 }}>💬</span>
                        {editingChatId === chat.id ? (
                          <input
                            value={editingChatTitle}
                            onChange={e => setEditingChatTitle(e.target.value)}
                            onBlur={() => updateChatTitle(chat.id, editingChatTitle)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                updateChatTitle(chat.id, editingChatTitle);
                              } else if (e.key === 'Escape') {
                                setEditingChatId(null);
                                setEditingChatTitle('');
                              }
                            }}
                            autoFocus
                            style={{
                              flex: 1,
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px solid var(--primary)',
                              background: 'var(--surface)',
                              color: 'var(--text)',
                              fontSize: 13
                            }}
                          />
                        ) : (
                          <>
                            <span
                              style={{
                                flex: 1,
                                fontSize: 13,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              onDoubleClick={() => {
                                setEditingChatId(chat.id);
                                setEditingChatTitle(chat.title);
                              }}
                            >
                              {chat.title}
                            </span>
                            {folders.length > 0 && (
                              <select
                                onChange={e => {
                                  if (e.target.value) {
                                    moveChatToFolder(chat.id, e.target.value === 'root' ? null : e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                onClick={e => e.stopPropagation()}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: 11,
                                  borderRadius: 4,
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  background: 'var(--surface-2)',
                                  color: 'var(--text)',
                                  cursor: 'pointer',
                                  marginRight: 4
                                }}
                                defaultValue=""
                              >
                                <option value="">📁</option>
                                {folders.map(f => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteChat(chat.id);
                              }}
                              style={{
                                padding: '4px 6px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: 12,
                                opacity: 0.6
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '1';
                                e.currentTarget.style.color = '#ef4444';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = '0.6';
                                e.currentTarget.style.color = 'var(--text-muted)';
                              }}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Folders */}
                {chatsByFolder.map(({ folder, chats: folderChats }) => (
                  <div key={folder.id} style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 8,
                        marginBottom: 4
                      }}
                    >
                      <span style={{ fontSize: 14 }}>📁</span>
                      {editingFolderId === folder.id ? (
                        <input
                          value={editingFolderName}
                          onChange={e => setEditingFolderName(e.target.value)}
                          onBlur={() => updateFolderName(folder.id, editingFolderName)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              updateFolderName(folder.id, editingFolderName);
                            } else if (e.key === 'Escape') {
                              setEditingFolderId(null);
                              setEditingFolderName('');
                            }
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            borderRadius: 4,
                            border: '1px solid var(--primary)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            fontSize: 13
                          }}
                        />
                      ) : (
                        <>
                          <span
                            style={{
                              flex: 1,
                              fontSize: 13,
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            onDoubleClick={() => {
                              setEditingFolderId(folder.id);
                              setEditingFolderName(folder.name);
                            }}
                          >
                            {folder.name}
                          </span>
                          <button
                            onClick={() => deleteFolder(folder.id)}
                            style={{
                              padding: '4px 6px',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              fontSize: 12,
                              opacity: 0.6
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '1';
                              e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '0.6';
                              e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                    <div style={{ paddingLeft: 20 }}>
                      {folderChats.map(chat => (
                        <div
                          key={chat.id}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            marginBottom: 4,
                            background: currentChatId === chat.id ? 'var(--primary)22' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}
                          onClick={() => setCurrentChatId(chat.id)}
                          onMouseEnter={(e) => {
                            if (currentChatId !== chat.id) {
                              e.currentTarget.style.background = 'var(--surface-2)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (currentChatId !== chat.id) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          <span style={{ fontSize: 14 }}>💬</span>
                          {editingChatId === chat.id ? (
                            <input
                              value={editingChatTitle}
                              onChange={e => setEditingChatTitle(e.target.value)}
                              onBlur={() => updateChatTitle(chat.id, editingChatTitle)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  updateChatTitle(chat.id, editingChatTitle);
                                } else if (e.key === 'Escape') {
                                  setEditingChatId(null);
                                  setEditingChatTitle('');
                                }
                              }}
                              autoFocus
                              style={{
                                flex: 1,
                                padding: '4px 8px',
                                borderRadius: 4,
                                border: '1px solid var(--primary)',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                                fontSize: 13
                              }}
                            />
                          ) : (
                            <>
                              <span
                                style={{
                                  flex: 1,
                                  fontSize: 13,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                onDoubleClick={() => {
                                  setEditingChatId(chat.id);
                                  setEditingChatTitle(chat.title);
                                }}
                              >
                                {chat.title}
                              </span>
                              {folders.length > 0 && (
                                <select
                                  onChange={e => {
                                    if (e.target.value) {
                                      moveChatToFolder(chat.id, e.target.value === 'root' ? null : e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    padding: '2px 6px',
                                    fontSize: 11,
                                    borderRadius: 4,
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    background: 'var(--surface-2)',
                                    color: 'var(--text)',
                                    cursor: 'pointer',
                                    marginRight: 4
                                  }}
                                  defaultValue=""
                                >
                                  <option value="">📁</option>
                                  <option value="root">Корень</option>
                                  {folders.map(f => (
                                    <option key={f.id} value={f.id}>
                                      {f.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteChat(chat.id);
                                }}
                                style={{
                                  padding: '4px 6px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  opacity: 0.6
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = '1';
                                  e.currentTarget.style.color = '#ef4444';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = '0.6';
                                  e.currentTarget.style.color = 'var(--text-muted)';
                                }}
                              >
                                ×
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                      <button
                        className="button secondary"
                        onClick={() => createNewChat(folder.id)}
                        style={{
                          width: '100%',
                          padding: '6px 12px',
                          marginTop: 4,
                          fontSize: 12
                        }}
                      >
                        + Чат в папке
                      </button>
                      {rootChats.length > 0 && (
                        <select
                          onChange={e => {
                            if (e.target.value) {
                              moveChatToFolder(e.target.value, folder.id);
                              e.target.value = '';
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '6px 12px',
                            marginTop: 4,
                            fontSize: 12,
                            borderRadius: 6,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'var(--surface-2)',
                            color: 'var(--text)',
                            cursor: 'pointer'
                          }}
                          defaultValue=""
                        >
                          <option value="">Переместить чат сюда</option>
                          {rootChats.map(chat => (
                            <option key={chat.id} value={chat.id}>
                              {chat.title}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="researcher-ai-sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{ left: sidebarOpen ? 280 : 0 }}
          aria-label={sidebarOpen ? 'Скрыть список чатов' : 'Показать список чатов'}
        >
          {sidebarOpen ? '‹' : '›'}
        </button>

        <div className="researcher-ai-main">
          <div className="researcher-ai-main__header">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {aiScreen === 'transcription' ? 'Транскрибация' : 'AI Ассистент исследователя'}
              </div>
              {aiScreen === 'chat' && (
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 12 }}>
                  <span className="researcher-ai-scope-badge" title={scopeBadgeLabel(aiSettings)}>
                    {scopeBadgeLabel(aiSettings)}
                  </span>
                </div>
              )}
            </div>
            <div className="researcher-ai-header-actions">
              {aiScreen === 'chat' && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setAiDraft(aiSettings);
                    setSettingsOpen(true);
                  }}
                  title="Настройки"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13 }}
                >
                  <Settings size={16} />
                  Настройки
                </button>
              )}
              {aiScreen === 'chat' ? (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setAiScreen('transcription')}
                  title="Транскрибация аудио"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13 }}
                >
                  <Mic size={16} />
                  Транскрибация
                  {sttBusy && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} aria-hidden />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="button"
                  onClick={() => setAiScreen('chat')}
                  style={{ padding: '8px 12px', fontSize: 13 }}
                >
                  ← К чату
                </button>
              )}
            </div>
          </div>

          <div className="researcher-ai-main__body">
          {aiScreen === 'transcription' && token ? (
            <div className="researcher-ai-transcription-wrap">
            <AITranscriptionPanel
              token={token}
              isMobileView={false}
              onJobsChange={setSttBusy}
              apiBasePath="/api/ai/researcher/transcriptions"
              sttStorageKey={RESEARCHER_STT_JOBS_KEY}
            />
            </div>
          ) : !currentChatId && messages.length === 0 ? (
            <div className="researcher-ai-empty">
              <div style={{ textAlign: 'center', maxWidth: 600 }}>
                <div
                  style={{
                    margin: '0 auto 24px',
                    width: 88,
                    height: 88,
                    borderRadius: 24,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'linear-gradient(145deg, rgba(124,92,255,0.2), rgba(34,211,238,0.12))',
                    border: '1px solid rgba(124,92,255,0.35)',
                    color: 'var(--primary)'
                  }}
                >
                  <PlatformIcon name="bot" size={44} strokeWidth={1.35} />
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>AI Ассистент исследователя</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
                  Анализ обезличенной базы снов, паттернов и архетипов. Без доступа к данным клиентов — только символика и содержание.
                </p>
                <button
                  className="button"
                  onClick={() => createNewChat()}
                  style={{ padding: '12px 24px', fontSize: 15 }}
                >
                  Начать новый чат
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="researcher-ai-messages" ref={messagesContainerRef}>
                <div className="researcher-ai-messages__inner">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      marginBottom: 24
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '80%',
                        padding: '16px 20px',
                        borderRadius: 16,
                        background: msg.role === 'user'
                          ? 'linear-gradient(135deg, var(--primary), var(--accent))'
                          : 'var(--surface-2)',
                        color: msg.role === 'user' ? '#0b0f1a' : 'var(--text)',
                        lineHeight: 1.7,
                        wordBreak: 'break-word',
                        fontSize: 15
                      }}
                    >
                      {msg.role === 'assistant' ? <AiAssistantMarkdown content={msg.content} /> : msg.content}
                    </div>
                    {msg.role === 'assistant' && msg.content.trim() && (
                      <button
                        type="button"
                        className="researcher-ai-save-material-btn"
                        onClick={() => setMaterialModalContent(msg.content)}
                      >
                        <FolderPlus size={14} />
                        Добавить к материалам проекта
                      </button>
                    )}
                  </div>
                ))}
                {loading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 24 }}>
                    <div
                      style={{
                        padding: '16px 20px',
                        borderRadius: 16,
                        background: 'var(--surface-2)',
                        color: 'var(--text-muted)',
                        fontSize: 15
                      }}
                    >
                      Думаю...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="researcher-ai-input-bar">
                <div className="researcher-ai-input-bar__inner">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Напишите сообщение..."
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '14px 18px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      fontSize: 15,
                      fontFamily: 'inherit',
                      resize: 'none',
                      minHeight: 52,
                      maxHeight: 200,
                      lineHeight: 1.5
                    }}
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                    }}
                  />
                  <AiContextRing usage={displayContextUsage} loading={loading} size={52} />
                  <button
                    className="button"
                    onClick={sendMessage}
                    disabled={!input.trim() || loading}
                    style={{
                      padding: '14px 24px',
                      fontSize: 15,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      opacity: (!input.trim() || loading) ? 0.5 : 1,
                      cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? '...' : 'Отправить'}
                  </button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      <ResearcherAiSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        draft={aiDraft}
        setDraft={setAiDraft}
        onApply={applyAiSettings}
        onOpenMemory={() => setShowMemoryModal(true)}
        isMobileView={false}
        participants={participants}
        quota={aiQuota}
      />

      <PsychologistAiPersonalityModal
        open={showMemoryModal}
        variant="memory"
        initialText={personalityText}
        exampleText={RESEARCHER_PERSONALITY_EXAMPLE}
        onClose={() => setShowMemoryModal(false)}
        onSave={(text) => {
          saveResearcherPersonalityText(text);
          setPersonalityText(text);
          setShowMemoryModal(false);
        }}
      />

      {/* New folder modal */}
      {showNewFolderModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 2000
          }}
          onClick={() => setShowNewFolderModal(false)}
        >
          <div
            className="card"
            style={{
              padding: 24,
              minWidth: 320,
              background: 'var(--surface)',
              border: '1px solid rgba(255,255,255,0.12)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>Новая папка</h3>
            <input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  createFolder();
                } else if (e.key === 'Escape') {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                }
              }}
              placeholder="Название папки"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 14,
                marginBottom: 16
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="button secondary"
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                }}
                style={{ padding: '10px 20px' }}
              >
                Отмена
              </button>
              <button
                className="button"
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                style={{ padding: '10px 20px' }}
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      <AddToProjectMaterialModal
        open={!!materialModalContent}
        content={materialModalContent || ''}
        onClose={() => setMaterialModalContent(null)}
        onSaved={(pid) => {
          setMaterialSavedHint('Материал сохранён в проект');
          setTimeout(() => setMaterialSavedHint(null), 4000);
          void pid;
        }}
      />

      {materialSavedHint && (
        <div className="researcher-ai-toast">
          {materialSavedHint}
          <button type="button" onClick={() => setMaterialSavedHint(null)}>×</button>
        </div>
      )}
    </div>
  );
}

