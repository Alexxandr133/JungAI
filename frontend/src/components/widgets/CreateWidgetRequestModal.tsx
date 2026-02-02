import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

interface CreateWidgetRequestModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateWidgetRequestModal({
  onClose,
  onSuccess
}: CreateWidgetRequestModalProps) {
  const { token } = useAuth();
  const [widgetName, setWidgetName] = useState('');
  const [widgetDescription, setWidgetDescription] = useState('');
  const [widgetPurpose, setWidgetPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      await api('/api/support', {
        method: 'POST',
        token,
        body: {
          title: `Запрос на создание виджета: ${widgetName}`,
          description: `Название виджета: ${widgetName}\n\nОписание: ${widgetDescription}\n\nНазначение: ${widgetPurpose}`,
          allowWorkAreaAccess: false
        }
      });
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (e: any) {
      setError(e.message || 'Не удалось отправить запрос');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5,8,16,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 1000,
          padding: 16
        }}
        onClick={onClose}
      >
        <div
          className="card"
          style={{
            width: 'min(500px, 94vw)',
            padding: 32,
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            background: 'var(--surface)',
            textAlign: 'center'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
            Запрос отправлен
          </div>
          <div className="small" style={{ color: 'var(--text-muted)' }}>
            Ваш запрос на создание виджета отправлен администратору. Вы получите уведомление после рассмотрения.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,8,16,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: 'min(600px, 94vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 0,
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
              Запрос на создание виджета
            </div>
            <div className="small" style={{ color: 'var(--text-muted)' }}>
              Опишите виджет, который вы хотели бы видеть на дашборде
            </div>
          </div>
          <button
            className="button secondary"
            onClick={onClose}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: 8
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'grid', gap: 20 }}>
          {error && (
            <div
              style={{
                padding: 12,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 12,
                color: '#ef4444',
                fontSize: 14
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              className="small"
              style={{
                display: 'block',
                marginBottom: 8,
                color: 'var(--text-muted)',
                fontWeight: 600
              }}
            >
              Название виджета *
            </label>
            <input
              value={widgetName}
              onChange={(e) => setWidgetName(e.target.value)}
              placeholder="Например: Распределение по возрастам"
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 14
              }}
            />
          </div>

          <div>
            <label
              className="small"
              style={{
                display: 'block',
                marginBottom: 8,
                color: 'var(--text-muted)',
                fontWeight: 600
              }}
            >
              Описание виджета *
            </label>
            <textarea
              value={widgetDescription}
              onChange={(e) => setWidgetDescription(e.target.value)}
              placeholder="Опишите, что должен показывать виджет..."
              required
              rows={4}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          <div>
            <label
              className="small"
              style={{
                display: 'block',
                marginBottom: 8,
                color: 'var(--text-muted)',
                fontWeight: 600
              }}
            >
              Назначение виджета
            </label>
            <textarea
              value={widgetPurpose}
              onChange={(e) => setWidgetPurpose(e.target.value)}
              placeholder="Для чего вам нужен этот виджет? Как вы будете его использовать?"
              rows={3}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '12px 24px', fontSize: 15, fontWeight: 600 }}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="button"
              disabled={submitting || !widgetName || !widgetDescription}
              style={{ padding: '12px 24px', fontSize: 15, fontWeight: 600 }}
            >
              {submitting ? 'Отправка...' : 'Отправить запрос'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
