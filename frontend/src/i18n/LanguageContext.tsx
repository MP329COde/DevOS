import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Language = 'fr' | 'en';

const STORAGE_KEY = 'devos.language';

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'fr';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'en' ? 'en' : 'fr';
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setLanguageState }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

/** Sélectionne la variante fr/en d'un dictionnaire de chaînes local à un composant. */
export function useStrings<T extends Record<'fr' | 'en', unknown>>(dict: T): T['fr'] {
  const { language } = useLanguage();
  return dict[language] as T['fr'];
}
