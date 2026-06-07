import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  acceptedTerms: boolean;
  onAcceptedTermsChange: (v: boolean) => void;
  acceptedSpecial?: boolean;
  onAcceptedSpecialChange?: (v: boolean) => void;
  showSpecialCategory?: boolean;
};

function ConsentCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        cursor: 'pointer',
        fontSize: 13,
        lineHeight: 1.5,
        color: 'var(--text-muted)',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3, flexShrink: 0 }}
      />
      <span>{children}</span>
    </label>
  );
}

export function LegalRegistrationConsent({
  acceptedTerms,
  onAcceptedTermsChange,
  acceptedSpecial = false,
  onAcceptedSpecialChange,
  showSpecialCategory = false,
}: Props) {
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 4 }}>
      <ConsentCheckbox checked={acceptedTerms} onChange={onAcceptedTermsChange}>
        Я ознакомлен(а) и согласен(на) с{' '}
        <Link to="/terms" target="_blank" rel="noopener noreferrer">
          Пользовательским соглашением
        </Link>{' '}
        и{' '}
        <Link to="/privacy" target="_blank" rel="noopener noreferrer">
          Политикой конфиденциальности
        </Link>
        , и даю согласие на обработку моих персональных данных в соответствии с{' '}
        <Link to="/personal-data-consent" target="_blank" rel="noopener noreferrer">
          Согласием на обработку персональных данных
        </Link>
        , включая данные, которые я самостоятельно размещаю на Платформе.
      </ConsentCheckbox>

      {showSpecialCategory && onAcceptedSpecialChange && (
        <ConsentCheckbox checked={acceptedSpecial} onChange={onAcceptedSpecialChange}>
          Я понимаю, что размещаемые мной материалы (дневники, сны, переписка, записи сессий) могут содержать сведения
          о состоянии здоровья, и даю отдельное согласие на их обработку в целях использования Платформы JungAI.
        </ConsentCheckbox>
      )}
    </div>
  );
}
