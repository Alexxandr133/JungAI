import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { PlatformIcon } from '../../components/icons';
import { AiAssistantMarkdown } from '../../components/AiAssistantMarkdown';
import '../../styles/tokens.css';
import './AIChatMarkdown.css';
import {
  DEFAULT_PSYCHOLOGIST_AI_SETTINGS,
  loadPsychologistAiSettings,
  MODALITY_OPTIONS,
  normalizeSettings,
  savePsychologistAiSettings,
  type PsychologistAiSettings
} from '../../lib/psychologistAiSettings';
import { PsychologistAiSettingsPanel } from './PsychologistAiSettingsPanel';
import {
  hasCompletedAiOnboarding,
  loadPersonalityText,
  markAiOnboardingDone,
  savePersonalityText
} from '../../lib/psychologistAiPersonality';
import { PsychologistAiPersonalityModal } from './PsychologistAiPersonalityModal';
import { usePsychologistPlatformTour } from '../../hooks/usePsychologistPlatformTour';
import { PSYCHOLOGIST_AI_TOUR_STEPS } from '../../lib/psychologistPlatformTourSteps';
import { PsychologistTourHelpButton } from '../../components/PsychologistTourHelpButton';
import { checkVerification } from '../../utils/verification';
import {
  Paperclip,
  Mic,
  ChevronLeft,
  Send,
  Folder,
  FolderOpen,
  ChevronRight,
  MessageSquare,
  FolderInput,
  Plus,
  X,
  MoreHorizontal,
  Bot,
  NotebookPen,
} from 'lucide-react';
import { AITranscriptionPanel } from './AITranscriptionPanel';
import { getActiveSttJobIds, removeActiveSttJob } from './transcriptionStorage';
import './AIChatShell.css';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  isAnalysis?: boolean;
  isError?: boolean;
  /** Текст пользователя для «Повторить» */
  retryUserMessage?: string;
  /** ISO time for messenger-style meta on user bubbles */
  at?: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  analysisMemory?: string;
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

type AiQuota = {
  plan: 'standard' | 'medium' | 'large';
  limit: number;
  used: number;
  remaining: number;
  percentageUsed: number;
  resetAt: string;
};

type DreamsContextRange = PsychologistAiSettings['dreamsContextRange'];
type DreamScopePreview = {
  includeDreamsInContext: boolean;
  model?: string;
  pricingNote?: string;
  stats: Record<DreamsContextRange, {
    count: number;
    cappedCount: number;
    estimatedPromptTokens: number;
    estimatedInputCostUsd: number;
  }>;
  suggestedRange: DreamsContextRange;
  selectedClient?: string | null;
};

type PendingAiAttachment = {
  id: string;
  name: string;
  kind: 'image' | 'document';
  mimeType: string;
  sizeBytes: number;
  textPreview?: string;
};

const AI_CHAT_FILE_ACCEPT = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.gif';
const AI_CHAT_MAX_ATTACHMENTS = 5;
const WORK_AREA_CARD_TABS = new Set(['Дневник клиента', 'сны', 'Тесты']);
const WORK_AREA_DEFAULT_TABS = [
  'Ведение клиента',
  'запрос',
  'анамнез',
  'ценности/кредо',
  'раздражители',
  'записи',
  'Синхронии',
];
const CLIENT_WORD_BEFORE_SPACE =
  /(?:^|[^\p{L}])(?:клиент(?:к(?:а|и|е|у|ой|ами|ах|ам|ок)|а|у|ом|е|ы|ов|ам|ами|ах)?|пациент(?:к(?:а|и|е|у|ой|ами|ах|ам|ок)|а|у|ом|е|ы|ов|ам|ами|ах)?)\s$/iu;
const ALL_CLIENTS_MENTION = 'все клиенты';

function messageMentionsAllClients(text: string): boolean {
  return /@все\s+клиенты\b/i.test(String(text || ''));
}

function parseMentionedClients(
  text: string,
  list: Array<{ id: string; name: string; email?: string; avatarUrl?: string }>
): Array<{ id: string; name: string; email?: string; avatarUrl?: string }> {
  const found: Array<{ id: string; name: string; email?: string; avatarUrl?: string }> = [];
  const seen = new Set<string>();
  const mentions = [...String(text || '').matchAll(/@([^\n@,.;:!?]+)/g)].map((m) =>
    String(m[1] || '').trim()
  );
  for (const q of mentions) {
    if (!q) continue;
    const qn = q.toLowerCase();
    const exact = list.find((c) => (c.name || '').trim().toLowerCase() === qn);
    const starts = list.find((c) => {
      const n = (c.name || '').trim().toLowerCase();
      return n && (n.startsWith(qn) || qn.startsWith(n));
    });
    const hit = exact || starts;
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      found.push(hit);
    }
  }
  return found;
}

