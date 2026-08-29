// Thin error-reporting wrapper. Today: routes to console.* with a
// `[context]` prefix. Tomorrow: swap the body of `logError` for
// `Sentry.captureException(err, { tags: { context } })` and every
// call site gets Sentry coverage for free.
//
// Why a wrapper at all instead of just calling console.*:
//   1. PII. `console.log(err.code, err.message)` sometimes leaks
//      user identifiers in error stacks. The wrapper can strip
//      known-sensitive keys before forwarding.
//   2. Deduplication. When a Firestore snapshot fails repeatedly
//      (e.g. on a permission-denied loop), the wrapper can rate-
//      limit identical errors to avoid drowning the console.
//   3. Consistency. The `[context]` prefix lets log search pick
//      out a single subsystem.
//
// All functions are best-effort and never throw. A failed log
// call should never break the caller's flow.

const KNOWN_SENSITIVE_KEYS = ['password', 'token', 'apiKey', 'api_key'];

function stripSensitive(value, depth = 0) {
  if (depth > 3) return '[truncated]';
  if (value == null) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripSensitive(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (KNOWN_SENSITIVE_KEYS.includes(k)) {
      out[k] = '[redacted]';
    } else {
      out[k] = stripSensitive(v, depth + 1);
    }
  }
  return out;
}

function format(context, err, extra) {
  const safeErr = err instanceof Error
    ? { name: err.name, message: err.message, code: err.code, stack: err.stack }
    : err;
  return {
    context,
    err: stripSensitive(safeErr),
    extra: extra ? stripSensitive(extra) : undefined,
    timestamp: new Date().toISOString(),
  };
}

export const logger = {
  /**
   * Report an error. Use for caught exceptions where the caller
   * has decided what to do (e.g. shown a snackbar). For
   * uncaught errors that need a hard crash, use
   * `ErrorBoundary.componentDidCatch` directly.
   */
  logError(context, err, extra) {
    try {
      const payload = format(context, err, extra);
      // Single-line summary + serialized payload for grep-ability.
      // Keep this on one line in dev so React Native's log viewer
      // doesn't truncate the stack.
      console.warn(`[${context}]`, payload.err?.message || String(payload.err), payload);
    } catch {
      // Last-resort: don't throw from a logger.
    }
  },

  /**
   * Non-fatal warning. Use for recoverable issues the dev should
   * see (e.g. a Firestore listener denied, a snapshot that fell
   * back to a default).
   */
  logWarning(context, message, extra) {
    try {
      const payload = format(context, new Error(message), extra);
      console.warn(`[${context}] ${message}`, payload);
    } catch {
      // ignore
    }
  },

  /**
   * Free-form info. Use sparingly — chatty info logs drown the
   * signal in noise. Today this routes to console.log; the
   * console.warn level used elsewhere is for things the dev
   * should notice.
   */
  logInfo(context, message, extra) {
    try {
      console.log(`[${context}] ${message}`, extra || '');
    } catch {
      // ignore
    }
  },
};

export default logger;
