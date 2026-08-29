// Tiny event-emitter for "a Firestore listener was denied".
//
// The use case: a single screen in the bottom tab might be
// permission-denied for the current user's role, but the rest of the
// app still works. Without this, each screen invents its own error
// UI, and a transient permission flap during role updates prints
// 4-5 stack traces to the console at once.
//
// <PermissionBanner /> subscribes to this emitter once at the root
// and shows ONE human-readable notice. The notice is dismissable
// (cleared when the next snapshot succeeds) and never re-fires for
// the same error within 10s.
//
// The emitter is intentionally module-level: it has no React
// dependencies, so it can be imported from services/ or contexts/
// without dragging the rest of the app's tree along.

const listeners = new Set();

// Coalesce identical permission errors for this many ms. Prevents
// the banner from re-flickering when several listeners fail in
// rapid succession.
let lastEvent = null;

function emit(event) {
  if (lastEvent && lastEvent.message === event.message) {
    // Same message as the last emission; update the timestamp but
    // skip notifying listeners — banner is already showing.
    lastEvent = { ...event, at: Date.now() };
    return;
  }
  lastEvent = { ...event, at: Date.now() };
  for (const fn of listeners) {
    try {
      fn(lastEvent);
    } catch {
      // Don't let a bad listener tear down the others.
    }
  }
}

export function reportPermissionError(event) {
  emit({ source: 'unknown', ...event, at: Date.now() });
}

export function subscribeToPermissionErrors(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Clear the last-event memory. Called by <PermissionBanner /> when
 * a snapshot succeeds so the next failure isn't deduped against a
 * stale event.
 */
export function acknowledgePermissionError() {
  lastEvent = null;
}
