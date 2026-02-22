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
  isLoading?: boolean; // Флаг загрузки для сохранения состояния
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
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string; email?: string }>>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientModeEnabled, setClientModeEnabled] = useState(true); // Тумблер для работы с клиентами
  const [isSending, setIsSending] = useState(false); // Дополнительная блокировка отправки
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false); // Ref для предотвращения двойной отправки

  useEffect(() => {
    loadChats();
    loadFolders();
    // Загружаем клиентов только если режим работы с клиентами включен
    if (clientModeEnabled) {
      loadClients();
    }
  }, [clientModeEnabled]);

  async function loadClients() {
    if (!token) return;
    setLoadingClients(true);
    try {
      const res = await api<{ items: Array<{ id: string; name: string; email?: string }> }>('/api/clients', { token });
      setClients(res.items || []);
    } catch (e) {
      console.error('Failed to load clients:', e);
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }

  useEffect(() => {
    if (currentChatId) {
      const chat = chats.find(c => c.id === currentChatId);
      if (chat && chat.messages) {
        setMessages(chat.messages);
        // Восстанавливаем состояние загрузки, если чат в процессе загрузки
        if (chat.isLoading) {
          setLoading(true);
        } else {
          setLoading(false);
        }
      } else {
        setMessages([]);
        setLoading(false);
      }
    } else {
      setMessages([]);
      setLoading(false);
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
        const loadedChats = Array.isArray(parsed) ? parsed : [];
        // Сбрасываем флаги загрузки при загрузке (на случай, если браузер был закрыт во время загрузки)
        const chatsWithResetLoading = loadedChats.map((chat: Chat) => ({
          ...chat,
          isLoading: false
        }));
        setChats(chatsWithResetLoading);
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
    // Блокируем отправку, если уже идет отправка или загрузка
    if (!input.trim() || loading || isSending || sendingRef.current || !token) return;

    const userMessage = input.trim();
    setInput('');
    setIsSending(true);
    sendingRef.current = true;
    
    // Используем текущие сообщения для истории (без нового пользовательского сообщения)
    // так как оно передается отдельно как `message`
    const conversationHistory = messages;
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    // Обновляем чат с новыми сообщениями и флагом загрузки
    if (currentChatId) {
      const chat = chats.find(c => c.id === currentChatId);
      if (chat) {
        const updatedChat = {
          ...chat,
          messages: newMessages,
          title: chat.title === 'Новый чат' && newMessages.length === 1 
            ? userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '')
            : chat.title,
          updatedAt: new Date().toISOString(),
          isLoading: true // Сохраняем состояние загрузки
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
        updatedAt: new Date().toISOString(),
        isLoading: true // Сохраняем состояние загрузки
      } as Chat;
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
            conversationHistory: conversationHistory, // Используем правильную историю
            clientId: clientModeEnabled ? (selectedClientId || undefined) : undefined,
            clientModeEnabled: clientModeEnabled
          }
        }
      );

      const finalMessages = response.conversationHistory;
      setMessages(finalMessages);

      // Обновляем чат с финальными сообщениями и убираем флаг загрузки
      if (currentChatId) {
        const newChats = chats.map(c => 
          c.id === currentChatId 
            ? { ...c, messages: finalMessages, updatedAt: new Date().toISOString(), isLoading: false }
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
            ? { ...c, messages: errorMessages, updatedAt: new Date().toISOString(), isLoading: false }
            : c
        );
        saveChats(newChats);
      }
    } finally {
      setLoading(false);
      setIsSending(false);
      sendingRef.current = false;
      inputRef.current?.focus();
    }
  }

  const chatsByFolder = folders.map(folder => ({
    folder,
    chats: chats.filter(c => c.folderId === folder.id)
  }));

  const rootChats = chats.filter(c => !c.folderId);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PsychologistNavbar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Sidebar */}
        <div
          style={{
            width: sidebarOpen ? 280 : 0,
            background: 'var(--surface)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s',
            overflow: 'hidden',
            height: '100%',
            position: 'relative'
          }}
        >
          {sidebarOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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

              {/* Client Mode Toggle and Client Selector */}
              <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'var(--surface-2)' }}>
                {/* Toggle for client mode */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 12, 
                  padding: '12px', 
                  background: 'var(--surface)', 
                  borderRadius: 10, 
                  border: '1px solid rgba(255,255,255,0.08)',
                  marginBottom: 12
                }}>
                  <label style={{ 
                    fontSize: 13, 
                    color: 'var(--text)', 
                    fontWeight: 600, 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 10 
                  }}>
                    <input
                      type="checkbox"
                      checked={clientModeEnabled}
                      onChange={(e) => {
                        setClientModeEnabled(e.target.checked);
                        if (!e.target.checked) {
                          setSelectedClientId(null);
                        }
                      }}
                      style={{
                        width: 20,
                        height: 20,
                        cursor: 'pointer',
                        accentColor: 'var(--primary)'
                      }}
                    />
                    <span>Режим работы с клиентами</span>
                  </label>
                  <div style={{ 
                    fontSize: 11, 
                    color: 'var(--text-muted)', 
                    paddingLeft: 30,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span style={{ 
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: clientModeEnabled ? '#10b981' : '#6b7280',
                      marginRight: 4
                    }}></span>
                    {clientModeEnabled ? 'Доступ к данным клиентов' : 'Обобщенный режим'}
                  </div>
                </div>

                {/* Client selector - показываем только если режим работы с клиентами включен */}
                {clientModeEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Выбор клиента
                    </label>
                    <select
                      value={selectedClientId || ''}
                      onChange={(e) => setSelectedClientId(e.target.value || null)}
                      disabled={loadingClients}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: 13,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.3)';
                        e.currentTarget.style.background = 'var(--surface-2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                        e.currentTarget.style.background = 'var(--surface)';
                      }}
                    >
                      <option value="">Все клиенты</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.email ? `(${client.email})` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedClientId && (
                      <button
                        onClick={() => setSelectedClientId(null)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: 12,
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 8,
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                          e.currentTarget.style.color = '#ef4444';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <span>✕</span>
                        <span>Сбросить выбор</span>
                      </button>
                    )}
                  </div>
                )}
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden', height: '100%' }}>
          {!currentChatId && messages.length === 0 ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 48 }}>
              <div style={{ textAlign: 'center', maxWidth: 600 }}>
                <div style={{ fontSize: 64, marginBottom: 24 }}>🤖</div>
                <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>AI Ассистент психолога</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
                  {clientModeEnabled 
                    ? 'Задавайте вопросы о клиентах, их снах, заметках, сессиях. Я помогу вам с амплификациями, анализом символов, выявлением архетипических паттернов и интерпретацией снов пациентов.'
                    : 'Задавайте общие вопросы по психологии, аналитической психологии, работе с клиентами, интерпретации снов и архетипам. Я помогу вам как обобщенный ассистент психолога без доступа к данным конкретных клиентов.'
                  }
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
              {/* Messages area - scrollable */}
              <div 
                style={{ 
                  flex: 1, 
                  overflowY: 'auto', 
                  overflowX: 'hidden',
                  padding: '32px 0',
                  minHeight: 0,
                  scrollBehavior: 'smooth',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(255,255,255,0.1) transparent',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ maxWidth: 768, margin: '0 auto', padding: '0 24px', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {messages.length === 0 && !loading ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
                      <div style={{ textAlign: 'center', maxWidth: 500 }}>
                        <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.8 }}>💬</div>
                        <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
                          Начните диалог с AI ассистентом
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                          {clientModeEnabled
                            ? 'Задавайте вопросы о клиентах, их снах, заметках и сессиях. Я помогу вам с анализом, интерпретацией и подготовкой к работе с пациентами.'
                            : 'Задавайте общие вопросы по психологии, аналитической психологии, работе с клиентами, интерпретации снов и архетипам. Я работаю как обобщенный ассистент без доступа к данным конкретных клиентов.'
                          }
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                            Попробуйте спросить:
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: 6, 
                            width: '100%',
                            maxWidth: 400
                          }}>
                            {clientModeEnabled ? (
                              <>
                                <div style={{ 
                                  padding: '10px 14px', 
                                  background: 'var(--surface-2)', 
                                  borderRadius: 8, 
                                  fontSize: 13,
                                  color: 'var(--text-muted)',
                                  textAlign: 'left',
                                  border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                  "Дай сводку по клиенту..."
                                </div>
                                <div style={{ 
                                  padding: '10px 14px', 
                                  background: 'var(--surface-2)', 
                                  borderRadius: 8, 
                                  fontSize: 13,
                                  color: 'var(--text-muted)',
                                  textAlign: 'left',
                                  border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                  "Проанализируй последние сны..."
                                </div>
                                <div style={{ 
                                  padding: '10px 14px', 
                                  background: 'var(--surface-2)', 
                                  borderRadius: 8, 
                                  fontSize: 13,
                                  color: 'var(--text-muted)',
                                  textAlign: 'left',
                                  border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                  "Составь план следующей сессии..."
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ 
                                  padding: '10px 14px', 
                                  background: 'var(--surface-2)', 
                                  borderRadius: 8, 
                                  fontSize: 13,
                                  color: 'var(--text-muted)',
                                  textAlign: 'left',
                                  border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                  "Объясни концепцию архетипов Юнга..."
                                </div>
                                <div style={{ 
                                  padding: '10px 14px', 
                                  background: 'var(--surface-2)', 
                                  borderRadius: 8, 
                                  fontSize: 13,
                                  color: 'var(--text-muted)',
                                  textAlign: 'left',
                                  border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                  "Как работать с символами в сновидениях?"
                                </div>
                                <div style={{ 
                                  padding: '10px 14px', 
                                  background: 'var(--surface-2)', 
                                  borderRadius: 8, 
                                  fontSize: 13,
                                  color: 'var(--text-muted)',
                                  textAlign: 'left',
                                  border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                  "Какие техники амплификации можно использовать?"
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            marginBottom: 32,
                            alignItems: 'flex-start'
                          }}
                        >
                          <div
                            style={{
                              maxWidth: '85%',
                              padding: '16px 20px',
                              borderRadius: 18,
                              background: msg.role === 'user'
                                ? 'linear-gradient(135deg, var(--primary), var(--accent))'
                                : 'var(--surface-2)',
                              color: msg.role === 'user' ? '#0b0f1a' : 'var(--text)',
                              lineHeight: 1.6,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontSize: 15,
                              boxShadow: msg.role === 'user' 
                                ? '0 2px 8px rgba(91, 124, 250, 0.2)' 
                                : '0 2px 8px rgba(0, 0, 0, 0.1)'
                            }}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {loading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 32 }}>
                      <div
                        style={{
                          padding: '16px 20px',
                          borderRadius: 18,
                          background: 'var(--surface-2)',
                          color: 'var(--text-muted)',
                          fontSize: 15,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                      >
                        <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>●</span>
                        <span>Думаю...</span>
                      </div>
                    </div>
                      )}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
              </div>

              {/* Input area - fixed at bottom */}
              <div 
                style={{ 
                  borderTop: '1px solid rgba(255,255,255,0.08)', 
                  background: 'var(--surface)',
                  padding: '16px 0'
                }}
              >
                <div style={{ maxWidth: 768, margin: '0 auto', padding: '0 24px', width: '100%' }}>
                    <div style={{ 
                      display: 'flex', 
                      gap: 10, 
                      flexWrap: 'wrap',
                      marginBottom: 16,
                      padding: '14px 16px',
                      background: 'linear-gradient(135deg, rgba(91, 124, 250, 0.08), rgba(139, 92, 246, 0.08))',
                      borderRadius: 12,
                      border: '1px solid rgba(91, 124, 250, 0.15)',
                      boxShadow: '0 2px 8px rgba(91, 124, 250, 0.05)'
                    }}>
                      <div style={{ 
                        width: '100%', 
                        fontSize: 11, 
                        color: 'var(--text-muted)', 
                        fontWeight: 600, 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.5px',
                        marginBottom: 8
                      }}>
                        Быстрые действия
                      </div>
                      <button
                        onClick={async () => {
                          const selectedClient = clients.find(c => c.id === selectedClientId);
                          const prompt = `Дай сводку по клиенту ${selectedClient?.name || 'выбранному клиенту'}. Включи информацию о снах, записях в дневнике, сессиях, заметках и рабочей области.`;
                          setInput(prompt);
                          setTimeout(() => {
                            inputRef.current?.focus();
                            if (inputRef.current) {
                              inputRef.current.style.height = 'auto';
                              inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
                            }
                          }, 0);
                        }}
                        disabled={loading || isSending}
                        style={{
                          padding: '10px 16px',
                          fontSize: 13,
                          background: 'linear-gradient(135deg, rgba(91, 124, 250, 0.15), rgba(139, 92, 246, 0.15))',
                          border: '1px solid rgba(91, 124, 250, 0.3)',
                          borderRadius: 8,
                          color: 'var(--primary)',
                          cursor: (loading || isSending) ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s',
                          opacity: (loading || isSending) ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 4px rgba(91, 124, 250, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          if (!loading && !isSending) {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(91, 124, 250, 0.2), rgba(139, 92, 246, 0.2))';
                            e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.4)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(91, 124, 250, 0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(91, 124, 250, 0.15), rgba(139, 92, 246, 0.15))';
                          e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.3)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(91, 124, 250, 0.1)';
                        }}
                      >
                        <span>📊</span>
                        <span>Сводка</span>
                      </button>
                      <button
                        onClick={async () => {
                          const selectedClient = clients.find(c => c.id === selectedClientId);
                          const prompt = `Сформулируй гипотезы по клиенту ${selectedClient?.name || 'выбранному клиенту'} на основе его снов, записей в дневнике и сессий. Укажи паттерны, архетипы и возможные интерпретации.`;
                          setInput(prompt);
                          setTimeout(() => {
                            inputRef.current?.focus();
                            if (inputRef.current) {
                              inputRef.current.style.height = 'auto';
                              inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
                            }
                          }, 0);
                        }}
                        disabled={loading || isSending}
                        style={{
                          padding: '10px 16px',
                          fontSize: 13,
                          background: 'linear-gradient(135deg, rgba(91, 124, 250, 0.15), rgba(139, 92, 246, 0.15))',
                          border: '1px solid rgba(91, 124, 250, 0.3)',
                          borderRadius: 8,
                          color: 'var(--primary)',
                          cursor: (loading || isSending) ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s',
                          opacity: (loading || isSending) ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 4px rgba(91, 124, 250, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          if (!loading && !isSending) {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(91, 124, 250, 0.2), rgba(139, 92, 246, 0.2))';
                            e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.4)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(91, 124, 250, 0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(91, 124, 250, 0.15), rgba(139, 92, 246, 0.15))';
                          e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.3)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(91, 124, 250, 0.1)';
                        }}
                      >
                        <span>💡</span>
                        <span>Гипотезы</span>
                      </button>
                      <button
                        onClick={async () => {
                          const selectedClient = clients.find(c => c.id === selectedClientId);
                          const prompt = `Составь план следующей сессии для клиента ${selectedClient?.name || 'выбранного клиента'}. Учти последние сны, записи в дневнике, предыдущие сессии и заметки. Предложи темы для обсуждения и упражнения.`;
                          setInput(prompt);
                          setTimeout(() => {
                            inputRef.current?.focus();
                            if (inputRef.current) {
                              inputRef.current.style.height = 'auto';
                              inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
                            }
                          }, 0);
                        }}
                        disabled={loading || isSending}
                        style={{
                          padding: '10px 16px',
                          fontSize: 13,
                          background: 'linear-gradient(135deg, rgba(91, 124, 250, 0.15), rgba(139, 92, 246, 0.15))',
                          border: '1px solid rgba(91, 124, 250, 0.3)',
                          borderRadius: 8,
                          color: 'var(--primary)',
                          cursor: (loading || isSending) ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s',
                          opacity: (loading || isSending) ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 4px rgba(91, 124, 250, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          if (!loading && !isSending) {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(91, 124, 250, 0.2), rgba(139, 92, 246, 0.2))';
                            e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.4)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(91, 124, 250, 0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(91, 124, 250, 0.15), rgba(139, 92, 246, 0.15))';
                          e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.3)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(91, 124, 250, 0.1)';
                        }}
                      >
                        <span>📋</span>
                        <span>План сессии</span>
                      </button>
                    </div>
                  )}

                  {!clientModeEnabled && (
                    <div style={{ 
                      marginBottom: 12,
                      padding: '12px',
                      background: 'var(--surface-2)',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.05)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Включите режим работы с клиентами для быстрых действий
                      </div>
                    </div>
                  )}
                </div>

                  {/* Input field */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => {
                          setInput(e.target.value);
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (!loading && !isSending) {
                              sendMessage();
                            }
                          }
                        }}
                        placeholder="Напишите сообщение..."
                        disabled={loading || isSending}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          paddingRight: 48,
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'var(--surface-2)',
                          color: 'var(--text)',
                          fontSize: 15,
                          fontFamily: 'inherit',
                          resize: 'none',
                          minHeight: 24,
                          maxHeight: 200,
                          lineHeight: 1.5,
                          overflow: 'hidden',
                          transition: 'border-color 0.2s'
                        }}
                        rows={1}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.4)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                        }}
                      />
                    </div>
                    <button
                      className="button"
                      onClick={sendMessage}
                      disabled={!input.trim() || loading || isSending}
                      style={{
                        padding: '12px 20px',
                        fontSize: 15,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        opacity: (!input.trim() || loading || isSending) ? 0.5 : 1,
                        cursor: (!input.trim() || loading || isSending) ? 'not-allowed' : 'pointer',
                        minWidth: 100,
                        height: 48
                      }}
                    >
                      {loading || isSending ? '...' : 'Отправить'}
                    </button>
                  </div>
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
      
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
}

