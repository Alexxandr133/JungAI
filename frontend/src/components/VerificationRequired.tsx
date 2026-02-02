import type { VerificationStatus } from '../utils/verification';

interface VerificationRequiredProps {
  verificationStatus?: VerificationStatus | null;
}

export function VerificationRequired({ verificationStatus }: VerificationRequiredProps) {
  return (
    <main style={{ flex: 1, padding: '24px 48px', display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 600 }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🔒</div>
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 24 }}>Требуется верификация</div>
        <div style={{ marginBottom: 24, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Для доступа к рабочей области и инструментам необходимо пройти верификацию администратором.
          {verificationStatus === 'pending' && (
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(255, 193, 7, 0.1)', borderRadius: 8, color: '#ffc107' }}>
              ⏳ Ваш запрос на верификацию находится на рассмотрении
            </div>
          )}
          {verificationStatus === 'rejected' && (
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(244, 67, 54, 0.1)', borderRadius: 8, color: '#f44336' }}>
              ❌ Ваш запрос на верификацию был отклонен. Пожалуйста, отправьте новый запрос.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/psychologist/profile" className="button" style={{ textDecoration: 'none' }}>
            Перейти к профилю для верификации
          </a>
        </div>
      </div>
    </main>
  );
}

