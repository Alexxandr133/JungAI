import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
// Загружаем переводы
import ruTranslations from '../locales/ru';
import enTranslations from '../locales/en';

export type Language = 'ru' | 'en';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  ru: ruTranslations,
  en: enTranslations,
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Загружаем сохраненный язык из localStorage или определяем по браузеру
    const saved = localStorage.getItem('app_language') as Language;
    if (saved && (saved === 'ru' || saved === 'en')) {
      return saved;
    }
    // Определяем язык браузера
    const browserLang = navigator.language.split('-')[0];
    return browserLang === 'ru' ? 'ru' : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

