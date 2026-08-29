import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeCommodities, seedDefaultCommoditiesIfEmpty } from '../services/commodities';
import { subscribeTemplates, seedDefaultTemplateIfEmpty } from '../services/boxTemplates';
import { logger } from '../services/logger';

// Live cache of /commodities and /config/boxTemplates, exposed via
// context. Screens call `useCommodities()` to get the current
// catalog and `useTemplates()` to get the templates.
//
// The first time a fresh org opens the app, the provider seeds the
// default commodity set + the "Standard Food Box" template. After
// that, the seeder is a no-op.
const CommoditiesContext = createContext({
  commodities: [],
  byId: {},
  loading: true,
});

const TemplatesContext = createContext({
  templates: [],
  defaultTemplate: null,
  loading: true,
  error: null,
});

export function CommoditiesProvider({ children }) {
  const [commodities, setCommodities] = useState([]);
  const [loading, setLoading] = useState(true);
  // `error` is reserved for a future "show banner" path. Today the
  // subscribeCommodities callback swallows failures and returns
  // an empty list — see logger.logWarning in the effect below.

  useEffect(() => {
    let cancelled = false;
    // Best-effort seed. If rules block it (cold start before admin
    // promotion), the live subscription below still works once an
    // admin creates the first commodity.
    (async () => {
      try {
        await seedDefaultCommoditiesIfEmpty();
        await seedDefaultTemplateIfEmpty();
      } catch (err) {
        // Silent: an org with no admin yet will fail this — the
        // admin seeds it on first login.
        logger.logWarning('CommoditiesContext/seed', err.message);
      }
    })();

    const unsubscribe = subscribeCommodities((items) => {
      if (cancelled) return;
      // Hide soft-deleted rows.
      setCommodities(items.filter((c) => !c._deleted));
      setLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const byId = useMemo(() => {
    const map = {};
    commodities.forEach((c) => { map[c.id] = c; });
    return map;
  }, [commodities]);

  const value = useMemo(
    () => ({ commodities, byId, loading }),
    [commodities, byId, loading]
  );

  return (
    <CommoditiesContext.Provider value={value}>
      <TemplatesProvider>{children}</TemplatesProvider>
    </CommoditiesContext.Provider>
  );
}

// Templates are coupled to commodities (a template references
// commodityIds), so they live in the same provider. Splitting
// contexts here would only complicate the wiring.
function TemplatesProvider({ children }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeTemplates((items) => {
      setTemplates(items.filter((t) => !t._deleted));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const defaultTemplate = useMemo(
    () => templates.find((t) => t.default) || templates[0] || null,
    [templates]
  );

  const value = useMemo(
    () => ({ templates, defaultTemplate, loading }),
    [templates, defaultTemplate, loading]
  );

  return (
    <TemplatesContext.Provider value={value}>
      {children}
    </TemplatesContext.Provider>
  );
}

export function useCommodities() {
  return useContext(CommoditiesContext);
}

export function useTemplates() {
  return useContext(TemplatesContext);
}
