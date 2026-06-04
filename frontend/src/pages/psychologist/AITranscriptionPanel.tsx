import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, getApiBaseUrl } from '../../lib/api';
import { Mic, Upload, Copy, Trash2, Pencil, Check, X, Maximize2 } from 'lucide-react';
import { addActiveSttJob, getActiveSttJobIds, removeActiveSttJob } from './transcriptionStorage';
import './AITranscriptionPanel.css';

export type TranscriptionStatus = 'processing' | 'completed' | 'failed';

export type TranscriptionItem = {
  id: string;
  title: string;
  sourceFileName: string;
  text: string;
  language?: string | null;
  durationSec?: number | null;
  status: TranscriptionStatus;
  progressPercent: number;
  progressStage?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt?: string;
};

type Props = {
  token: string;
  isMobileView: boolean;
  onJobsChange?: (hasActive: boolean) => void;
};

const AUDIO_ACCEPT = '.mp3,.wav,.m4a,.webm,.ogg,.flac,.aac,.mp4,audio/*';
/** 0 = без проверки размера на клиенте (лимит задаётся на сервере) */
const TRANSCRIPTION_MAX_MB = 0;

function formatDuration(sec?: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r} с`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const SPEAKER_LINE_RE = /^(Спикер\s*\d+|Speaker\s*\d+|Психолог|Клиент|Терапевт|Пациент)\s*:\s*/iu;

export function TranscriptionText({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n');
  return (
    <div className={`ai-transcription-text ${className}`.trim()}>
      {lines.map((line, i) => {
        const m = line.match(SPEAKER_LINE_RE);
        if (m) {
          const label = m[0];
          const body = line.slice(label.length);
          return (
            <div key={i} className="ai-transcription-speaker-line">
              <span className="ai-transcription-speaker-label">{label}</span>
              <span>{body}</span>
            </div>
          );
        }
        if (!line.trim()) {
          return <div key={i} className="ai-transcription-text-gap" aria-hidden />;
        }
        return (
          <p key={i} className="ai-transcription-text-para">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function previewText(text: string, maxLen = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

function uploadWithProgress(
  path: string,
  token: string,
  fd: FormData,
  onProgress: (pct: number) => void
): Promise<{ item: TranscriptionItem }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const base = getApiBaseUrl();
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(12, Math.round((e.loaded / e.total) * 12)));
      }
    };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json);
        } else {
          reject(new Error(json.error || json.message || `Ошибка ${xhr.status}`));
        }
      } catch {
        reject(new Error(xhr.responseText || `Ошибка ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Сеть недоступна при загрузке файла'));
    xhr.ontimeout = () => reject(new Error('Таймаут загрузки'));
    xhr.timeout = 0;
    xhr.send(fd);
  });
}