function markdownToWorkAreaHtml(md: string): string {
  const escaped = String(md || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function appendAfterLastChar(existing: string, additionHtml: string): string {
  const prev = String(existing || '');
  const hasText = prev.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').trim().length > 0;
  return hasText ? `${prev}<p><br/></p>${additionHtml}` : additionHtml;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

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
  const { token, user } = useAuth();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAiAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [creatingFolderInline, setCreatingFolderInline] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [moveMenuChatId, setMoveMenuChatId] = useState<string | null>(null);
  const [folderActionsId, setFolderActionsId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const selectedClientIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedClientIdRef.current = selectedClientId;
  }, [selectedClientId]);
  /** Режим клиента следует из выбора (§25.1) */
  const clientModeEnabled = Boolean(selectedClientId);
  const [clients, setClients] = useState<Array<{ id: string; name: string; email?: string; avatarUrl?: string }>>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [draftFolderId, setDraftFolderId] = useState<string | null>(null);
  const [workAreaContextTabs, setWorkAreaContextTabs] = useState<string[]>([]);
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
  const [aiSettings, setAiSettings] = useState<PsychologistAiSettings>(() => ({ ...DEFAULT_PSYCHOLOGIST_AI_SETTINGS }));
  const [aiDraft, setAiDraft] = useState<PsychologistAiSettings>(() => ({ ...DEFAULT_PSYCHOLOGIST_AI_SETTINGS }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const [aiScreen, setAiScreen] = useState<'chat' | 'transcription'>(() =>
    searchParams.get('screen') === 'transcription' ? 'transcription' : 'chat'
  );

  // Deep-link из рабочей области: ?client=&tabs=a|b|c
  useEffect(() => {
    const client = searchParams.get('client');
    const tabsRaw = searchParams.get('tabs');
    if (client) {
      setSelectedClientId(client);
      setAiSettings((prev) => {
        const next = normalizeSettings({ ...prev, includeDreamsInContext: true });
        savePsychologistAiSettings(next);
        return next;
      });
    }
    if (tabsRaw) {
      try {
        const decoded = decodeURIComponent(tabsRaw);
        const list = decoded.split('|').map((s) => s.trim()).filter(Boolean);
        setWorkAreaContextTabs(list);
      } catch {
        setWorkAreaContextTabs([]);
      }
    }
  }, [searchParams]);
  const [sttBusy, setSttBusy] = useState(() => getActiveSttJobIds().length > 0);
  const [personalityText, setPersonalityText] = useState('');
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [aiQuota, setAiQuota] = useState<AiQuota | null>(null);
  const [showDreamScopeModal, setShowDreamScopeModal] = useState(false);
  const [pendingDreamMessage, setPendingDreamMessage] = useState('');
  const [dreamScopePreview, setDreamScopePreview] = useState<DreamScopePreview | null>(null);
  const [loadingDreamScopePreview, setLoadingDreamScopePreview] = useState(false);
  const [selectedDreamScopeRange, setSelectedDreamScopeRange] = useState<DreamsContextRange>('30d');
  const [dreamScopeStep, setDreamScopeStep] = useState<'idle' | 'counting' | 'ready'>('idle');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [sendToWa, setSendToWa] = useState<{ content: string } | null>(null);
  const [sendToWaClientId, setSendToWaClientId] = useState('');
  const [sendToWaTab, setSendToWaTab] = useState('');
  const [sendToWaTabs, setSendToWaTabs] = useState<string[]>([]);
  const [sendToWaLoading, setSendToWaLoading] = useState(false);
  const [sendToWaError, setSendToWaError] = useState<string | null>(null);
  const [sendToWaDone, setSendToWaDone] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionJustAppliedRef = useRef(false);
  const sendingRef = useRef(false); // Ref для предотвращения двойной отправки
  const currentChatIdRef = useRef<string | null>(null);
  const chatsRef = useRef<Chat[]>([]);

  function scopedStorageKey(base: string): string {
    return user?.id ? `${base}:${user.id}` : base;
  }

  useEffect(() => {
    const s = loadPsychologistAiSettings();
    setAiSettings(s);
    setAiDraft(s);
    setPersonalityText(loadPersonalityText());
    if (!hasCompletedAiOnboarding()) {
      setShowOnboardingModal(true);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    const tick = async () => {
      const ids = getActiveSttJobIds();
      if (!ids.length) {
        setSttBusy(false);
        return;
      }
      setSttBusy(true);
      try {
        const res = await api<{ item: { status: string } }>(
          `/api/ai/psychologist/transcriptions/${ids[0]}`,
          { token }
        );
        if (res.item.status !== 'processing') removeActiveSttJob(ids[0]);
      } catch {
        /* ignore */
      }
      setSttBusy(getActiveSttJobIds().length > 0);
    };
    void tick();
    const interval = setInterval(() => void tick(), 10000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    // При смене пользователя очищаем состояние до загрузки новых данных
    setChats([]);
    setFolders([]);
    setCurrentChatId(null);
    setMessages([]);
  }, [user?.id]);

  useEffect(() => {
    loadChats();
    loadFolders();
    loadShortcuts();
    loadClients();
  }, [user?.id]);

  useEffect(() => {
    if (!token) return;
    loadAiQuota();
  }, [token, user?.id]);

  useEffect(() => {
    if (settingsOpen) {
      loadAiQuota();
    }
  }, [settingsOpen]);

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!token) {
      setIsVerified(null);
      return;
    }
    checkVerification(token).then((r) => setIsVerified(r.isVerified));
  }, [token]);

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

  async function loadAiQuota() {
    if (!token) return;
    try {
      const res = await api<{ quota: AiQuota }>('/api/ai/tokens/quota', { token });
      setAiQuota(res.quota || null);
    } catch (e) {
      console.error('Failed to load AI quota:', e);
    }
  }

  useEffect(() => {
    setExpandedFolders((prev) => {
      const next = { ...prev };
      for (const f of folders) {
        if (!(f.id in next)) next[f.id] = true;
      }
      return next;
    });
  }, [folders]);

  useEffect(() => {
    if (!moveMenuChatId && !folderActionsId) return;
    const onDoc = (event: MouseEvent) => {
      const t = event.target as HTMLElement | null;
      if (t?.closest('[data-ai-sidebar-menu]')) return;
      if (t?.closest('[data-ai-move-btn]') || t?.closest('[data-ai-folder-more]')) return;
      setMoveMenuChatId(null);
      setFolderActionsId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moveMenuChatId, folderActionsId]);

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

  function handleAssistantCopy(e: React.ClipboardEvent) {
    try {
      const selection = window.getSelection();
      const selectedText = selection?.toString() ?? '';
      if (!selectedText) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', selectedText);
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();
        const wrapper = document.createElement('div');
        wrapper.appendChild(fragment);
        const html = wrapper.innerHTML;
        if (html) e.clipboardData.setData('text/html', html);
      }
    } catch {
      // ignore
    }
  }

  function renderAssistantMarkdown(content: string) {
    return <AiAssistantMarkdown content={content} />;
  }

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

  usePsychologistPlatformTour({
    tourId: 'ai',
    userId: user?.id,
    role: user?.role,
    enabled: Boolean(token && user?.role === 'psychologist' && isVerified === true && user),
    steps: PSYCHOLOGIST_AI_TOUR_STEPS
  });

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
      // shortucts removed from UI
    } catch (e) {
      console.error('Failed to load chats from API:', e);
      // Fallback to localStorage if API fails
      try {
        const saved = localStorage.getItem(scopedStorageKey(STORAGE_KEY));
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
      const saved = localStorage.getItem(scopedStorageKey(FOLDERS_STORAGE_KEY));
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
      chatsRef.current = newChats;
      localStorage.setItem(scopedStorageKey(STORAGE_KEY), JSON.stringify(newChats));
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
    chatsRef.current = updatedChats;
    localStorage.setItem(scopedStorageKey(STORAGE_KEY), JSON.stringify(updatedChats));

    const currentId = currentChatIdRef.current;
    if (currentId && !updatedChats.some(c => c.id === currentId)) {
      const previous = newChats.find(c => c.id === currentId);
      const replacement = previous
        ? (
            updatedChats.find(c => c.title === previous.title && c.createdAt === previous.createdAt)
            || updatedChats.find(c => c.title === previous.title && c.messages?.length === previous.messages?.length)
          )
        : null;
      if (replacement) {
        setCurrentChatId(replacement.id);
      } else if (updatedChats.length > 0) {
        // Fallback: не оставляем интерфейс в "битом" currentChatId
        setCurrentChatId(updatedChats[0].id);
      }
    }
  }

  async function saveFolders(newFolders: Folder[], syncFolderId?: string) {
    setFolders(newFolders);
    localStorage.setItem(scopedStorageKey(FOLDERS_STORAGE_KEY), JSON.stringify(newFolders));
    if (!token) return;
    const toSync = syncFolderId
      ? newFolders.filter(f => f.id === syncFolderId)
      : newFolders;
    for (const folder of toSync) {
      try {
        const saved = await api<{ id: string; name: string; createdAt: string }>('/api/ai/psychologist/folders', {
          method: 'POST',
          token,
          body: {
            id: folder.id,
            name: folder.name
          }
        });
        if (saved?.id && saved.id !== folder.id) {
          const remapped = newFolders.map(f =>
            f.id === folder.id ? { ...f, id: saved.id } : f
          );
          const remappedChats = chats.map(c =>
            c.folderId === folder.id ? { ...c, folderId: saved.id } : c
          );
          setFolders(remapped);
          setChats(remappedChats);
          chatsRef.current = remappedChats;
          localStorage.setItem(scopedStorageKey(FOLDERS_STORAGE_KEY), JSON.stringify(remapped));
          localStorage.setItem(scopedStorageKey(STORAGE_KEY), JSON.stringify(remappedChats));
        }
      } catch (e) {
        console.error('Failed to save folder:', e);
      }
    }
  }

  function loadShortcuts() {
    try {
      const saved = localStorage.getItem(scopedStorageKey(SHORTCUTS_STORAGE_KEY));
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
    localStorage.setItem(scopedStorageKey(SHORTCUTS_STORAGE_KEY), JSON.stringify(newShortcuts));
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
    const nextShortcuts = shortcuts.filter(s => s.id !== shortcutId);
    setShortcuts(nextShortcuts);
    localStorage.setItem(scopedStorageKey(SHORTCUTS_STORAGE_KEY), JSON.stringify(nextShortcuts));
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
    // §25.2: пустой чат не попадает в список, пока нет первого сообщения
    setDraftFolderId(folderId);
    setCurrentChatId(null);
    setMessages([]);
    setInput('');
    setPendingAttachments([]);
    setAttachmentError(null);
    if (isMobileView) setSidebarOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function createFolder() {
    if (!newFolderName.trim()) return;
    const newFolder: Folder = {
      id: `folder-${Date.now()}-${Math.random()}`,
      name: newFolderName.trim(),
      createdAt: new Date().toISOString()
    };
    const newFolders = [...folders, newFolder];
    saveFolders(newFolders, newFolder.id);
    setNewFolderName('');
    setCreatingFolderInline(false);
    setExpandedFolders((prev) => ({ ...prev, [newFolder.id]: true }));
  }

  function selectClientForContext(clientId: string | null) {
    setSelectedClientId(clientId);
    setShowClientsDropdown(false);
    setClientSearchQuery('');
    setMentionOpen(false);
  }

  function closeMentionPicker() {
    setMentionOpen(false);
    setMentionQuery('');
    setMentionIndex(0);
    setMentionStart(null);
  }

  function mentionedClientIdFromText(text: string): string | undefined {
    if (selectedClientIdRef.current) return undefined;
    if (messageMentionsAllClients(text)) return undefined;
    const fromAt = parseMentionedClients(text, clients)[0]?.id;
    if (fromAt) return fromAt;
    const t = String(text || '').toLowerCase();
    const byName = [...clients]
      .filter((c) => {
        const n = (c.name || '').trim().toLowerCase();
        return n.length >= 3 && t.includes(n);
      })
      .sort((a, b) => (b.name || '').length - (a.name || '').length);
    return byName[0]?.id;
  }

  const mentionCandidates = clients.filter((c) => {
    const q = mentionQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  });
  const showAllClientsMention =
    !mentionQuery.trim() || ALL_CLIENTS_MENTION.includes(mentionQuery.trim().toLowerCase());
  const mentionOptions: Array<{ id: string; name: string; email?: string; isAll?: boolean }> = [
    ...(showAllClientsMention
      ? [{ id: '__all__', name: 'Все клиенты', email: 'Сны и контекст по всей базе', isAll: true }]
      : []),
    ...mentionCandidates,
  ];

  function mentionQueryIsComplete(query: string): boolean {
    const lower = String(query || '').replace(/\s+$/, '').toLowerCase();
    if (!lower) return false;
    if (lower === ALL_CLIENTS_MENTION || lower.startsWith(`${ALL_CLIENTS_MENTION} `)) return true;
    return clients.some((c) => {
      const n = (c.name || '').trim().toLowerCase();
      return n && (lower === n || lower.startsWith(`${n} `));
    });
  }

  function applyMention(client: { id: string; name: string; isAll?: boolean }) {
    const el = inputRef.current;
    const start = mentionStart ?? (el ? el.selectionStart : input.lastIndexOf('@'));
    if (start == null || start < 0) return;
    const cursor = el?.selectionEnd ?? input.length;
    const name = client.isAll ? ALL_CLIENTS_MENTION : (client.name || 'Клиент').trim();
    const next = `${input.slice(0, start)}@${name} ${input.slice(cursor)}`;
    mentionJustAppliedRef.current = true;
    setInput(next);
    closeMentionPicker();
    requestAnimationFrame(() => {
      const field = inputRef.current;
      if (!field) return;
      const pos = start + name.length + 2;
      field.focus();
      field.setSelectionRange(pos, pos);
      field.style.height = 'auto';
      field.style.height = `${Math.max(40, Math.min(field.scrollHeight, 200))}px`;
      window.setTimeout(() => {
        mentionJustAppliedRef.current = false;
      }, 0);
    });
  }

  function handleComposerInput(value: string, cursor: number) {
    setInput(value);
    if (mentionJustAppliedRef.current || clientModeEnabled) {
      if (mentionOpen) closeMentionPicker();
      return;
    }
    const before = value.slice(0, cursor);
    const atMatch = before.match(/@([^\n@]*)$/);
    if (atMatch) {
      const rawQuery = atMatch[1] || '';
      if (mentionQueryIsComplete(rawQuery)) {
        if (mentionOpen) closeMentionPicker();
        return;
      }
      setMentionOpen(true);
      setMentionQuery(rawQuery);
      setMentionIndex(0);
      setMentionStart(cursor - atMatch[0].length);
      return;
    }
    if (CLIENT_WORD_BEFORE_SPACE.test(before)) {
      const insert = before.endsWith(' ') ? '@' : ' @';
      const next = `${value.slice(0, cursor)}${insert}${value.slice(cursor)}`;
      setInput(next);
      setMentionOpen(true);
      setMentionQuery('');
      setMentionIndex(0);
      setMentionStart(cursor + (insert.startsWith(' ') ? 1 : 0));
      requestAnimationFrame(() => {
        const field = inputRef.current;
        if (!field) return;
        const pos = cursor + insert.length;
        field.setSelectionRange(pos, pos);
        field.style.height = 'auto';
        field.style.height = `${Math.max(40, Math.min(field.scrollHeight, 200))}px`;
      });
      return;
    }
    if (mentionOpen) closeMentionPicker();
  }

  async function openSendToWorkArea(content: string) {
    const text = String(content || '').trim();
    if (!text || !token) return;
    const defaultClient = selectedClientId || parseMentionedClients(text, clients)[0]?.id || clients[0]?.id || '';
    setSendToWa({ content: text });
    setSendToWaClientId(defaultClient);
    setSendToWaError(null);
    setSendToWaDone(false);
    setSendToWaLoading(Boolean(defaultClient));
    if (defaultClient) {
      await loadSendToWaTabs(defaultClient);
    } else {
      setSendToWaTabs(WORK_AREA_DEFAULT_TABS);
      setSendToWaTab(WORK_AREA_DEFAULT_TABS[0] || '');
      setSendToWaLoading(false);
    }
  }

  async function loadSendToWaTabs(clientId: string) {
    if (!token || !clientId) {
      setSendToWaTabs(WORK_AREA_DEFAULT_TABS);
      setSendToWaTab(WORK_AREA_DEFAULT_TABS[0] || '');
      return;
    }
    setSendToWaLoading(true);
    try {
      const res = await api<{ tabs: string[] }>(`/api/clients/${clientId}/tabs`, { token });
      const tabs = (res.tabs || WORK_AREA_DEFAULT_TABS).filter((t) => !WORK_AREA_CARD_TABS.has(t));
      const nextTabs = tabs.length ? tabs : WORK_AREA_DEFAULT_TABS;
      setSendToWaTabs(nextTabs);
      setSendToWaTab((prev) => (nextTabs.includes(prev) ? prev : nextTabs[0] || ''));
    } catch {
      setSendToWaTabs(WORK_AREA_DEFAULT_TABS);
      setSendToWaTab((prev) => (WORK_AREA_DEFAULT_TABS.includes(prev) ? prev : WORK_AREA_DEFAULT_TABS[0] || ''));
    } finally {
      setSendToWaLoading(false);
    }
  }

  async function confirmSendToWorkArea() {
    if (!token || !sendToWa || !sendToWaClientId || !sendToWaTab) {
      setSendToWaError('Выберите клиента и вкладку');
      return;
    }
    setSendToWaLoading(true);
    setSendToWaError(null);
    try {
      let existing = '';
      try {
        const doc = await api<{ content?: string }>(
          `/api/clients/${sendToWaClientId}/documents/${encodeURIComponent(sendToWaTab)}`,
          { token }
        );
        existing = doc?.content || '';
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (!msg.includes('404') && !msg.toLowerCase().includes('not found')) {
          throw err;
        }
      }
      const next = appendAfterLastChar(existing, markdownToWorkAreaHtml(sendToWa.content));
      await api(`/api/clients/${sendToWaClientId}/documents`, {
        method: 'POST',
        token,
        body: { tabName: sendToWaTab, content: next },
      });
      try {
        localStorage.setItem(`workarea.content.${sendToWaClientId}.${sendToWaTab}`, next);
      } catch {
        /* ignore */
      }
      setSendToWaDone(true);
    } catch (err: any) {
      setSendToWaError(err?.message || 'Не удалось сохранить в рабочую область');
    } finally {
      setSendToWaLoading(false);
    }
  }

  function toggleDreamsInContext() {
    const next = normalizeSettings({
      ...aiSettings,
      includeDreamsInContext: !aiSettings.includeDreamsInContext,
    });
    setAiSettings(next);
    savePsychologistAiSettings(next);
    setAiDraft(next);
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
    if (!window.confirm('Удалить эту папку? Чаты не удалятся — они перейдут в «Без папки».')) return;
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
    saveFolders(newFolders, folderId);
    setEditingFolderId(null);
    setEditingFolderName('');
  }

  function moveChatToFolder(chatId: string, folderId: string | null) {
    const newChats = chats.map(c => 
      c.id === chatId ? { ...c, folderId, updatedAt: new Date().toISOString() } : c
    );
    saveChats(newChats);
  }

  function messageLooksLikeDreamBatchAnalysis(text: string): boolean {
    const s = text.toLowerCase();
    const hasDreamKeyword =
      /(сны|снов|снам|снами|снах|сон|сна|сну|сном|dream)/i.test(s) ||
      /\bснф\b/i.test(s); // частая опечатка "сны"
    const hasAnalyzeIntent =
      /(анализ|проанализ|провалид|валид|разбер|разбор|посмотр|просмотр|просмотри|глянь|оцени|исслед|сводк|паттерн|ревью|проверь)/i.test(s);
    const asksMany = /\b(все|всех|80|100|120|150|200|много|массово|полностью)\b/i.test(s);
    return hasDreamKeyword && (hasAnalyzeIntent || asksMany);
  }

  async function loadDreamScopePreview(messageText?: string): Promise<DreamScopePreview | null> {
    if (!token) return null;
    setDreamScopeStep('counting');
    setLoadingDreamScopePreview(true);
    try {
      const sourceText = messageText || pendingDreamMessage || input;
      const mentionedClientId = mentionedClientIdFromText(sourceText);
      const res = await api<DreamScopePreview>('/api/ai/psychologist/dream-scope-preview', {
        method: 'POST',
        token,
        body: {
          clientModeEnabled: Boolean(selectedClientIdRef.current),
          clientId: selectedClientIdRef.current || mentionedClientId,
          mentionedClientId,
          mentionedAllClients: messageMentionsAllClients(sourceText),
          message: sourceText,
          includeDreamsInContext: aiSettings.includeDreamsInContext,
        }
      });
      setDreamScopePreview(res);
      setSelectedDreamScopeRange(res.suggestedRange);
      setDreamScopeStep('ready');
      return res;
    } catch (e) {
      console.error('Dream scope preview error:', e);
      setDreamScopePreview(null);
      setDreamScopeStep('idle');
      return null;
    } finally {
      setLoadingDreamScopePreview(false);
    }
  }

  async function handleAttachmentFiles(fileList: FileList | null) {
    if (!fileList?.length || !token) return;
    setAttachmentError(null);
    const slotsLeft = AI_CHAT_MAX_ATTACHMENTS - pendingAttachments.length;
    if (slotsLeft <= 0) {
      setAttachmentError(`Можно прикрепить не более ${AI_CHAT_MAX_ATTACHMENTS} файлов`);
      return;
    }
    const files = Array.from(fileList).slice(0, slotsLeft);
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    setUploadingAttachments(true);
    try {
      const res = await api<{ attachments: PendingAiAttachment[] }>('/api/ai/psychologist/attachments', {
        method: 'POST',
        token,
        body: fd,
      });
      setPendingAttachments((prev) => [...prev, ...(res.attachments || [])]);
    } catch (e: any) {
      setAttachmentError(e?.message || 'Не удалось загрузить файлы');
    } finally {
      setUploadingAttachments(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachmentError(null);
  }

  async function sendMessage(options?: {
    forcedMessage?: string;
    dreamsContextRangeOverride?: DreamsContextRange;
    skipDreamScopePrompt?: boolean;
  }) {
    const preparedMessage = (options?.forcedMessage ?? input).trim();
    const hasAttachments = pendingAttachments.length > 0;
    if ((!preparedMessage && !hasAttachments) || loading || isSending || sendingRef.current || !token) return;

    if (
      !options?.skipDreamScopePrompt &&
      aiSettings.includeDreamsInContext &&
      messageLooksLikeDreamBatchAnalysis(preparedMessage)
    ) {
      setPendingDreamMessage(preparedMessage);
      setShowDreamScopeModal(true);
      setDreamScopeStep('idle');
      void loadDreamScopePreview(preparedMessage);
      return;
    }

    const userMessage =
      preparedMessage || (hasAttachments ? 'Проанализируй прикреплённые файлы.' : '');
    const attachmentIds = pendingAttachments.map((a) => a.id);
    const attachmentLabels = pendingAttachments.map((a) =>
      a.kind === 'image' ? `📎 ${a.name} (изображение)` : `📎 ${a.name}`
    );
    const userBubbleText =
      attachmentLabels.length > 0
        ? `${userMessage}\n\n${attachmentLabels.join('\n')}`
        : userMessage;

    setPendingAttachments([]);
    setAttachmentError(null);
    // Всегда очищаем поле после фактической отправки (в т.ч. после модалки объёма снов: там forcedMessage, иначе текст оставался в поле).
    setInput('');
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.style.height = 'auto';
        el.style.height = `${Math.min(Math.max(el.scrollHeight, 24), 200)}px`;
      }
    });
    setIsSending(true);
    sendingRef.current = true;
    
    // Используем текущие сообщения для истории (без нового пользовательского сообщения)
    // так как оно передается отдельно как `message`
    const conversationHistory = messages;
    const newMessages = [
      ...messages,
      { role: 'user' as const, content: userBubbleText, at: new Date().toISOString() },
    ];
    setMessages(newMessages);
    setLoading(true);
    const chatsSnapshot = chatsRef.current;
    let activeChatId: string | null = currentChatId;

    // Обновляем чат с новыми сообщениями и флагом загрузки
    if (activeChatId) {
      const chat = chatsSnapshot.find(c => c.id === activeChatId);
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
        const newChats = chatsSnapshot.map(c => c.id === activeChatId ? updatedChat : c);
        await saveChats(newChats);
      }
    } else {
      // Создаем новый чат только при первом сообщении
      const newChat: Chat = {
        id: `chat-${Date.now()}-${Math.random()}`,
        title: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
        messages: newMessages,
        folderId: draftFolderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isLoading: true
      } as Chat;
      const newChats = [newChat, ...chatsSnapshot];
      await saveChats(newChats);
      activeChatId = newChat.id;
      setCurrentChatId(newChat.id);
      setDraftFolderId(null);
    }

    try {
      const response = await api<{
        message: string;
        conversationHistory: Message[];
        quota?: AiQuota;
        analysisMemory?: string;
        analysisMemoryUpdated?: boolean;
      }>(
        '/api/ai/psychologist/chat',
        {
          method: 'POST',
          token,
          body: {
            message: userMessage,
            conversationHistory: conversationHistory,
            clientId: selectedClientIdRef.current || mentionedClientIdFromText(userMessage) || undefined,
            clientModeEnabled: Boolean(selectedClientIdRef.current),
            mentionedClientId: mentionedClientIdFromText(userMessage),
            mentionedAllClients: messageMentionsAllClients(userMessage),
            modality: aiSettings.modality,
            temperature: aiSettings.temperature,
            responseStyle: aiSettings.responseStyle,
            dreamsContextRange: options?.dreamsContextRangeOverride ?? aiSettings.dreamsContextRange,
            includeDreamsInContext: aiSettings.includeDreamsInContext,
            personalization: personalityText.trim(),
            analysisMemory: chatsSnapshot.find(c => c.id === activeChatId)?.analysisMemory || '',
            ...(attachmentIds.length ? { attachmentIds } : {}),
          }
        }
      );

      const finalMessages = response.conversationHistory.map((m) => ({ ...m }));
      if (response.analysisMemoryUpdated) {
        for (let i = finalMessages.length - 1; i >= 0; i--) {
          if (finalMessages[i].role === 'assistant') {
            finalMessages[i] = { ...finalMessages[i], isAnalysis: true };
            break;
          }
        }
      }
      setMessages(finalMessages);
      if (response.quota) setAiQuota(response.quota);

      // Обновляем чат с финальными сообщениями и убираем флаг загрузки
      if (activeChatId) {
        const newChats = chatsRef.current.map(c => 
          c.id === activeChatId 
            ? {
                ...c,
                messages: finalMessages,
                analysisMemory: response.analysisMemory || c.analysisMemory,
                updatedAt: new Date().toISOString(),
                isLoading: false
              }
            : c
        );
        await saveChats(newChats);
      }
    } catch (error: unknown) {
      console.error('Chat error:', error);
      const raw = String((error as { message?: string })?.message || 'Не удалось отправить сообщение');
      const errorMessage: Message = {
        role: 'assistant',
        content:
          'Не удалось получить ответ. Проверьте соединение и попробуйте ещё раз. Если ошибка повторяется — напишите в поддержку.',
        isError: true,
        retryUserMessage: userMessage,
      };
      const errorMessages = [...newMessages, errorMessage];
      setMessages(errorMessages);

      if (activeChatId) {
        const newChats = chatsRef.current.map(c => 
          c.id === activeChatId 
            ? { ...c, messages: errorMessages, updatedAt: new Date().toISOString(), isLoading: false }
            : c
        );
        await saveChats(newChats);
      }
      void raw; // raw уже в console.error
    } finally {
      setLoading(false);
      setIsSending(false);
      sendingRef.current = false;
      inputRef.current?.focus();
    }
  }

  async function confirmDreamScopeAndSend(range: DreamsContextRange) {
    if (!pendingDreamMessage) return;
    setShowDreamScopeModal(false);
    const queuedMessage = pendingDreamMessage;
    setPendingDreamMessage('');
    setDreamScopePreview(null);
    setDreamScopeStep('idle');
    await sendMessage({
      forcedMessage: queuedMessage,
      dreamsContextRangeOverride: range,
      skipDreamScopePrompt: true
    });
  }

  const chatsByFolder = folders.map(folder => ({
    folder,
    chats: chats.filter(c => c.folderId === folder.id)
  }));

  const rootChats = chats.filter(c => !c.folderId);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;
  const modalityLabel =
    MODALITY_OPTIONS.find((m) => m.id === aiSettings.modality)?.label ?? aiSettings.modality;

  function formatQuotaUnderInput(q: AiQuota): string {
    const remaining = q.remaining.toLocaleString('ru-RU');
    const reset = new Date(q.resetAt).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `Доступно ${remaining} токенов · сброс ${reset}`;
  }

  const filteredClientsForPicker = clients.filter((c) => {
    const q = clientSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  });

  function formatBubbleTime(iso?: string): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function renderChatRow(chat: Chat) {
    const active = currentChatId === chat.id;
    const menuOpen = moveMenuChatId === chat.id;
    return (
      <div
        key={chat.id}
        className={`ai-chat-row${active ? ' is-active' : ''}${menuOpen ? ' is-menu-open' : ''}`}
        onClick={() => {
          setDraftFolderId(null);
          setCurrentChatId(chat.id);
          setMoveMenuChatId(null);
          if (isMobileView) setSidebarOpen(false);
        }}
      >
        <span className="ai-chat-row__icon" aria-hidden>
          <MessageSquare size={16} />
        </span>
        {editingChatId === chat.id ? (
          <input
            value={editingChatTitle}
            onChange={(e) => setEditingChatTitle(e.target.value)}
            onBlur={() => updateChatTitle(chat.id, editingChatTitle)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateChatTitle(chat.id, editingChatTitle);
              else if (e.key === 'Escape') {
                setEditingChatId(null);
                setEditingChatTitle('');
              }
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            style={{
              flex: 1,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--primary)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
            }}
          />
        ) : (
          <>
            <span
              className="ai-chat-row__title"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingChatId(chat.id);
                setEditingChatTitle(chat.title);
              }}
              title="Двойной клик для переименования"
            >
              {chat.title}
            </span>
            <div className="ai-chat-row__actions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="ai-chat-row__icon-btn"
                data-ai-move-btn
                title="В папку…"
                aria-label="В папку…"
                onClick={() => {
                  setFolderActionsId(null);
                  setMoveMenuChatId((id) => (id === chat.id ? null : chat.id));
                }}
              >
                <FolderInput size={16} />
              </button>
              <button
                type="button"
                className="ai-chat-row__icon-btn is-danger"
                title="Удалить чат"
                aria-label="Удалить чат"
                onClick={() => void deleteChat(chat.id)}
              >
                <X size={16} />
              </button>
            </div>
            {menuOpen && (
              <ul className="ai-sidebar-menu" data-ai-sidebar-menu role="menu">
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      moveChatToFolder(chat.id, null);
                      setMoveMenuChatId(null);
                    }}
                  >
                    Без папки
                  </button>
                </li>
                {folders.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        moveChatToFolder(chat.id, f.id);
                        setMoveMenuChatId(null);
                        setExpandedFolders((prev) => ({ ...prev, [f.id]: true }));
                      }}
                    >
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    );
  }

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
          data-tour="ai-sidebar"
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
              <div className="ai-sidebar-actions">
                <button type="button" className="ai-sidebar-new-chat" onClick={() => createNewChat()}>
                  Новый чат
                </button>
                <button
                  type="button"
                  className="button secondary ai-sidebar-new-folder"
                  onClick={() => {
                    setCreatingFolderInline(true);
                    setNewFolderName('');
                  }}
                >
                  + Папка
                </button>
              </div>

              {creatingFolderInline && (
                <div className="ai-sidebar-inline-folder">
                  <input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createFolder();
                      else if (e.key === 'Escape') {
                        setCreatingFolderInline(false);
                        setNewFolderName('');
                      }
                    }}
                    placeholder="Название папки"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="button"
                    disabled={!newFolderName.trim()}
                    onClick={createFolder}
                    style={{ padding: '8px 12px', fontSize: 12 }}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setCreatingFolderInline(false);
                      setNewFolderName('');
                    }}
                    style={{ padding: '8px 10px', fontSize: 12 }}
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Chats list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                {rootChats.map((chat) => renderChatRow(chat))}

                {/* Folders */}
                {chatsByFolder.map(({ folder, chats: folderChats }) => {
                  const open = expandedFolders[folder.id] !== false;
                  const moreOpen = folderActionsId === folder.id;
                  return (
                    <div key={folder.id} style={{ marginBottom: 4 }}>
                      <div
                        className={`ai-folder-row${moreOpen ? ' is-menu-open' : ''}`}
                        onClick={() =>
                          setExpandedFolders((prev) => ({
                            ...prev,
                            [folder.id]: !(prev[folder.id] !== false),
                          }))
                        }
                      >
                        <span className={`ai-folder-row__chevron${open ? ' is-open' : ''}`} aria-hidden>
                          <ChevronRight size={16} />
                        </span>
                        <span className="ai-folder-row__icon" aria-hidden>
                          {open ? <FolderOpen size={16} /> : <Folder size={16} />}
                        </span>
                        {editingFolderId === folder.id ? (
                          <input
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            onBlur={() => updateFolderName(folder.id, editingFolderName)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') updateFolderName(folder.id, editingFolderName);
                              else if (e.key === 'Escape') {
                                setEditingFolderId(null);
                                setEditingFolderName('');
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            style={{
                              flex: 1,
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: '1px solid var(--primary)',
                              background: 'var(--surface)',
                              color: 'var(--text)',
                              fontSize: 13,
                            }}
                          />
                        ) : (
                          <>
                            <span
                              className="ai-folder-row__name"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setEditingFolderId(folder.id);
                                setEditingFolderName(folder.name);
                              }}
                            >
                              {folder.name}
                            </span>
                            <span className="ai-folder-row__count">{folderChats.length}</span>
                            <div
                              className="ai-folder-row__actions"
                              onClick={(e) => e.stopPropagation()}
                              style={{ position: 'relative' }}
                            >
                              <button
                                type="button"
                                className="ai-chat-row__icon-btn"
                                title="Чат в эту папку"
                                aria-label="Чат в эту папку"
                                onClick={() => createNewChat(folder.id)}
                              >
                                <Plus size={16} />
                              </button>
                              <button
                                type="button"
                                className="ai-chat-row__icon-btn"
                                data-ai-folder-more
                                title="Ещё"
                                aria-label="Ещё"
                                onClick={() => {
                                  setMoveMenuChatId(null);
                                  setFolderActionsId((id) => (id === folder.id ? null : folder.id));
                                }}
                              >
                                <MoreHorizontal size={16} />
                              </button>
                              {moreOpen && (
                                <ul className="ai-sidebar-menu" data-ai-sidebar-menu role="menu">
                                  <li>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setEditingFolderId(folder.id);
                                        setEditingFolderName(folder.name);
                                        setFolderActionsId(null);
                                      }}
                                    >
                                      Переименовать
                                    </button>
                                  </li>
                                  <li>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="is-danger"
                                      onClick={() => {
                                        setFolderActionsId(null);
                                        void deleteFolder(folder.id);
                                      }}
                                    >
                                      Удалить
                                    </button>
                                  </li>
                                </ul>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      {open && (
                        <div className="ai-folder-children">
                          {folderChats.length === 0 ? (
                            <div className="ai-folder-empty">Нет чатов</div>
                          ) : (
                            folderChats.map((chat) => renderChatRow(chat))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
        <div data-tour="ai-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden', height: '100%', position: 'relative' }}>
          {/* Верхняя панель: заголовок + настройки ИИ */}
          <div
            data-tour="ai-header"
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'var(--surface)',
              minHeight: 48
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: isMobileView ? 14 : 15, color: 'var(--text)' }}>
                {aiScreen === 'transcription' ? 'Транскрибация' : 'AI Ассистент'}
              </div>
              {aiScreen === 'transcription' ? (
                <div className="small" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Загрузите запись — получите текст расшифровки
                </div>
              ) : (
                <div className="ai-context-chips" style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    className="ai-context-chip"
                    onClick={() => {
                      setAiDraft(aiSettings);
                      setSettingsOpen(true);
                    }}
                    title="Модальность"
                  >
                    {modalityLabel}
                  </button>
                  <button
                    type="button"
                    className="ai-context-chip"
                    onClick={() => setShowClientsDropdown(true)}
                    disabled={loadingClients}
                    title="Клиент"
                  >
                    {selectedClient
                      ? `Клиент: ${selectedClient.name || '—'}`
                      : 'Обобщённый режим'}
                  </button>
                  <button
                    type="button"
                    className="ai-context-chip"
                    title={
                      selectedClientId
                        ? 'Сны выбранного клиента в контексте'
                        : 'В обобщённом режиме — сны всех клиентов'
                    }
                    onClick={() => toggleDreamsInContext()}
                  >
                    Сны: {aiSettings.includeDreamsInContext ? 'вкл' : 'выкл'}
                  </button>
                  {workAreaContextTabs.map((tab) => (
                    <span key={tab} className="ai-context-chip ai-context-chip--static">
                      {tab}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {aiScreen === 'chat' && (
                <button
                  type="button"
                  className="ai-header-icon-btn"
                  data-tour="ai-transcription"
                  onClick={() => setAiScreen('transcription')}
                  title="Транскрибация аудио"
                  style={{
                    flexShrink: 0,
                    height: 40,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: sttBusy ? '1px solid rgba(91, 124, 250, 0.5)' : '1px solid rgba(255,255,255,0.12)',
                    background: sttBusy ? 'rgba(91, 124, 250, 0.12)' : 'var(--surface-2)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    boxSizing: 'border-box',
                    position: 'relative',
                  }}
                >
                  <Mic size={18} strokeWidth={2} />
                  {!isMobileView && <span>Транскрибация</span>}
                  {sttBusy && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                      }}
                      aria-hidden
                    />
                  )}
                </button>
              )}
              {aiScreen === 'transcription' && (
                <button
                  type="button"
                  className="ai-header-icon-btn"
                  onClick={() => setAiScreen('chat')}
                  title="Вернуться в чат"
                  style={{
                    flexShrink: 0,
                    height: 40,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(91, 124, 250, 0.45)',
                    background: 'rgba(91, 124, 250, 0.15)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    boxSizing: 'border-box',
                    marginLeft: 'auto',
                  }}
                >
                  <ChevronLeft size={18} strokeWidth={2} />
                  <span>Чат</span>
                </button>
              )}
              {aiScreen === 'chat' && (
                <PsychologistTourHelpButton tourId="ai" steps={PSYCHOLOGIST_AI_TOUR_STEPS} userId={user?.id} role={user?.role} />
              )}
              {aiScreen === 'chat' && (
                <button
                  type="button"
                  className="ai-header-icon-btn"
                  data-tour="ai-settings"
                  onClick={() => {
                    setAiDraft(aiSettings);
                    setSettingsOpen(true);
                  }}
                  title="Настройки ИИ"
                  style={{
                    flexShrink: 0,
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'var(--surface-2)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    lineHeight: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  <PlatformIcon name="settings" size={20} strokeWidth={1.75} style={{ display: 'block', flexShrink: 0 }} />
                </button>
              )}
            </div>
          </div>

          <PsychologistAiPersonalityModal
            open={showOnboardingModal}
            variant="onboarding"
            initialText={personalityText}
            onClose={() => {
              markAiOnboardingDone();
              setShowOnboardingModal(false);
            }}
            onSkip={() => {
              markAiOnboardingDone();
              setShowOnboardingModal(false);
            }}
            onSave={text => {
              const t = text.trim();
              savePersonalityText(t);
              setPersonalityText(t);
              markAiOnboardingDone();
              setShowOnboardingModal(false);
            }}
          />

          <PsychologistAiPersonalityModal
            open={showMemoryModal}
            variant="memory"
            initialText={personalityText}
            onClose={() => setShowMemoryModal(false)}
            onSave={text => {
              const t = text.trim();
              savePersonalityText(t);
              setPersonalityText(t);
              setShowMemoryModal(false);
            }}
          />

          <PsychologistAiSettingsPanel
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            draft={aiDraft}
            setDraft={setAiDraft}
            isMobileView={isMobileView}
            quota={aiQuota}
            onOpenMemory={() => {
              setSettingsOpen(false);
              setShowMemoryModal(true);
            }}
            onApply={() => {
              const next = normalizeSettings(aiDraft);
              setAiSettings(next);
              savePsychologistAiSettings(next);
              setAiDraft(next);
              setSettingsOpen(false);
            }}
          />

          {aiScreen === 'transcription' && token ? (
            <AITranscriptionPanel
              token={token}
              isMobileView={isMobileView}
              onJobsChange={setSttBusy}
            />
          ) : (
          <>
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
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {messages.length === 0 && !loading ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
                      <div style={{ textAlign: 'center', maxWidth: 720 }}>
                        <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.8 }}>💬</div>
                        <h3 style={{ fontSize: isMobileView ? 16 : 22, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
                          Начните диалог с AI ассистентом
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: isMobileView ? 12 : 15, lineHeight: 1.6, marginBottom: 24 }}>
                          {selectedClientId
                            ? aiSettings.includeDreamsInContext
                              ? 'Задавайте вопросы о клиенте, снах, заметках и сессиях — в рамках выбранной модальности.'
                              : 'Сны отключены: спрашивайте про заметки, сессии и карточку клиента.'
                            : aiSettings.includeDreamsInContext
                              ? 'Обобщённый режим: общие вопросы и сны всех клиентов в контексте. Выберите клиента в шапке для карточки и сессий.'
                              : 'Обобщённый режим без снов. Включите «Сны» в шапке или выберите клиента.'}
                        </p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: isMobileView ? 11 : 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                            Попробуйте спросить:
                          </div>
                          <div className="ai-chat-tip-chips">
                            {(selectedClientId
                              ? [
                                  'Дай сводку по клиенту…',
                                  ...(aiSettings.includeDreamsInContext ? ['Проанализируй последние сны…'] : []),
                                  'Составь план следующей сессии…',
                                ]
                              : [
                                  ...(aiSettings.includeDreamsInContext
                                    ? ['Проанализируй последние сны по всем клиентам…']
                                    : []),
                                  'Объясни концепцию архетипов Юнга…',
                                  'Как работать с символами в сновидениях?',
                                  'Какие техники амплификации можно использовать?',
                                ]
                            ).map((tip) => (
                              <button
                                key={tip}
                                type="button"
                                className="ai-chat-tip-chip"
                                onClick={() => {
                                  setInput(tip.replace(/…$/, ''));
                                  inputRef.current?.focus();
                                }}
                              >
                                {tip}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`ai-chat-bubble-row ${msg.role === 'user' ? 'is-mine' : 'is-theirs'}`}
                        >
                          {msg.role === 'assistant' && (
                            <div className="ai-chat-bot-icon" aria-hidden>
                              <Bot size={14} strokeWidth={2} />
                            </div>
                          )}
                          <div
                            className={`ai-chat-bubble ${
                              msg.role === 'user' ? 'is-mine' : msg.isError ? 'is-error' : 'is-theirs'
                            }`}
                            style={{ fontSize: isMobileView ? 13 : 15 }}
                            onCopy={msg.role === 'assistant' && !msg.isError ? handleAssistantCopy : undefined}
                          >
                            {msg.role === 'assistant' && msg.isAnalysis && (
                              <div
                                style={{
                                  display: 'inline-block',
                                  marginBottom: 8,
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: 'var(--brand-soft, rgba(91,124,250,0.18))',
                                  border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
                                  color: 'var(--text)',
                                }}
                              >
                                Анализ
                              </div>
                            )}
                            {msg.role === 'assistant' ? (
                              msg.isError ? (
                                <div>
                                  <div style={{ marginBottom: 10 }}>{msg.content}</div>
                                  {msg.retryUserMessage && (
                                    <button
                                      type="button"
                                      className="button secondary"
                                      disabled={loading || isSending}
                                      onClick={() => {
                                        void sendMessage({
                                          forcedMessage: msg.retryUserMessage,
                                          skipDreamScopePrompt: true,
                                        });
                                      }}
                                      style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600 }}
                                    >
                                      Повторить
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <>
                                  {renderAssistantMarkdown(msg.content)}
                                  <div className="ai-chat-bubble-actions">
                                    <button
                                      type="button"
                                      className="ai-chat-bubble-action"
                                      onClick={() => void openSendToWorkArea(msg.content)}
                                    >
                                      <NotebookPen size={14} strokeWidth={2} />
                                      В рабочую область
                                    </button>
                                  </div>
                                </>
                              )
                            ) : (
                              <>
                                {msg.content}
                                <div className="ai-chat-bubble-meta">
                                  {formatBubbleTime(msg.at) ? <span>{formatBubbleTime(msg.at)}</span> : null}
                                  <span className="ai-chat-bubble-ticks" aria-hidden>✓</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {loading && (
                        <div className="ai-chat-bubble-row is-theirs">
                          <div className="ai-chat-bot-icon" aria-hidden>
                            <Bot size={14} strokeWidth={2} />
                          </div>
                          <div className="ai-chat-bubble is-theirs" style={{ color: 'var(--text-muted)', fontSize: isMobileView ? 13 : 15 }}>
                            <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>●</span>
                            {' '}Думаю…
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
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', width: '100%' }}>
                  {/* Shortcut buttons - показываем только если режим работы с клиентами включен и выбран клиент */}
                  {false && clientModeEnabled && selectedClientId && shortcuts.length > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      gap: 10, 
                      flexWrap: 'wrap',
                      marginBottom: 16,
                      padding: '14px 16px',
                      background: 'var(--surface-2)',
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
                              background: 'var(--brand-soft, rgba(91, 124, 250, 0.12))',
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
                                e.currentTarget.style.background = 'var(--brand-soft, rgba(91, 124, 250, 0.18))';
                                e.currentTarget.style.borderColor = 'rgba(91, 124, 250, 0.4)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(91, 124, 250, 0.15)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'var(--brand-soft, rgba(91, 124, 250, 0.12))';
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

                  {pendingAttachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {pendingAttachments.map((att) => (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            borderRadius: 8,
                            background: 'var(--surface-2)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            fontSize: 12,
                            maxWidth: '100%',
                          }}
                        >
                          <span>{att.kind === 'image' ? '🖼️' : '📄'}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                            {att.name}
                          </span>
                          <span style={{ opacity: 0.6 }}>{formatFileSize(att.sizeBytes)}</span>
                          <button
                            type="button"
                            onClick={() => removePendingAttachment(att.id)}
                            disabled={loading || isSending || uploadingAttachments}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: 14,
                            }}
                            title="Убрать"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {attachmentError && (
                    <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{attachmentError}</div>
                  )}

                  {/* Input field */}
                  <div className="ai-chat-composer-wrap">
                  {mentionOpen && !clientModeEnabled && (
                    <div className="ai-mention-list" role="listbox" aria-label="Клиенты">
                      {mentionOptions.length ? (
                        mentionOptions.map((client, idx) => (
                          <button
                            key={client.id}
                            type="button"
                            role="option"
                            aria-selected={idx === mentionIndex}
                            className={`ai-mention-list__row${idx === mentionIndex ? ' is-active' : ''}${client.isAll ? ' is-all' : ''}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              applyMention(client);
                            }}
                          >
                            <span className="ai-mention-list__name">{client.name || 'Клиент'}</span>
                            {client.email ? (
                              <span className="ai-mention-list__sub">{client.email}</span>
                            ) : null}
                          </button>
                        ))
                      ) : (
                        <div className="ai-mention-list__empty">Клиенты не найдены</div>
                      )}
                    </div>
                  )}
                  <div className="ai-chat-composer">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={AI_CHAT_FILE_ACCEPT}
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => void handleAttachmentFiles(e.target.files)}
                    />
                    <button
                      type="button"
                      className="ai-chat-composer__attach"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={
                        loading ||
                        isSending ||
                        uploadingAttachments ||
                        pendingAttachments.length >= AI_CHAT_MAX_ATTACHMENTS
                      }
                      title="Прикрепить PDF, Word, изображение (до 5 файлов, 8 МБ)"
                      aria-label="Прикрепить файл"
                    >
                      {uploadingAttachments ? (
                        <span aria-hidden>…</span>
                      ) : (
                        <Paperclip size={20} strokeWidth={2} aria-hidden />
                      )}
                    </button>
                    <textarea
                      ref={inputRef}
                      className="ai-chat-composer__input"
                      value={input}
                      onChange={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        handleComposerInput(target.value, target.selectionStart ?? target.value.length);
                        target.style.height = 'auto';
                        target.style.height = `${Math.max(40, Math.min(target.scrollHeight, 200))}px`;
                      }}
                      onKeyDown={(e) => {
                        if (mentionOpen && !clientModeEnabled && mentionOptions.length) {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setMentionIndex((i) => (i + 1) % mentionOptions.length);
                            return;
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setMentionIndex((i) => (i - 1 + mentionOptions.length) % mentionOptions.length);
                            return;
                          }
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            applyMention(mentionOptions[mentionIndex] || mentionOptions[0]);
                            return;
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            closeMentionPicker();
                            return;
                          }
                        }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (!loading && !isSending) {
                            void sendMessage();
                          }
                        }
                      }}
                      placeholder={
                        clientModeEnabled
                          ? 'Спросите о клиенте, сне, сессии…'
                          : 'Спросите о клиенте — после «клиента» появится @ и список'
                      }
                      disabled={loading || isSending}
                      onPaste={(e) => {
                        const items = e.clipboardData?.items;
                        if (!items?.length) return;
                        const imageFiles: File[] = [];
                        for (let i = 0; i < items.length; i++) {
                          const item = items[i];
                          if (item.kind === 'file' && item.type.startsWith('image/')) {
                            const f = item.getAsFile();
                            if (f) imageFiles.push(f);
                          }
                        }
                        if (imageFiles.length) {
                          e.preventDefault();
                          const dt = new DataTransfer();
                          imageFiles.forEach((f) => dt.items.add(f));
                          void handleAttachmentFiles(dt.files);
                        }
                      }}
                      style={{ fontSize: isMobileView ? 13 : 15 }}
                      rows={1}
                    />
                    <button
                      type="button"
                      className="ai-chat-composer__send"
                      onClick={() => {
                        void sendMessage();
                      }}
                      disabled={(!input.trim() && !pendingAttachments.length) || loading || isSending}
                      aria-label="Отправить"
                      title="Отправить"
                    >
                      {loading || isSending ? (
                        <span aria-hidden>…</span>
                      ) : (
                        <Send size={18} strokeWidth={2.25} aria-hidden />
                      )}
                    </button>
                  </div>
                  </div>
                  {aiQuota && (
                    <div className="ai-chat-quota">{formatQuotaUnderInput(aiQuota)}</div>
                  )}
                </div>
              </div>

          </>
          )}
        </div>
      </div>

      {showDreamScopeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 3500,
            padding: 16
          }}
          onClick={() => {
            setShowDreamScopeModal(false);
            setPendingDreamMessage('');
            setDreamScopePreview(null);
            setDreamScopeStep('idle');
          }}
        >
          <div
            className="card"
            style={{
              width: 'min(680px, 100%)',
              background: 'var(--surface)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: 20
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, marginBottom: 8, fontSize: 20 }}>Выберите объем анализа снов</h3>
            <p style={{ margin: 0, marginBottom: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {dreamScopePreview?.selectedClient
                ? `Считаем сны только клиента «${dreamScopePreview.selectedClient}». Выберите период анализа.`
                : selectedClient
                  ? `Считаем сны только клиента «${selectedClient.name}». Выберите период анализа.`
                  : 'Обобщённый режим: в подсчёт входят сны всех клиентов (@все клиенты или без @имени). Выберите период анализа.'}
            </p>
            {loadingDreamScopePreview ? (
              <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
                Шаг 1/2: считаем количество снов и оцениваем объем...
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                {(['30d', '90d', '365d', 'all'] as DreamsContextRange[]).map((range) => {
                  const label =
                    range === '30d' ? 'Последние 30 дней' :
                    range === '90d' ? 'Последние 90 дней' :
                    range === '365d' ? 'Последний год' : 'Все время';
                  const stat = dreamScopePreview?.stats?.[range];
                  const count = stat?.count ?? 0;
                  const cappedCount = stat?.cappedCount ?? 0;
                  const promptTokens = stat?.estimatedPromptTokens ?? 0;
                  const selected = selectedDreamScopeRange === range;
                  return (
                    <label
                      key={range}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: selected ? '1px solid rgba(91,124,250,0.5)' : '1px solid rgba(255,255,255,0.12)',
                        background: 'var(--surface-2)',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="radio"
                        name="dream-scope"
                        checked={selected}
                        onChange={() => setSelectedDreamScopeRange(range)}
                        style={{ marginTop: 3 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span>{label}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{count} снов</span>
                        </div>
                        <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                          В запрос уйдет до {cappedCount} снов · ~{promptTokens.toLocaleString('ru-RU')} токенов
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="ai-dream-scope__actions">
              <button
                type="button"
                className="ai-modal-btn ai-modal-btn--secondary"
                onClick={() => {
                  setShowDreamScopeModal(false);
                  setPendingDreamMessage('');
                  setDreamScopePreview(null);
                  setDreamScopeStep('idle');
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                className="ai-modal-btn"
                onClick={() => confirmDreamScopeAndSend(selectedDreamScopeRange)}
                disabled={loadingDreamScopePreview || !dreamScopePreview || dreamScopeStep !== 'ready'}
              >
                Продолжить анализ
              </button>
            </div>
          </div>
        </div>
      )}

      {sendToWa && (
        <div
          className="ai-send-wa-backdrop"
          onClick={() => {
            if (!sendToWaLoading) setSendToWa(null);
          }}
        >
          <div className="ai-send-wa" onClick={(e) => e.stopPropagation()}>
            <h3>Отправить в рабочую область</h3>
            <p>Текст добавится в конец выбранной вкладки через пустую строку.</p>
            <label>
              Клиент
              <select
                value={sendToWaClientId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSendToWaClientId(id);
                  setSendToWaDone(false);
                  void loadSendToWaTabs(id);
                }}
                disabled={sendToWaLoading}
              >
                <option value="">Выберите клиента</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Клиент'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Вкладка
              <select
                value={sendToWaTab}
                onChange={(e) => {
                  setSendToWaTab(e.target.value);
                  setSendToWaDone(false);
                }}
                disabled={sendToWaLoading || !sendToWaClientId}
              >
                {sendToWaTabs.map((tab) => (
                  <option key={tab} value={tab}>
                    {tab}
                  </option>
                ))}
              </select>
            </label>
            {sendToWaError ? <div className="ai-send-wa__error">{sendToWaError}</div> : null}
            {sendToWaDone ? <div className="ai-send-wa__ok">Сохранено в рабочую область</div> : null}
            <div className="ai-send-wa__actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setSendToWa(null)}
                disabled={sendToWaLoading}
              >
                {sendToWaDone ? 'Закрыть' : 'Отмена'}
              </button>
              {!sendToWaDone ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => void confirmSendToWorkArea()}
                  disabled={sendToWaLoading || !sendToWaClientId || !sendToWaTab}
                >
                  {sendToWaLoading ? 'Сохраняю…' : 'Отправить'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts management modal */}
      {false && showShortcutsModal && (
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
      {false && showAddShortcutModal && (
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
                onClick={editingShortcutId ? () => updateShortcut(editingShortcutId!) : addShortcut}
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

      {/* Client picker — listbox with search (§25.7) */}
      {showClientsDropdown && createPortal(
        <div
          className="ai-client-picker-backdrop"
          data-clients-panel
          onClick={() => {
            setShowClientsDropdown(false);
            setClientSearchQuery('');
          }}
        >
          <div
            className="ai-client-picker"
            role="dialog"
            aria-label="Выберите клиента"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ai-client-picker__head">
              <h3>Выберите клиента</h3>
              <button
                type="button"
                className="ai-chat-row__icon-btn"
                aria-label="Закрыть"
                onClick={() => {
                  setShowClientsDropdown(false);
                  setClientSearchQuery('');
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="ai-client-picker__search">
              <input
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                placeholder="Найти клиента"
                autoFocus
              />
            </div>
            <div className="ai-client-picker__body" role="listbox" aria-label="Клиенты">
              <button
                type="button"
                role="option"
                aria-selected={!selectedClientId}
                className={`ai-client-picker__row${!selectedClientId ? ' is-active' : ''}`}
                onClick={() => selectClientForContext(null)}
              >
                <div className="ai-client-picker__avatar" aria-hidden>
                  —
                </div>
                <div className="ai-client-picker__meta">
                  <div className="ai-client-picker__name">Обобщённый режим</div>
                  <div className="ai-client-picker__sub">Без привязки к клиенту</div>
                </div>
              </button>
              {filteredClientsForPicker.map((client) => {
                const active = client.id === selectedClientId;
                return (
                  <button
                    key={client.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`ai-client-picker__row${active ? ' is-active' : ''}`}
                    onClick={() => selectClientForContext(client.id)}
                  >
                    {client.avatarUrl ? (
                      <img
                        className="ai-client-picker__avatar"
                        src={client.avatarUrl}
                        alt=""
                      />
                    ) : (
                      <div className="ai-client-picker__avatar" aria-hidden>
                        {(client.name || '?').trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="ai-client-picker__meta">
                      <div className="ai-client-picker__name">{client.name || 'Клиент'}</div>
                      <div className="ai-client-picker__sub">{client.email || '—'}</div>
                    </div>
                    {active ? <span aria-hidden>✓</span> : null}
                  </button>
                );
              })}
              {!filteredClientsForPicker.length ? (
                <div className="ai-client-picker__empty">Клиенты не найдены</div>
              ) : null}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

