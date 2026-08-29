import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { logger } from '../services/logger';
import { reportPermissionError } from './reportPermissionError';

// Light wrapper around `onSnapshot` that:
//   1. Translates raw Firestore docs into `{ id, ...data }` plain
//      objects (most callers want that; without it, every consumer
//      reimplements the same `.map((d) => ({ id: d.id, ...d.data() }))`).
//   2. Surfaces permission-denied errors via the `reportPermissionError`
//      emitter so a top-level <PermissionBanner /> can show a single
//      human-readable notice instead of every screen inventing its
//      own error UX.
//   3. Routes other errors through `logger.logWarning` so we don't
//      drop them on the floor and so Sentry can pick them up later.
//   4. Returns an `unsubscribe` function callers can pair with
//      `useEffect` cleanup; the unsubscribe is also called when
//      the component unmounts or the query reference changes.
//
// Two flavours are exported:
//   `useFirestoreSubscription(query, opts)` — React hook for the
//     "subscribe and render" pattern. Returns `{ data, loading, error }`.
//   `subscribeFirestore(query, onData, onError?)` — low-level
//     helper for callers that already have their own state plumbing
//     (e.g. the services in `src/services/`).
//   `firestoreOnError(context, err)` — drop-in error callback for
//     raw `onSnapshot(query, onData, onError)` call sites. Routes
//     permission-denied errors to the global PermissionBanner and
//     other failures to the logger. This is what every screen in the
//     app should pass as the third argument to `onSnapshot`.
const PERMISSION_DENIED = 'permission-denied';

function isPermissionDenied(err) {
  // Firestore surfaces this as err.code === 'permission-denied' on
  // web and a few related strings on iOS/Android. Match all of them
  // so the banner shows for the right reason.
  if (!err) return false;
  if (err.code === PERMISSION_DENIED) return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('permission') && msg.includes('denied');
}

/**
 * One-stop error callback for raw `onSnapshot` call sites.
 * Mirrors the routing that `subscribeFirestore` does internally,
 * so screens that use `useEffect` + `onSnapshot` directly don't
 * have to reinvent the permission-error vs. generic-error split.
 *
 * @param {string} context  Short tag for the logger, e.g. 'Boxes'.
 * @param {Error}  err      The error from `onSnapshot`'s third arg.
 */
export function firestoreOnError(context, err) {
  if (!err) return;
  if (isPermissionDenied(err)) {
    reportPermissionError({ source: context, message: err.message, code: err.code });
  } else {
    logger.logWarning(context, err.message || String(err), { code: err.code });
  }
}

/**
 * Subscribe to a Firestore query and return the latest data.
 *
 * @param {Query|DocumentReference|null} query
 *   Firestore query or document ref. Pass `null` to skip the
 *   subscription (e.g. when a parent doc id isn't available yet).
 * @param {object} [opts]
 * @param {any} [opts.initialData]  Value to return while the first
 *   snapshot is still loading. Default: `null`.
 * @returns {{ data: any, loading: boolean, error: Error|null }}
 */
export function useFirestoreSubscription(query, opts = {}) {
  const { initialData = null } = opts;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(query != null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (query == null) {
      // Intentional synchronous setState for initial render - this is
      // necessary to avoid a flash of loading state. The lint rule
      // warns about cascading renders, but here we're just setting
      // the initial values before the subscription fires.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(initialData);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = subscribeFirestore(
      query,
      (next) => {
        setData(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
    // We deliberately do not include `map` / `initialData` in the deps;
    // changing them between renders shouldn't re-subscribe. The caller
    // is responsible for memoising the query reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { data, loading, error };
}

/**
 * Low-level subscribe helper. Returns the `unsubscribe` function.
 *
 * @param {Query|DocumentReference} query
 * @param {(data: any) => void} onData  Receives mapped data.
 * @param {(err: Error) => void} [onError]  Optional; if omitted, errors
 *   are routed to the permission-error emitter + logger only.
 */
export function subscribeFirestore(query, onData, onError) {
  return onSnapshot(
    query,
    (snapshot) => {
      // `onSnapshot` overload with two callbacks is the docs
      // recommendation; the success signature is the first.
      onData(mapDocs(snapshot));
    },
    (err) => {
      if (isPermissionDenied(err)) {
        reportPermissionError({ source: 'firestore', message: err.message, code: err.code });
      } else {
        logger.logWarning('firestore/subscribe', err.message, { code: err.code });
      }
      if (onError) onError(err);
    }
  );
}

function mapDocs(snapshot) {
  // Some callers pass a DocumentReference, which produces a
  // DocumentSnapshot (not a QuerySnapshot). Treat both uniformly.
  if (snapshot && typeof snapshot.exists === 'boolean') {
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  }
  if (snapshot && Array.isArray(snapshot.docs)) {
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return null;
}

export default useFirestoreSubscription;