export function AITranscriptionPanel({ token, isMobileView, onJobsChange }: Props) {
  const [items, setItems] = useState<TranscriptionItem[]>([]);
  const [activeJob, setActiveJob] = useState<TranscriptionItem | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<TranscriptionItem | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const pollInFlightRef = useRef(false);

  const syncBusy = useCallback(
    (job: TranscriptionItem | null) => {
      onJobsChange?.(!!job && job.status === 'processing');
    },
    [onJobsChange]
  );

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await api<{ items: TranscriptionItem[] }>('/api/ai/psychologist/transcriptions', {
        token,
      });
      setItems(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить список');
    } finally {
      setLoadingList(false);
    }
  }, [token]);

  const hydrateActiveJob = useCallback(async () => {
    const ids = getActiveSttJobIds();
    if (!ids.length) {
      setActiveJob(null);
      syncBusy(null);
      return;
    }
    try {
      const res = await api<{ item: TranscriptionItem }>(
        `/api/ai/psychologist/transcriptions/${ids[0]}`,
        { token }
      );
      const item = res.item;
      if (item.status === 'processing') {
        setActiveJob(item);
        syncBusy(item);
        return;
      }
      removeActiveSttJob(ids[0]);
      if (item.status === 'completed') {
        setItems((prev) => (prev.some((t) => t.id === item.id) ? prev : [item, ...prev]));
        setActiveJob(null);
        syncBusy(null);
      } else if (item.status === 'failed') {
        setActiveJob(item);
        setError(item.errorMessage || 'Транскрибация не удалась');
        syncBusy(null);
      }
    } catch {
      /* ignore — следующий опрос */
    }
  }, [token, syncBusy]);

  const pollActiveJob = useCallback(async () => {
    if (pollInFlightRef.current) return;
    const id = activeJob?.id || getActiveSttJobIds()[0];
    if (!id) return;
    pollInFlightRef.current = true;
    try {
      const res = await api<{ item: TranscriptionItem }>(`/api/ai/psychologist/transcriptions/${id}`, {
        token,
      });
      const item = res.item;
      if (item.status === 'processing') {
        setActiveJob(item);
        syncBusy(item);
        return;
      }
      removeActiveSttJob(id);
      setActiveJob(null);
      syncBusy(null);
      if (item.status === 'completed') {
        setError(null);
        setItems((prev) => (prev.some((t) => t.id === item.id) ? prev : [item, ...prev]));
      } else if (item.status === 'failed') {
        setActiveJob(item);
        setError(item.errorMessage || 'Транскрибация не удалась');
      }
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!msg.includes('Слишком много запросов')) {
        console.warn('poll transcription', msg);
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }, [token, activeJob?.id, syncBusy]);

  useEffect(() => {
    void (async () => {
      await loadList();
      await hydrateActiveJob();
    })();
  }, [loadList, hydrateActiveJob]);

  useEffect(() => {
    if (!modalItem) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalItem]);

  useEffect(() => {
    const hasWork =
      uploading || activeJob?.status === 'processing' || getActiveSttJobIds().length > 0;
    if (!hasWork) return;
    const interval = setInterval(() => void pollActiveJob(), 6000);
    return () => clearInterval(interval);
  }, [uploading, activeJob?.status, activeJob?.id, pollActiveJob]);

  async function transcribeFile(file: File) {
    if (!file) return;
    if (TRANSCRIPTION_MAX_MB > 0) {
      const maxBytes = TRANSCRIPTION_MAX_MB * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ).`);
        return;
      }
    }
    setUploading(true);
    setUploadPercent(0);
    setError(null);
    const fd = new FormData();
    fd.append('audio', file);
    try {
      const res = await uploadWithProgress(
        '/api/ai/psychologist/transcriptions',
        token,
        fd,
        setUploadPercent
      );
      addActiveSttJob(res.item.id);
      setActiveJob(res.item);
      setUploadPercent(res.item.progressPercent || 15);
      syncBusy(res.item);
    } catch (e: any) {
      const msg = e?.message || 'Ошибка транскрибации';
      setError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (file) void transcribeFile(file);
  }

  async function handleDelete(id: string, opts?: { skipConfirm?: boolean }) {
    if (!opts?.skipConfirm && !window.confirm('Удалить эту транскрибацию?')) return;
    try {
      await api(`/api/ai/psychologist/transcriptions/${id}`, { method: 'DELETE', token });
      removeActiveSttJob(id);
      setItems((prev) => prev.filter((t) => t.id !== id));
      if (activeJob?.id === id) {
        setActiveJob(null);
        syncBusy(null);
      }
      if (modalItem?.id === id) setModalItem(null);
    } catch (e: any) {
      setError(e?.message || 'Не удалось удалить');
    }
  }

  function dismissActiveJob() {
    if (activeJob?.id) void handleDelete(activeJob.id, { skipConfirm: true });
    else {
      setActiveJob(null);
      setError(null);
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError('Не удалось скопировать в буфер');
    }
  }

  function startRename(item: TranscriptionItem, e?: React.MouseEvent) {
    e?.stopPropagation();
    setRenamingId(item.id);
    setRenameDraft(item.title);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameDraft('');
  }

  async function saveRename(id: string) {
    const title = renameDraft.trim();
    if (!title) {
      setError('Название не может быть пустым');
      return;
    }
    setSavingRename(true);
    setError(null);
    try {
      const res = await api<{ item: TranscriptionItem }>(`/api/ai/psychologist/transcriptions/${id}`, {
        method: 'PATCH',
        token,
        body: { title },
      });
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, title: res.item.title } : t)));
      if (modalItem?.id === id) setModalItem({ ...modalItem, title: res.item.title });
      cancelRename();
    } catch (e: any) {
      setError(e?.message || 'Не удалось сохранить название');
    } finally {
      setSavingRename(false);
    }
  }

  function openItem(item: TranscriptionItem) {
    setModalItem(item);
  }

  const showJobProgress =
    uploading || activeJob?.status === 'processing' || activeJob?.status === 'failed';
  const activeProgress = uploading
    ? uploadPercent
    : activeJob?.progressPercent ?? 0;
  const jobBusy = uploading || activeJob?.status === 'processing';

  return (
    <div className="ai-transcription-root">
      <p className="ai-transcription-hint small">
        Загрузите аудиозапись сессии или интервью — сервис подготовит текстовую расшифровку с репликами
        собеседников. Подходят MP3, WAV, OGG, M4A и другие форматы; длинные записи (в том числе на несколько
        часов) обрабатываются автоматически.
      </p>

      <div
        className={`ai-transcription-dropzone${dragOver ? ' ai-transcription-dropzone--active' : ''}${jobBusy ? ' ai-transcription-dropzone--busy' : ''}${activeJob?.status === 'failed' ? ' ai-transcription-dropzone--failed' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!jobBusy) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !jobBusy && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!jobBusy) fileInputRef.current?.click();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={AUDIO_ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="ai-transcription-dropzone-icon">
          {jobBusy ? <span className="ai-transcription-spinner" /> : <Upload size={28} />}
        </div>
        <div style={{ fontWeight: 600, fontSize: isMobileView ? 14 : 16 }}>
          {uploading
            ? 'Загрузка…'
            : activeJob?.status === 'processing'
              ? activeJob.title || 'Транскрибация…'
              : activeJob?.status === 'failed'
                ? 'Ошибка транскрибации'
                : 'Выбрать файл'}
        </div>
        {!jobBusy && activeJob?.status !== 'failed' && (
          <div className="small" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            или перетащите сюда
          </div>
        )}
        {showJobProgress && (
          <div className="ai-transcription-progress-wrap">
            {activeJob?.status !== 'failed' && (
              <>
                <div className="ai-transcription-progress-bar">
                  <div
                    className="ai-transcription-progress-fill"
                    style={{ width: `${Math.min(100, activeProgress)}%` }}
                  />
                </div>
                <span className="ai-transcription-progress-label">
                  {uploading
                    ? `Загрузка ${uploadPercent}%`
                    : `${activeProgress}% — ${activeJob?.progressStage || 'Обработка'}`}
                </span>
              </>
            )}
            {activeJob?.status === 'failed' && (
              <div className="ai-transcription-dropzone-error">
                {activeJob.errorMessage || error || 'Не удалось распознать запись'}
              </div>
            )}
            {activeJob?.status === 'failed' && (
              <button
                type="button"
                className="button secondary ai-transcription-dismiss-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissActiveJob();
                }}
              >
                Убрать
              </button>
            )}
          </div>
        )}
      </div>

      {error && !activeJob && <div className="ai-transcription-error">{error}</div>}

      <div className="ai-transcription-list-header">
        <Mic size={18} />
        <span>Записи ({items.length})</span>
        {loadingList && <span className="small">загрузка…</span>}
      </div>

      <div className="ai-transcription-list">
        {!loadingList && items.length === 0 && (
          <div className="ai-transcription-empty">Пока нет записей. Загрузите первый аудиофайл.</div>
        )}
        {items.map((item) => (
          <div key={item.id} className="ai-transcription-card">
            <button type="button" className="ai-transcription-card-head" onClick={() => openItem(item)}>
              <div className="ai-transcription-card-head-text">
                {renamingId === item.id ? (
                  <input
                    ref={renameInputRef}
                    className="ai-transcription-rename-input"
                    value={renameDraft}
                    maxLength={200}
                    disabled={savingRename}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') void saveRename(item.id);
                      if (e.key === 'Escape') cancelRename();
                    }}
                  />
                ) : (
                  <div className="ai-transcription-card-title">{item.title}</div>
                )}
                <div className="ai-transcription-card-meta">
                  {formatDate(item.createdAt)}
                  {item.durationSec != null ? ` · ${formatDuration(item.durationSec)}` : ''}
                </div>
                {item.text && (
                  <div className="ai-transcription-card-preview">{previewText(item.text)}</div>
                )}
              </div>
              <Maximize2 size={18} className="ai-transcription-open-icon" />
            </button>
            {renamingId === item.id ? (
              <div className="ai-transcription-card-tools">
                <button
                  type="button"
                  className="ai-transcription-icon-btn"
                  title="Сохранить"
                  disabled={savingRename}
                  onClick={() => void saveRename(item.id)}
                >
                  <Check size={18} />
                </button>
                <button type="button" className="ai-transcription-icon-btn" title="Отмена" onClick={cancelRename}>
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="ai-transcription-card-tools">
                <button
                  type="button"
                  className="ai-transcription-icon-btn"
                  title="Переименовать"
                  onClick={(e) => startRename(item, e)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="ai-transcription-icon-btn ai-transcription-icon-btn--danger"
                  title="Удалить"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(item.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {modalItem &&
        createPortal(
          <div
            className="ai-transcription-modal-backdrop"
            role="presentation"
            onClick={() => setModalItem(null)}
          >
            <div
              className="ai-transcription-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ai-transcription-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ai-transcription-modal-header">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2 id="ai-transcription-modal-title" className="ai-transcription-modal-title">
                    {modalItem.title}
                  </h2>
                  <div className="ai-transcription-card-meta">
                    {formatDate(modalItem.createdAt)}
                    {modalItem.sourceFileName ? ` · ${modalItem.sourceFileName}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="ai-transcription-icon-btn"
                  onClick={() => setModalItem(null)}
                  title="Закрыть"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="ai-transcription-modal-body">
                {modalItem.status === 'processing' && (
                  <div className="ai-transcription-progress-wrap ai-transcription-progress-wrap--modal">
                    <div className="ai-transcription-progress-bar">
                      <div
                        className="ai-transcription-progress-fill"
                        style={{ width: `${modalItem.progressPercent}%` }}
                      />
                    </div>
                    <span className="ai-transcription-progress-label">
                      {modalItem.progressPercent}% — {modalItem.progressStage || 'Обработка'}
                    </span>
                  </div>
                )}
                {modalItem.status === 'failed' && (
                  <div className="ai-transcription-error">
                    {modalItem.errorMessage || 'Не удалось распознать запись'}
                  </div>
                )}
                {modalItem.status === 'completed' && (
                  <TranscriptionText text={modalItem.text} className="ai-transcription-text--modal" />
                )}
              </div>

              <div className="ai-transcription-modal-footer">
                {modalItem.status === 'completed' && (
                  <button type="button" className="button secondary" onClick={() => void handleCopy(modalItem.text)}>
                    <Copy size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Копировать
                  </button>
                )}
                <button
                  type="button"
                  className="button secondary"
                  style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.35)' }}
                  onClick={() => void handleDelete(modalItem.id)}
                >
                  <Trash2 size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Удалить
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
