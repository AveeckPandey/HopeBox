import { useEffect, useState } from 'react';

// Tiny module-level event emitter so any component can call
// `snackbar.show(message, { tone })` without prop-drilling or a Context
// provider. The `<SnackbarHost />` mounted in App.js subscribes and
// renders the result.

export type SnackbarTone = 'info' | 'success' | 'error';
export type SnackbarAction = { label: string; onPress: () => void };
export type SnackbarPayload = {
  message: string;
  tone: SnackbarTone;
  duration: number;
  action?: SnackbarAction;
};

type Listener = ((payload: SnackbarPayload) => void) | null;
let listener: Listener = null;

function emit(payload: SnackbarPayload): void {
  if (listener) listener(payload);
}

type ShowOpts = {
  tone?: SnackbarTone;
  duration?: number;
  action?: SnackbarAction;
};

export const snackbar = {
  show(message: string, { tone = 'info', duration = 3000, action }: ShowOpts = {}): void {
    emit({ message, tone, duration, action });
  },
  success(message: string, opts: ShowOpts = {}): void { this.show(message, { ...opts, tone: 'success' }); },
  error(message: string, opts: ShowOpts = {}): void   { this.show(message, { ...opts, tone: 'error' }); },
  info(message: string, opts: ShowOpts = {}): void    { this.show(message, { ...opts, tone: 'info' }); },
};

export function useSnackbarHost(): SnackbarPayload | null {
  const [state, setState] = useState<SnackbarPayload | null>(null);
  useEffect(() => {
    listener = setState;
    return () => { if (listener === setState) listener = null; };
  }, []);
  return state;
}
