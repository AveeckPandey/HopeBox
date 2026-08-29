import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { strings } from "../i18n/strings";
import { merged as hiStrings } from "../i18n/strings.hi";

const LANGUAGE_KEY = "hopebox-language";

type Language = "en" | "hi";

// Single source of truth for all user-facing copy in the app.
// Languages are loaded from the `strings` catalog. When a locale map
// is added, register it under LANGUAGE_KEY in a `loaders` table and
// the rest of the app keeps working unchanged.

const loaders: Record<Language, () => unknown> = {
  en: () => strings,
  // P51: real Hindi catalog. Missing keys fall back to English via
  // the deep merge in `strings.hi.js` so partial translations are
  // safe to ship.
  hi: () => hiStrings,
};

type LanguageValue = {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  // `t` returns the value at the path:
  //   - t('auth') returns the auth scope object (so callers can
  //     do `tAuth.errors.emailInvalid`)
  //   - t('auth.signIn') walks a dotted path and returns the leaf
  //     value (string for most leaves)
  // The single call site picks the shape via the path. The return
  // type is `any` to mirror the original JS behavior where the
  // catalog is data-driven and call sites read properties
  // (`tAuth.errors.emailInvalid`) without runtime type checks.
  // Tightening this is a follow-up — see P11 / batch 5 note.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (path: string) => any;
  tf: (path: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageValue>({
  language: "en",
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setLanguage: async () => {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: ((key: string) => key) as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tf: (key: string) => key as any,
} as LanguageValue);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const loadLanguage = async () => {
      const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (stored && (stored === "en" || stored === "hi")) {
        setLanguageState(stored);
      }
    };
    loadLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    if (!loaders[lang]) return;
    setLanguageState(lang);
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  };

  // `t` supports two call shapes so call sites read naturally:
  //   t('auth.signIn')              // flat dotted path
  //   t('auth', 'signIn')           // scope + key (returns the scope object)
  // `language` is closed-over so the function changes identity when
  // the user switches locale and React re-renders consumers.
  const catalog = (loaders[language] ? loaders[language]() : strings) as Record<string, unknown>;

  const t = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (scopeOrPath: string): any => {
      // Try the dotted-path lookup first. If the path is a single
      // segment that matches a scope, fall through and return the
      // whole scope object so call sites can do
      // `const t = tAll('auth'); t.signIn`.
      const segments = String(scopeOrPath).split(".");
      let cursor: unknown = catalog;
      for (const seg of segments) {
        if (cursor && typeof cursor === "object" && seg in (cursor as Record<string, unknown>)) {
          cursor = (cursor as Record<string, unknown>)[seg];
        } else {
          return scopeOrPath; // fall back to the key itself
        }
      }
      return cursor;
    },
    [catalog]
  );

  // `tf(key, params)` looks up a string template and replaces
  // `{{name}}` placeholders. Use this for accessibility labels and
  // any other text that needs to embed runtime values (box ids,
  // status names, etc.) so it can be localized without changing
  // call sites. Missing keys fall back to the key itself, and
  // missing params are left as the literal `{{name}}` so the
  // developer can spot the bug in dev.
  const tf = useCallback(
    (path: string, params?: Record<string, string | number>) => {
      const raw = t(path) as unknown;
      if (typeof raw !== "string") return "";
      if (!params) return raw;
      return raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m
      );
    },
    [t]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t, tf }),
    [language, t, tf]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
