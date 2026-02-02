import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import '../../styles/tokens.css';

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
};

type Folder = {
  id: string;
  name: string;
  createdAt: string;
};

const STORAGE_KEY = 'psychologist_ai_chats';
const FOLDERS_STORAGE_KEY = 'psychologist_ai_folders';

export default function PsychologistAIChat() {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  async function sendMessage() {
    if (!input.trim() || loading || !token) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    // Обновляем чат
    if (currentChatId) {
      const chat = chats.find(c => c.id === currentChatId);
      if (chat) {
        const updatedChat = {
          ...chat,
          messages: newMessages,
          title: chat.title === 'Новый чат' && newMessages.length === 1 
            ? userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '')
            : chat.title,
          updatedAt: new Date().toISOString()
        };
        const newChats = chats.map(c => c.id === currentChatId ? updatedChat : c);
        saveChats(newChats);
      }
    } else {
      // Создаем новый чат
      const newChat: Chat = {
        id: `chat-${Date.now()}-${Math.random()}`,
        title: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
        messages: newMessages,
        folderId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const newChats = [newChat, ...chats];
      saveChats(newChats);
      setCurrentChatId(newChat.id);
    }

    try {
      const response = await api<{ message: string; conversationHistory: Message[] }>(
        '/api/ai/psychologist/chat',
        {
          method: 'POST',
          token,
          body: {
            message: userMessage,
            conversationHistory: messages
          }
        }
      );

      const finalMessages = response.conversationHistory;
      setMessages(finalMessages);

      // Обновляем чат с финальными сообщениями
      if (currentChatId) {
        const newChats = chats.map(c => 
          c.id === currentChatId 
            ? { ...c, messages: finalMessages, updatedAt: new Date().toISOString() }
            : c
        );
        saveChats(newChats);
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Ошибка: ${error.message || 'Не удалось отправить сообщение'}`
      };
      const errorMessages = [...newMessages, errorMessage];
      setMessages(errorMessages);

      if (currentChatId) {
        const newChats = chats.map(c => 
          c.id === currentChatId 
            ? { ...c, messages: errorMessages, updatedAt: new Date().toISOString() }
            : c
        );
        saveChats(newChats);
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PsychologistNavbar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div
          style={{
            width: sidebarOpen ? 280 : 0,
            background: 'var(--surface)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s',
            overflow: 'hidden'
          }}
        >
          {sidebarOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Header */}
              <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
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

              {/* Chats list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
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
                                  {folders.filter(f => f.id !== folder.id).map(f => (
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Toggle sidebar button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: 'absolute',
            left: sidebarOpen ? 280 : 0,
            top: 80,
            width: 24,
            height: 40,
            background: 'var(--surface-2)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderLeft: 'none',
            borderRadius: '0 8px 8px 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            transition: 'left 0.3s'
          }}
        >
          {sidebarOpen ? '‹' : '›'}
        </button>

        {/* Main chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
          {!currentChatId && messages.length === 0 ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 48 }}>
              <div style={{ textAlign: 'center', maxWidth: 600 }}>
                <div style={{ fontSize: 64, marginBottom: 24 }}>🤖</div>
                <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>AI Ассистент психолога</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
                  Задавайте вопросы о клиентах, их снах, заметках, сессиях. Я помогу вам с амплификациями, 
                  анализом символов, выявлением архетипических паттернов и интерпретацией снов пациентов.
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
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 48px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
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
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 15
                      }}
                    >
                      {msg.content}
                    </div>
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

              {/* Input */}
              <div style={{ padding: '24px 48px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'var(--surface)' }}>
                <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
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
    </div>
  );
}

