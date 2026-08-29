import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { strings } from "../i18n/strings";
import { merged as hiStrings } from "../i18n/strings.hi";

const LANGUAGE_KEY = "hopebox-language";

// Single source of truth for all user-facing copy in the app.
// Languages are loaded from the `strings` catalog. When a locale map
// is added, register it under LANGUAGE_KEY in a `loaders` table and
// the rest of the app keeps working unchanged.

const loaders = {
  en: () => strings,
  // P51: real Hindi catalog. Missing keys fall back to English via
  // the deep merge in `strings.hi.js` so partial translations are
  // safe to ship.
  hi: () => hiStrings,
};

const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState("en");

  useEffect(() => {
    const loadLanguage = async () => {
      const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (stored && loaders[stored]) {
        setLanguageState(stored);
      }
    };
    loadLanguage();
  }, []);

  const setLanguage = async (lang) => {
    if (!loaders[lang]) return;
    setLanguageState(lang);
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  };

  // `t` supports two call shapes so call sites read naturally:
  //   t('auth.signIn')              // flat dotted path
  //   t('auth', 'signIn')           // scope + key (returns the scope object)
  // `language` is closed-over so the function changes identity when
  // the user switches locale and React re-renders consumers.
  const catalog = loaders[language] ? loaders[language]() : strings;

  const t = useCallback(
    (scopeOrPath, maybeKey) => {
      if (maybeKey === undefined) {
        // Flat dotted-path lookup, e.g. t('auth.signIn')
        const segments = String(scopeOrPath).split(".");
        let cursor = catalog;
        for (const seg of segments) {
          if (cursor && typeof cursor === "object" && seg in cursor) {
            cursor = cursor[seg];
          } else {
            return scopeOrPath; // fall back to the key itself
          }
        }
        return cursor;
      }
      // Two-arg form: return the whole scope object so call sites can
      // do `const t = tAll('auth'); t.signIn`.
      const scope = catalog[scopeOrPath];
      return scope || {};
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
    (path, params) => {
      const raw = t(path);
      if (typeof raw !== "string") return raw;
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
