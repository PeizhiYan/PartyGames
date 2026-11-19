// The app's current language, the CoffeeGlass way. `t` holds the app's own messages and is a plain
// module value, so non-React code (lib/format, the room rules, a game's reducer throwing an error)
// can use it too. Changing the language goes through <LanguageProvider>, which re-renders the app so
// every screen picks it up.
//
// A game's own words live in its folder (`src/games/<id>/messages.ts`), all three languages side
// by side, and are read through `byLanguage` — a game owns its folder, translations included.
import en, { type Messages } from './en';
import ja from './ja';
import zh from './zh';

export type Lang = 'en' | 'zh' | 'ja';
/** What the user picked in Settings: a language, or follow the device. */
export type LangSetting = Lang | 'system';

export const isLangSetting = (v: unknown): v is LangSetting => v === 'system' || v === 'en' || v === 'zh' || v === 'ja';

/** Each language's name in its own language, for the picker (which also shows a flag, see ui/Flag). */
export const LANGUAGES: { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'zh', name: '简体中文' },
  { id: 'ja', name: '日本語' },
];

const BUNDLES: Record<Lang, { messages: Messages; tag: string }> = {
  en: { messages: en, tag: 'en' },
  zh: { messages: zh, tag: 'zh-CN' },
  ja: { messages: ja, tag: 'ja' },
};

const STORAGE_KEY = 'partygames:language';

/** The device's preferred language among the ones we have (any Chinese variant uses Simplified Chinese). */
export function deviceLanguage(): Lang {
  if (typeof navigator === 'undefined') return 'en'; // tests run outside a browser
  for (const l of navigator.languages ?? [navigator.language]) {
    const code = l.toLowerCase();
    if (code.startsWith('zh')) return 'zh';
    if (code.startsWith('ja')) return 'ja';
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

export function storedLanguageSetting(): LangSetting {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLangSetting(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export let lang: Lang = 'en';
export let t: Messages = en;
/** BCP 47 tag of the current language, e.g. for toLocaleDateString. */
export let langTag = 'en';

/** Switch the current language. Called by <LanguageProvider>; use its hook from components. */
export function applyLanguage(setting: LangSetting): Lang {
  try {
    if (setting === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, setting);
  } catch { /* storage unavailable: the choice lasts until reload */ }
  lang = setting === 'system' ? deviceLanguage() : setting;
  ({ messages: t, tag: langTag } = BUNDLES[lang]);
  if (typeof document !== 'undefined') document.documentElement.lang = langTag;
  return lang;
}

/**
 * A set of messages written in every language, read in the current one. A game's `messages.ts`
 * exports `const m = byLanguage({ en, zh, ja })` and calls `m()` where it needs words — at render
 * time, or when a reducer throws an error for the player who made the move.
 */
export function byLanguage<M>(bundles: Record<Lang, M>): () => M {
  return () => bundles[lang];
}

applyLanguage(storedLanguageSetting());
