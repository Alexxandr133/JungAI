import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlatformIcon } from '../../icons';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';

type TaskRow = {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  dueAt?: string | null;
  status?: string;
};

type ClientOpt = { id: string; name: string };

interface Props {
  data: any;
  size: 'small' | 'medium' | 'large';
  config?: Record<string, any>;
  onRefresh?: () => void;
}

function formatDue(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function OpenClientTasksWidget({ data, size, onRefresh }: Props) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<TaskRow[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bundle = data?.openClientTasks;
    const next: TaskRow[] = Array.isArray(bundle?.items) ? bundle.items : [];
    setItems(next.filter((t) => t.status !== 'done'));
  }, [data]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const res = await api<{ items: Array<{ id: string; name?: string; therapyEndedAt?: string | null }> }>(
          '/api/clients',
          { token }
        );
        const opts = (res.items || [])
          .filter((c) => !c.therapyEndedAt)
          .map((c) => ({ id: c.id, name: c.name || 'Клиент' }));
        setClients(opts);
        if (!clientId && opts[0]) setClientId(opts[0].id);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const count = items.length;
  const shown = items.slice(0, size === 'small' ? 3 : 6);

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  async function createTask(e: FormEvent) {
    e.preventDefault();
    stop(e as unknown as MouseEvent);
    if (!token || !clientId || !title.trim()) return;
    setBusy(true);
    setError(null);
    const draftTitle = title.trim();
    const clientName = clients.find((c) => c.id === clientId)?.name || 'Клиент';
    try {
      const created = await api<TaskRow & { id: string; status?: string }>('/api/tasks', {
        method: 'POST',
        token,
        body: { clientId, title: draftTitle },
      });
      setTitle('');
      setItems((prev) => [
        {
          id: created.id,
          title: draftTitle,
          clientId,
          clientName,
          status: created.status || 'todo',
          dueAt: null,
        },
        ...prev,
      ]);
      onRefresh?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось создать');
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone(task: TaskRow, e: MouseEvent) {
    stop(e);
    if (!token) return;
    const next = task.status === 'done' ? 'todo' : 'done';
    setItems((prev) =>
      next === 'done' ? prev.filter((t) => t.id !== task.id) : prev.map((t) => (t.id === task.id ? { ...t, status: next } : t))
    );
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', token, body: { status: next } });
      onRefresh?.();
    } catch {
      setItems((prev) =>
        next === 'done'
          ? [...prev, task]
          : prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
      onRefresh?.();
    }
  }

  return (
    <div data-widget-control onClick={stop} onMouseDown={stop} onKeyDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          navigate('/clients');
        }}
        title="Мои клиенты"
        style={{
          display: 'block',
          width: '100%',
          border: 0,
          background: 'transparent',
          padding: 0,
          marginBottom: 10,
          textAlign: 'left',
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        <div style={{ marginBottom: 8, color: 'var(--brand, #6c5bd4)' }}>
          <PlatformIcon name="clipboard" size={28} strokeWidth={1.75} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{count}</div>
        <div className="small" style={{ color: 'var(--ink-soft, var(--text-muted))' }}>
          Открытых заданий клиентам
        </div>
      </button>

      <form
        onSubmit={createTask}
        style={{ display: 'grid', gap: 6, marginBottom: 10 }}
        onClick={stop}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          style={{
            width: '100%',
            padding: '7px 8px',
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'var(--surface-2)',
            color: 'var(--ink)',
            fontSize: 12,
          }}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Новое задание…"
            maxLength={200}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '7px 8px',
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              fontSize: 12,
            }}
          />
          <button
            type="submit"
            disabled={busy || !title.trim() || !clientId}
            className="button"
            style={{ padding: '7px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
          >
            +
          </button>
        </div>
        {error ? <div style={{ fontSize: 11, color: 'var(--danger, #d4574e)' }}>{error}</div> : null}
      </form>

      {shown.length === 0 ? (
        <div className="small" style={{ color: 'var(--ink-muted)' }}>
          Нет открытых заданий
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {shown.map((t) => (
            <li
              key={t.id}
              style={{
                fontSize: 12,
                lineHeight: 1.35,
                color: 'var(--ink, var(--text))',
                borderTop: '1px solid var(--line, rgba(0,0,0,0.06))',
                paddingTop: 6,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <input
                type="checkbox"
                checked={false}
                title="Отметить выполненным"
                onClick={(e) => void toggleDone(t, e)}
                onChange={() => undefined}
                style={{ marginTop: 2 }}
              />
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  navigate(`/clients/${t.clientId}/profile?tab=tasks`);
                }}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'inherit',
                  font: 'inherit',
                  flex: 1,
                }}
              >
                <strong style={{ fontWeight: 650 }}>{t.clientName}</strong>
                <span style={{ color: 'var(--ink-soft, var(--text-muted))' }}> · {t.title}</span>
                {formatDue(t.dueAt) ? (
                  <div style={{ color: 'var(--ink-soft, var(--text-muted))', marginTop: 2 }}>до {formatDue(t.dueAt)}</div>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="button secondary"
        style={{ marginTop: 10, width: '100%', fontSize: 12, padding: '8px 10px' }}
        onClick={(e) => {
          stop(e);
          navigate('/clients');
        }}
      >
        Мои клиенты
      </button>
    </div>
  );
}
