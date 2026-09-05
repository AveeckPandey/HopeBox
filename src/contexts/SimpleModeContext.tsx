// P32: Simple Mode. A boolean persisted to AsyncStorage that
// tells consuming components to grow their primary touch targets
// and (later) surface icon-first affordances. The default is
// `false` — turning it on is a deliberate user choice from the
// Settings screen.
//
// We keep this in its own context (rather than rolling it into
// `LanguageContext` or `AppThemeContext`) because the audience
// for it is different: a *user* accessibility preference, not a
// per-account data fetch and not a system-derived theme. The
// token namespace is `hopebox-simple-mode` so it doesn't collide
// with the theme or language keys.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SIMPLE_MODE_KEY = "hopebox-simple-mode";

export type SimpleModeValue = {
  /** Current simple-mode state. `null` while the value is hydrating from storage. */
  simpleMode: boolean | null;
  /** Persist a new value. The state updates synchronously; the AsyncStorage write is fire-and-forget. */
  setSimpleMode: (next: boolean) => Promise<void>;
  /** Convenience: 1.0 when off, 1.25 when on. Use to scale `minHeight` / `paddingVertical` etc. */
  scale: number;
};

const SimpleModeContext = createContext<SimpleModeValue>({
  simpleMode: false,
  setSimpleMode: async () => {},
  scale: 1,
});

export function SimpleModeProvider({ children }: { children: ReactNode }) {
  const [simpleMode, setSimpleModeState] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(SIMPLE_MODE_KEY);
        if (cancelled) return;
        setSimpleModeState(stored === "true");
      } catch {
        // If storage is unavailable, fall back to the default
        // (off) so the app still renders normally.
        if (!cancelled) setSimpleModeState(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSimpleMode = useCallback(async (next: boolean) => {
    setSimpleModeState(next);
    try {
      await AsyncStorage.setItem(SIMPLE_MODE_KEY, next ? "true" : "false");
    } catch {
      // Non-fatal — the in-memory state is already updated.
    }
  }, []);

  const value = useMemo<SimpleModeValue>(() => {
    // During hydration, treat the state as `false` so styles
    // compute deterministically. Callers that need to know
    // "still loading" can read `simpleMode === null` directly.
    const isOn = simpleMode === true;
    return {
      simpleMode: simpleMode ?? false,
      setSimpleMode,
      scale: isOn ? 1.25 : 1,
    };
  }, [simpleMode, setSimpleMode]);

  return (
    <SimpleModeContext.Provider value={value}>
      {children}
    </SimpleModeContext.Provider>
  );
}

export function useSimpleMode(): SimpleModeValue {
  return useContext(SimpleModeContext);
}
