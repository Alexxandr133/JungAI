import { useI18n } from '../context/I18nContext';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  const toggleLanguage = () => {
    setLanguage(language === 'ru' ? 'en' : 'ru');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="button secondary"
      style={{
        padding: '6px 12px',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minWidth: 'auto',
      }}
      title={t('language.switch')}
    >
      <span>{language === 'ru' ? '🇷🇺' : '🇬🇧'}</span>
      <span>{language.toUpperCase()}</span>
    </button>
  );
}

