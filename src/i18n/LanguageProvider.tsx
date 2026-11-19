import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { applyLanguage, storedLanguageSetting, type Lang, type LangSetting } from '.';

interface LanguageContextValue {
  /** The language in use. */
  lang: Lang;
  /** What the user picked ('system' follows the device). */
  setting: LangSetting;
  /** Switch language on this device (saved on the device). */
  setLanguage(setting: LangSetting): void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Owns the language in use. The device keeps it, so the right language shows before sign-in and offline. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [setting, setSetting] = useState<LangSetting>(storedLanguageSetting);
  const [lang, setLang] = useState<Lang>(() => applyLanguage(setting));

  const setLanguage = useCallback((next: LangSetting) => {
    setSetting(next);
    setLang(applyLanguage(next));
  }, []);

  return <LanguageContext.Provider value={{ lang, setting, setLanguage }}>{children}</LanguageContext.Provider>;
}

/**
 * Re-renders its children from scratch when the language changes, so every screen shows the new
 * text. Placed below the router and the sign-in, so switching keeps you where you are.
 */
export function LanguageScope({ children }: { children: ReactNode }) {
  const { lang } = useLanguage();
  return <Keyed key={lang}>{children}</Keyed>;
}

function Keyed({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
