import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { PlatformIcon } from '../../components/icons';
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

type Shortcut = {
  id: string;
  label: string;
  emoji: string;
  prompt: string;
  createdAt: string;
};

const STORAGE_KEY = 'psychologist_ai_chats';
const FOLDERS_STORAGE_KEY = 'psychologist_ai_folders';
const SHORTCUTS_STORAGE_KEY = 'psychologist_ai_shortcuts';

// Популярные эмодзи для шорткастов (организованы по категориям)
const EMOJI_CATEGORIES = [
  {
    name: 'Действия',
    emojis: ['📊', '💡', '📋', '📝', '✏️', '📌', '🔍', '📈', '📉', '📑', '📄', '📃']
  },
  {
    name: 'Эмоции и состояния',
    emojis: ['😊', '😢', '😡', '😰', '😴', '🤔', '😌', '😎', '🙂', '😐', '😟', '😄']
  },
  {
    name: 'Объекты',
    emojis: ['💎', '🔮', '⭐', '🌟', '✨', '💫', '🔥', '💧', '🌊', '🌙', '☀️', '🌈']
  },
  {
    name: 'Символы',
    emojis: ['✅', '❌', '⚠️', '❗', '❓', '💬', '🔔', '🔕', '📢', '📣', '🎯', '🎪']
  },
  {
    name: 'Люди',
    emojis: ['👤', '👥', '👨', '👩', '🧑', '👶', '👴', '👵', '🧓', '👨‍⚕️', '👩‍⚕️', '🧑‍⚕️']
  },
  {
    name: 'Природа',
    emojis: ['🌳', '🌲', '🌴', '🌱', '🌿', '🍃', '🌾', '🌷', '🌹', '🌺', '🌸', '🌻']
  }
];

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
  const [clients, setClients] = useState<Array<{ id: string; name: string; email?: string; avatarUrl?: string }>>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientModeEnabled, setClientModeEnabled] = useState(true); // Тумблер для работы с клиентами
  const [showClientsDropdown, setShowClientsDropdown] = useState(false);
  const [isSending, setIsSending] = useState(false); // Дополнительная блокировка отправки
  const [isMobileView, setIsMobileView] = useState(false);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showAddShortcutModal, setShowAddShortcutModal] = useState(false);
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);
  const [newShortcutLabel, setNewShortcutLabel] = useState('');
  const [newShortcutEmoji, setNewShortcutEmoji] = useState('📝');
  const [newShortcutPrompt, setNewShortcutPrompt] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false); // Ref для предотвращения двойной отправки

  useEffect(() => {
    loadChats();
    loadFolders();
    loadShortcuts();
    // Загружаем клиентов только если режим работы с клиентами включен
    if (clientModeEnabled) {
      loadClients();
    }
  }, [clientModeEnabled]);

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  async function loadClients() {
    if (!token) return;
    setLoadingClients(true);
    try {
      const res = await api<{ items: Array<{ id: string; name: string; email?: string; avatarUrl?: string; profile?: { avatarUrl?: string } }> }>('/api/clients', { token });
      setClients((res.items || []).map(item => ({
        id: item.id,
        name: item.name,
        email: item.email,
        avatarUrl: item.avatarUrl || item.profile?.avatarUrl
      })));
    } catch (e) {
      console.error('Failed to load clients:', e);
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }

  // Close clients dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const dropdown = document.querySelector('[data-clients-dropdown]');
      if (dropdown && !dropdown.contains(target)) {
        setShowClientsDropdown(false);
      }
    };
    if (showClientsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showClientsDropdown]);

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

  // Закрываем селектор эмодзи при клике вне его
  useEffect(() => {
    if (showEmojiPicker) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-emoji-picker]')) {
          setShowEmojiPicker(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);

  async function loadChats() {
    if (!token) return;
    try {
      const res = await api<{ chats: Chat[]; folders: Folder[]; shortcuts: Shortcut[] }>('/api/ai/psychologist/chats', { token });
      const loadedChats = (res.chats || []).map((chat: any) => ({
        ...chat,
        isLoading: false
      }));
      setChats(loadedChats);
      setFolders(res.folders || []);
      setShortcuts(res.shortcuts || []);
    } catch (e) {
      console.error('Failed to load chats from API:', e);
      // Fallback to localStorage if API fails
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const loadedChats = Array.isArray(parsed) ? parsed : [];
          setChats(loadedChats.map((chat: Chat) => ({ ...chat, isLoading: false })));
        }
      } catch (localError) {
        console.error('Failed to load from localStorage:', localError);
      }
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

  async function saveChats(newChats: Chat[]) {
    if (!token) {
      setChats(newChats);
      return;
    }
    
    // Save each chat to backend and update IDs if needed
    const updatedChats = await Promise.all(
      newChats.map(async (chat) => {
        try {
          const saved = await api<Chat>('/api/ai/psychologist/chats', {
            method: 'POST',
            token,
            body: {
              id: chat.id,
              title: chat.title,
              messages: chat.messages,
              folderId: chat.folderId,
              clientId: selectedClientId
            }
          });
          // Используем ID, который вернул сервер (важно для новых чатов)
          return { ...chat, id: saved.id, createdAt: saved.createdAt, updatedAt: saved.updatedAt };
        } catch (e) {
          console.error('Failed to save chat to backend:', e);
          return chat; // Возвращаем оригинальный чат при ошибке
        }
      })
    );
    
    setChats(updatedChats);
  }

  async function saveFolders(newFolders: Folder[]) {
    setFolders(newFolders);
    // Save each folder to backend
    if (!token) return;
    for (const folder of newFolders) {
      try {
        await api('/api/ai/psychologist/folders', {
          method: 'POST',
          token,
          body: {
            id: folder.id,
            name: folder.name
          }
        });
      } catch (e) {
        console.error('Failed to save folder:', e);
      }
    }
  }

  function loadShortcuts() {
    try {
      const saved = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setShortcuts(Array.isArray(parsed) ? parsed : []);
      } else {
        // Инициализируем дефолтные шорткасты
        const defaultShortcuts: Shortcut[] = [
          {
            id: 'shortcut-1',
            label: 'Сводка',
            emoji: '📊',
            prompt: 'Дай сводку по клиенту {clientName}. Включи информацию о снах, записях в дневнике, сессиях, заметках и рабочей области.',
            createdAt: new Date().toISOString()
          },
          {
            id: 'shortcut-2',
            label: 'Гипотезы',
            emoji: '💡',
            prompt: 'Сформулируй гипотезы по клиенту {clientName} на основе его снов, записей в дневнике и сессий. Укажи паттерны, архетипы и возможные интерпретации.',
            createdAt: new Date().toISOString()
          },
          {
            id: 'shortcut-3',
            label: 'План сессии',
            emoji: '📋',
            prompt: 'Составь план следующей сессии для клиента {clientName}. Учти последние сны, записи в дневнике, предыдущие сессии и заметки. Предложи темы для обсуждения и упражнения.',
            createdAt: new Date().toISOString()
          }
        ];
        setShortcuts(defaultShortcuts);
        saveShortcuts(defaultShortcuts);
      }
    } catch (e) {
      console.error('Failed to load shortcuts:', e);
      setShortcuts([]);
    }
  }

  async function saveShortcuts(newShortcuts: Shortcut[]) {
    setShortcuts(newShortcuts);
    // Save each shortcut to backend
    if (!token) return;
    for (const shortcut of newShortcuts) {
      try {
        await api('/api/ai/psychologist/shortcuts', {
          method: 'POST',
          token,
          body: {
            id: shortcut.id,
            label: shortcut.label,
            emoji: shortcut.emoji,
            prompt: shortcut.prompt
          }
        });
      } catch (e) {
        console.error('Failed to save shortcut:', e);
      }
    }
  }

  function addShortcut() {
    if (!newShortcutLabel.trim() || !newShortcutPrompt.trim()) {
      alert('Заполните название и промпт');
      return;
    }
    const newShortcut: Shortcut = {
      id: `shortcut-${Date.now()}-${Math.random()}`,
      label: newShortcutLabel.trim(),
      emoji: newShortcutEmoji || '📝',
      prompt: newShortcutPrompt.trim(),
      createdAt: new Date().toISOString()
    };
    saveShortcuts([...shortcuts, newShortcut]);
    cancelEditShortcut();
  }

  function updateShortcut(shortcutId: string) {
    if (!newShortcutLabel.trim() || !newShortcutPrompt.trim()) {
      alert('Заполните название и промпт');
      return;
    }
    const updatedShortcuts = shortcuts.map(s =>
      s.id === shortcutId
        ? {
            ...s,
            label: newShortcutLabel.trim(),
            emoji: newShortcutEmoji || '📝',
            prompt: newShortcutPrompt.trim()
          }
        : s
    );
    saveShortcuts(updatedShortcuts);
    cancelEditShortcut();
  }

  async function deleteShortcut(shortcutId: string) {
    if (!window.confirm('Удалить этот шорткаст?')) return;
    if (token) {
      try {
        await api(`/api/ai/psychologist/shortcuts/${shortcutId}`, { method: 'DELETE', token });
      } catch (e) {
        console.error('Failed to delete shortcut from backend:', e);
      }
    }
    setShortcuts(shortcuts.filter(s => s.id !== shortcutId));
  }

  function startEditShortcut(shortcut: Shortcut) {
    setEditingShortcutId(shortcut.id);
    setNewShortcutLabel(shortcut.label);
    setNewShortcutEmoji(shortcut.emoji);
    setNewShortcutPrompt(shortcut.prompt);
    setShowAddShortcutModal(true);
    setShowEmojiPicker(false);
  }

  function cancelEditShortcut() {
    setEditingShortcutId(null);
    setNewShortcutLabel('');
    setNewShortcutEmoji('📝');
    setNewShortcutPrompt('');
    setShowAddShortcutModal(false);
    setShowEmojiPicker(false);
  }

  function handleShortcutClick(shortcut: Shortcut) {
    const selectedClient = clients.find(c => c.id === selectedClientId);
    const prompt = shortcut.prompt.replace(/{clientName}/g, selectedClient?.name || 'выбранному клиенту');
    setInput(prompt);
    setTimeout(() => {
      inputRef.current?.focus();
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
      }
    }, 0);
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

  async function deleteChat(chatId: string) {
    if (!window.confirm('Удалить этот чат?')) return;
    if (token) {
      try {
        await api(`/api/ai/psychologist/chats/${encodeURIComponent(chatId)}`, { method: 'DELETE', token });
      } catch (e: unknown) {
        console.error('Failed to delete chat from backend:', e);
        const status = (e as { status?: number })?.status;
        if (status !== 404) {
          alert((e as Error)?.message || 'Не удалось удалить чат');
          return;
        }
      }
    }
    const newChats = chats.filter(c => c.id !== chatId);
    setChats(newChats);
    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setMessages([]);
    }
  }

  async function deleteFolder(folderId: string) {
    if (!window.confirm('Удалить эту папку? Все чаты в ней будут перемещены в корень.')) return;
    if (token) {
      try {
        await api(`/api/ai/psychologist/folders/${folderId}`, { method: 'DELETE', token });
      } catch (e) {
        console.error('Failed to delete folder from backend:', e);
      }
    }
    const newFolders = folders.filter(f => f.id !== folderId);
    const newChats = chats.map(c => c.folderId === folderId ? { ...c, folderId: null } : c);
    setFolders(newFolders);
    setChats(newChats);
    // Save updated chats
    for (const chat of newChats.filter(c => c.folderId === null && chats.find(old => old.id === c.id)?.folderId === folderId)) {
      try {
        await api('/api/ai/psychologist/chats', {
          method: 'POST',
          token: token!,
          body: {
            id: chat.id,
            title: chat.title,
            messages: chat.messages,
            folderId: null,
            clientId: selectedClientId
          }
        });
      } catch (e) {
        console.error('Failed to update chat:', e);
      }
    }
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
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        {/* Overlay для мобильной версии */}
        {isMobileView && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 99,
              transition: 'opacity 0.3s'
            }}
          />
        )}
        {/* Sidebar */}
        <div
          style={{
            width: sidebarOpen ? (isMobileView ? '100%' : 280) : 0,
            background: 'var(--surface)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s',
            overflow: 'hidden',
            height: '100%',
            position: isMobileView ? 'absolute' : 'relative',
            zIndex: isMobileView && sidebarOpen ? 100 : 'auto',
            left: 0,
            top: 0
          }}
        >
          {sidebarOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  className="button"
                  onClick={() => createNewChat()}
                  style={{ width: '100%', padding: '12px', fontSize: isMobileView ? 12 : 14, fontWeight: 600 }}
                >
                  + Новый чат
                </button>
                <button
                  className="button secondary"
                  onClick={() => setShowNewFolderModal(true)}
                  style={{ width: '100%', padding: '10px', marginTop: 8, fontSize: isMobileView ? 11 : 13 }}
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
                          padding: '10px 14px',
                          borderRadius: 10,
                          marginBottom: 8,
                          background: currentChatId === chat.id ? 'rgba(91, 124, 250, 0.15)' : 'var(--surface)',
                          border: currentChatId === chat.id 
                            ? '2px solid var(--primary)' 
                            : '1px solid rgba(255,255,255,0.08)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          position: 'relative',
                          transition: 'all 0.2s ease',
                          boxShadow: currentChatId === chat.id 
                            ? '0 2px 8px rgba(91, 124, 250, 0.2)' 
                            : '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                        onClick={() => {
                          setCurrentChatId(chat.id);
                          if (isMobileView) {
                            setSidebarOpen(false);
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (currentChatId !== chat.id) {
                            e.currentTarget.style.background = 'var(--surface-2)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                          }
                          // Показываем подсказку о переименовании
                          const hint = e.currentTarget.querySelector('.rename-hint') as HTMLElement;
                          if (hint) hint.style.display = 'inline';
                        }}
                        onMouseLeave={(e) => {
                          if (currentChatId !== chat.id) {
                            e.currentTarget.style.background = 'var(--surface)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                          }
                          // Скрываем подсказку
                          const hint = e.currentTarget.querySelector('.rename-hint') as HTMLElement;
                          if (hint) hint.style.display = 'none';
                        }}
                      >
                        <span style={{ fontSize: isMobileView ? 14 : 16 }}>💬</span>
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
                                fontSize: isMobileView ? 11 : 13,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontWeight: currentChatId === chat.id ? 600 : 400,
                                color: currentChatId === chat.id ? 'var(--primary)' : 'var(--text)',
                                position: 'relative'
                              }}
                              onDoubleClick={() => {
                                setEditingChatId(chat.id);
                                setEditingChatTitle(chat.title);
                              }}
                              title="Двойной клик для переименования"
                            >
                              {chat.title}
                            </span>
                            <span 
                              style={{ 
                                fontSize: 10, 
                                opacity: 0.5, 
                                color: 'var(--text-muted)',
                                marginLeft: 4,
                                display: 'none'
                              }}
                              className="rename-hint"
                            >
                              ✏️
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
                                  fontSize: isMobileView ? 10 : 11,
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
                                fontSize: isMobileView ? 10 : 12,
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
                      <span style={{ fontSize: isMobileView ? 12 : 14 }}>📁</span>
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
                              fontSize: isMobileView ? 11 : 13,
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
                              fontSize: isMobileView ? 10 : 12,
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
                            padding: '10px 14px',
                            borderRadius: 10,
                            marginBottom: 8,
                            background: currentChatId === chat.id ? 'rgba(91, 124, 250, 0.15)' : 'var(--surface)',
                            border: currentChatId === chat.id 
                              ? '2px solid var(--primary)' 
                              : '1px solid rgba(255,255,255,0.08)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            transition: 'all 0.2s ease',
                            boxShadow: currentChatId === chat.id 
                              ? '0 2px 8px rgba(91, 124, 250, 0.2)' 
                              : '0 1px 3px rgba(0,0,0,0.1)'
                          }}
                          onClick={() => {
                          setCurrentChatId(chat.id);
                          if (isMobileView) {
                            setSidebarOpen(false);
                          }
                        }}
                          onMouseEnter={(e) => {
                            if (currentChatId !== chat.id) {
                              e.currentTarget.style.background = 'var(--surface-2)';
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                            }
                            // Показываем подсказку о переименовании
                            const hint = e.currentTarget.querySelector('.rename-hint') as HTMLElement;
                            if (hint) hint.style.display = 'inline';
                          }}
                          onMouseLeave={(e) => {
                            if (currentChatId !== chat.id) {
                              e.currentTarget.style.background = 'var(--surface)';
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                            }
                            // Скрываем подсказку
                            const hint = e.currentTarget.querySelector('.rename-hint') as HTMLElement;
                            if (hint) hint.style.display = 'none';
                          }}
                        >
                          <span style={{ fontSize: isMobileView ? 12 : 14 }}>💬</span>
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
                                  fontSize: isMobileView ? 11 : 13,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontWeight: currentChatId === chat.id ? 600 : 400,
                                  color: currentChatId === chat.id ? 'var(--primary)' : 'var(--text)',
                                  position: 'relative'
                                }}
                                onDoubleClick={() => {
                                  setEditingChatId(chat.id);
                                  setEditingChatTitle(chat.title);
                                }}
                                title="Двойной клик для переименования"
                              >
                                {chat.title}
                              </span>
                              <span 
                                style={{ 
                                  fontSize: isMobileView ? 9 : 10, 
                                  opacity: 0.5, 
                                  color: 'var(--text-muted)',
                                  marginLeft: 4,
                                  display: 'none'
                                }}
                                className="rename-hint"
                              >
                                ✏️
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
                                    fontSize: isMobileView ? 10 : 11,
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
                                  fontSize: isMobileView ? 10 : 12,
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
                          fontSize: isMobileView ? 10 : 12
                        }}
                      >
                        + Чат в папке
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Client Mode Toggle and Client Selector - внизу сайдбара */}
              <div style={{ 
                padding: 16, 
                borderTop: '1px solid rgba(255,255,255,0.08)', 
                background: 'var(--surface-2)',
                marginTop: 'auto'
              }}>
                {/* Client selector - показываем только если режим работы с клиентами включен */}
                {clientModeEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    <label style={{ fontSize: isMobileView ? 10 : 12, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Выбор клиента
                    </label>
                    {selectedClientId ? (
                      <div style={{ position: 'relative' }} data-clients-dropdown>
                        <button
                          onClick={() => setShowClientsDropdown(!showClientsDropdown)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 16px',
                            borderRadius: 10,
                            border: 'none',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            width: '100%'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--surface-2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--surface)';
                          }}
                        >
                          {(() => {
                            const currentClient = clients.find(c => c.id === selectedClientId);
                            if (!currentClient) return null;
                            const avatarUrl = currentClient.avatarUrl;
                            return avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={currentClient.name || 'Аватар'}
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '2px solid rgba(255,255,255,0.1)',
                                  flexShrink: 0
                                }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent && !parent.querySelector('.avatar-fallback')) {
                                    const fallback = document.createElement('div');
                                    fallback.className = 'avatar-fallback';
                                    fallback.style.cssText = 'width: 40px; height: 40px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 700; font-size: 16px; flex-shrink: 0;';
                                    fallback.textContent = (currentClient.name || '?').trim().charAt(0).toUpperCase();
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                                {(currentClient.name || '?').trim().charAt(0).toUpperCase()}
                              </div>
                            );
                          })()}
                          <div style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                              {clients.find(c => c.id === selectedClientId)?.name || 'Клиент'}
                            </div>
                            <div className="small" style={{ fontSize: 12, opacity: .8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                              {clients.find(c => c.id === selectedClientId)?.email || '—'}
                            </div>
                          </div>
                          <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0 }}>▼</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowClientsDropdown(true)}
                        disabled={loadingClients}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'var(--surface)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontSize: isMobileView ? 11 : 13,
                          textAlign: 'left'
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
                        {loadingClients ? 'Загрузка...' : 'Выберите клиента'}
                      </button>
                    )}
                  </div>
                )}

                {/* Toggle for client mode */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 12, 
                  padding: '12px', 
                  background: 'var(--surface)', 
                  borderRadius: 10, 
                  border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  <label style={{ 
                    fontSize: isMobileView ? 11 : 13, 
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
                    fontSize: isMobileView ? 10 : 11, 
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
              </div>
            </div>
          )}
        </div>

        {/* Toggle sidebar button - только на десктопе */}
        {!isMobileView && (
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
        )}

        {/* Main chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden', height: '100%' }}>
          {/* Mobile back button */}
          {isMobileView && currentChatId && (
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0
            }}>
              <button
                onClick={() => {
                  setSidebarOpen(true);
                  setCurrentChatId(null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 18,
                  flexShrink: 0
                }}
                title="Назад к чатам"
              >
                ←
              </button>
              <div style={{ 
                fontWeight: 600, 
                fontSize: 14, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap', 
                flex: 1,
                color: 'var(--text)'
              }}>
                {chats.find(c => c.id === currentChatId)?.title || 'Чат'}
              </div>
            </div>
          )}
          {!currentChatId && messages.length === 0 ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 48 }}>
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
                <h2 style={{ fontSize: isMobileView ? 20 : 28, fontWeight: 700, marginBottom: 12 }}>AI Ассистент психолога</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: isMobileView ? 13 : 16, lineHeight: 1.6, marginBottom: 32 }}>
                  {clientModeEnabled 
                    ? 'Задавайте вопросы о клиентах, их снах, заметках, сессиях. Я помогу вам с амплификациями, анализом символов, выявлением архетипических паттернов и интерпретацией снов пациентов.'
                    : 'Задавайте общие вопросы по психологии, аналитической психологии, работе с клиентами, интерпретации снов и архетипам. Я помогу вам как обобщенный ассистент психолога без доступа к данным конкретных клиентов.'
                  }
                </p>
                <button
                  className="button"
                  onClick={() => createNewChat()}
                  style={{ padding: '12px 24px', fontSize: isMobileView ? 13 : 15 }}
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
                        <h3 style={{ fontSize: isMobileView ? 16 : 22, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
                          Начните диалог с AI ассистентом
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: isMobileView ? 12 : 15, lineHeight: 1.6, marginBottom: 24 }}>
                          {clientModeEnabled
                            ? 'Задавайте вопросы о клиентах, их снах, заметках и сессиях. Я помогу вам с анализом, интерпретацией и подготовкой к работе с пациентами.'
                            : 'Задавайте общие вопросы по психологии, аналитической психологии, работе с клиентами, интерпретации снов и архетипам. Я работаю как обобщенный ассистент без доступа к данным конкретных клиентов.'
                          }
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: isMobileView ? 11 : 13, color: 'var(--text-muted)', marginBottom: 8 }}>
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
                                  fontSize: isMobileView ? 11 : 13,
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
                                  fontSize: isMobileView ? 11 : 13,
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
                                  fontSize: isMobileView ? 11 : 13,
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
                                  fontSize: isMobileView ? 11 : 13,
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
                                  fontSize: isMobileView ? 11 : 13,
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
                                  fontSize: isMobileView ? 11 : 13,
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
                              fontSize: isMobileView ? 13 : 15,
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
                          fontSize: isMobileView ? 13 : 15,
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
                  {/* Shortcut buttons - показываем только если режим работы с клиентами включен и выбран клиент */}
                  {clientModeEnabled && selectedClientId && shortcuts.length > 0 && (
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
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8
                      }}>
                        <div style={{ 
                          fontSize: isMobileView ? 10 : 11, 
                          color: 'var(--text-muted)', 
                          fontWeight: 600, 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.5px'
                        }}>
                          Быстрые действия
                        </div>
                        <button
                          onClick={() => setShowShortcutsModal(true)}
                          style={{
                            padding: '6px 12px',
                            fontSize: isMobileView ? 10 : 11,
                            background: 'rgba(91, 124, 250, 0.1)',
                            border: '1px solid rgba(91, 124, 250, 0.2)',
                            borderRadius: 6,
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontWeight: 500,
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(91, 124, 250, 0.15)';
                            e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(91, 124, 250, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.2)';
                          }}
                        >
                          ⚙️ Настроить
                        </button>
                      </div>
                      {shortcuts.map(shortcut => (
                          <button
                            key={shortcut.id}
                            onClick={() => handleShortcutClick(shortcut)}
                            disabled={loading || isSending}
                            style={{
                              padding: '10px 16px',
                              fontSize: isMobileView ? 11 : 13,
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
                            <span>{shortcut.emoji}</span>
                            <span>{shortcut.label}</span>
                          </button>
                      ))}
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
                          fontSize: isMobileView ? 13 : 15,
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

      {/* Shortcuts management modal */}
      {showShortcutsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 20
          }}
          onClick={() => {
            setShowShortcutsModal(false);
            if (showAddShortcutModal) {
              cancelEditShortcut();
            }
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 600,
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              border: '1px solid rgba(255,255,255,0.12)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Настройка команд</h3>
              <button
                onClick={() => {
                  setShowShortcutsModal(false);
                  if (showAddShortcutModal) {
                    cancelEditShortcut();
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 24,
                  cursor: 'pointer',
                  padding: 0,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = 'var(--text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              {shortcuts.length === 0 ? (
                <div style={{ 
                  padding: 24, 
                  textAlign: 'center', 
                  color: 'var(--text-muted)',
                  fontSize: 14
                }}>
                  Нет созданных команд. Добавьте первую команду!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {shortcuts.map(shortcut => (
                    <div
                      key={shortcut.id}
                      style={{
                        padding: 12,
                        background: 'var(--surface-2)',
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                      }}
                    >
                      <div style={{ fontSize: 24 }}>{shortcut.emoji}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{shortcut.label}</div>
                        <div style={{ fontSize: isMobileView ? 10 : 12, color: 'var(--text-muted)', wordBreak: 'break-word' }}>
                          {shortcut.prompt.length > 60 ? shortcut.prompt.substring(0, 60) + '...' : shortcut.prompt}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => startEditShortcut(shortcut)}
                          style={{
                            padding: '6px 12px',
                            fontSize: isMobileView ? 10 : 12,
                            background: 'rgba(91, 124, 250, 0.1)',
                            border: '1px solid rgba(91, 124, 250, 0.2)',
                            borderRadius: 6,
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontWeight: 500
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteShortcut(shortcut.id)}
                          style={{
                            padding: '6px 12px',
                            fontSize: isMobileView ? 10 : 12,
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 6,
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontWeight: 500
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              className="button"
              onClick={() => {
                setEditingShortcutId(null);
                setNewShortcutLabel('');
                setNewShortcutEmoji('📝');
                setNewShortcutPrompt('');
                setShowAddShortcutModal(true);
                setShowEmojiPicker(false);
              }}
              style={{ width: '100%', padding: '12px' }}
            >
              + Добавить команду
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit shortcut modal */}
      {showAddShortcutModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: 20
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cancelEditShortcut();
            }
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 500,
              width: '100%',
              border: '1px solid rgba(255,255,255,0.12)'
            }}
            onClick={(e) => {
              e.stopPropagation();
              // Закрываем селектор эмодзи при клике на модалку
              if (showEmojiPicker) {
                setShowEmojiPicker(false);
              }
            }}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700 }}>
              {editingShortcutId ? 'Редактировать команду' : 'Добавить команду'}
            </h3>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Эмодзи
              </label>
              <div style={{ position: 'relative' }} data-emoji-picker>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    fontSize: 24,
                    textAlign: 'center',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface-3)';
                    e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface-2)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                  }}
                >
                  <span>{newShortcutEmoji || '📝'}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>▼</span>
                </button>
                
                {showEmojiPicker && (
                  <div
                    data-emoji-picker
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 8,
                      background: 'var(--surface)',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      padding: 16,
                      maxHeight: 300,
                      overflowY: 'auto',
                      zIndex: 10002,
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    {EMOJI_CATEGORIES.map((category, catIdx) => (
                      <div key={catIdx} style={{ marginBottom: catIdx < EMOJI_CATEGORIES.length - 1 ? 16 : 0 }}>
                        <div style={{ 
                          fontSize: isMobileView ? 10 : 11, 
                          fontWeight: 600, 
                          color: 'var(--text-muted)', 
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: 8,
                          paddingBottom: 4,
                          borderBottom: '1px solid rgba(255,255,255,0.05)'
                        }}>
                          {category.name}
                        </div>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(6, 1fr)', 
                          gap: 8 
                        }}>
                          {category.emojis.map((emoji, emojiIdx) => (
                            <button
                              key={emojiIdx}
                              type="button"
                              onClick={() => {
                                setNewShortcutEmoji(emoji);
                                setShowEmojiPicker(false);
                              }}
                              style={{
                                padding: '8px',
                                fontSize: 20,
                                background: newShortcutEmoji === emoji ? 'rgba(91, 124, 250, 0.2)' : 'transparent',
                                border: newShortcutEmoji === emoji 
                                  ? '1px solid rgba(91, 124, 250, 0.4)' 
                                  : '1px solid rgba(255,255,255,0.05)',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => {
                                if (newShortcutEmoji !== emoji) {
                                  e.currentTarget.style.background = 'var(--surface-2)';
                                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (newShortcutEmoji !== emoji) {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                }
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Название
              </label>
              <input
                type="text"
                value={newShortcutLabel}
                onChange={e => setNewShortcutLabel(e.target.value)}
                placeholder="Название команды"
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
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Промпт (используйте {`{clientName}`} для подстановки имени клиента)
              </label>
              <textarea
                value={newShortcutPrompt}
                onChange={e => setNewShortcutPrompt(e.target.value)}
                placeholder="Введите промпт для команды..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="button secondary"
                onClick={cancelEditShortcut}
                style={{ padding: '10px 20px' }}
              >
                Отмена
              </button>
              <button
                className="button"
                onClick={editingShortcutId ? () => updateShortcut(editingShortcutId) : addShortcut}
                disabled={!newShortcutLabel.trim() || !newShortcutPrompt.trim()}
                style={{ padding: '10px 20px' }}
              >
                {editingShortcutId ? 'Сохранить' : 'Добавить'}
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

      {/* Bottom sheet for client selection */}
      {showClientsDropdown && clientModeEnabled && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease'
          }}
          onClick={() => setShowClientsDropdown(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              width: '100%',
              maxWidth: 600,
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideUp 0.3s ease',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Выберите клиента</h3>
              <button
                onClick={() => setShowClientsDropdown(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = 'var(--text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                ×
              </button>
            </div>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px'
            }}>
              <button
                onClick={() => {
                  setSelectedClientId(null);
                  setShowClientsDropdown(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px',
                  borderRadius: 8,
                  border: 'none',
                  background: !selectedClientId ? 'rgba(91, 124, 250, 0.15)' : 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.2s',
                  marginBottom: 4
                }}
                onMouseEnter={(e) => {
                  if (selectedClientId) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedClientId) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 20 }}>👥</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>Все клиенты</div>
                  <div style={{ fontSize: 12, opacity: 0.7, color: 'var(--text-muted)' }}>Обобщенный режим</div>
                </div>
              </button>
              {clients.map(client => {
                const active = client.id === selectedClientId;
                return (
                  <button
                    key={client.id}
                    onClick={() => {
                      setSelectedClientId(client.id);
                      setShowClientsDropdown(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px',
                      borderRadius: 8,
                      border: 'none',
                      background: active ? 'rgba(91, 124, 250, 0.15)' : 'transparent',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.2s',
                      marginBottom: 4
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {client.avatarUrl ? (
                      <img
                        src={client.avatarUrl}
                        alt={client.name || 'Аватар'}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid rgba(255,255,255,0.1)',
                          flexShrink: 0
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.avatar-fallback')) {
                            const fallback = document.createElement('div');
                            fallback.className = 'avatar-fallback';
                            fallback.style.cssText = 'width: 40px; height: 40px; border-radius: 999px; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #0b0f1a; display: grid; place-items: center; font-weight: 700; font-size: 16px; flex-shrink: 0;';
                            fallback.textContent = (client.name || '?').trim().charAt(0).toUpperCase();
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 999, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0b0f1a', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                        {(client.name || '?').trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                        {client.name || 'Клиент'}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {client.email || '—'}
                      </div>
                    </div>
                    {active && (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: '#0b0f1a', fontSize: 12, fontWeight: 700 }}>✓</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
          `}</style>
        </div>,
        document.body
      )}
    </div>
  );
}

