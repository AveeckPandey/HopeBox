import { useEffect, useState } from 'react';

// Tiny module-level event emitter so any component can call
// `snackbar.show(message, { tone })` without prop-drilling or a Context
// provider. The `<SnackbarHost />` mounted in App.js subscribes and
// renders the result.

let listener = null;

function emit(payload) {
  if (listener) listener(payload);
}

export const snackbar = {
  show(message, { tone = 'info', duration = 3000, action, onAction } = {}) {
    emit({ message, tone, duration, action, onAction });
  },
  success(message, opts = {}) { this.show(message, { ...opts, tone: 'success' }); },
  error(message, opts = {})   { this.show(message, { ...opts, tone: 'error' }); },
  info(message, opts = {})    { this.show(message, { ...opts, tone: 'info' }); },
};

export function useSnackbarHost() {
  const [state, setState] = useState(null);
  useEffect(() => {
    listener = setState;
    return () => { if (listener === setState) listener = null; };
  }, []);
  return state;
}
