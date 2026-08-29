// Maps a box status to its display tone, icon name and human label.
// Centralized so Boxes / BoxDetails / Dashboard / Analytics all agree.

import type { ThemePalette } from './AppThemeContext';

export type BoxStatus = 'stored' | 'dispatched' | 'returned';

export const BOX_STATUSES: Record<'STORED' | 'DISPATCHED' | 'RETURNED', BoxStatus> = {
  STORED: 'stored',
  DISPATCHED: 'dispatched',
  RETURNED: 'returned',
};

export type StatusToneKey = 'success' | 'danger' | 'warning' | 'text';

export type StatusTone = {
  key: string;
  color: StatusToneKey;
  icon: string;
  label: string;
};

export const STATUS_TONES: Partial<Record<BoxStatus, StatusTone>> = {
  stored: {
    key: 'stored',
    color: 'success',
    icon: 'archive-outline',
    label: 'Stored',
  },
  dispatched: {
    key: 'dispatched',
    color: 'danger',
    icon: 'truck-fast-outline',
    label: 'Dispatched',
  },
  returned: {
    key: 'returned',
    color: 'warning',
    icon: 'restore',
    label: 'Returned',
  },
};

export function statusTone(status: string, theme?: ThemePalette): StatusTone & { resolvedColor: string } {
  const tone = STATUS_TONES[status as BoxStatus] || {
    key: status,
    color: 'text' as StatusToneKey,
    icon: 'help-circle-outline',
    label: status,
  };
  return {
    ...tone,
    resolvedColor: theme?.[tone.color] || theme?.muted || '#888',
  };
}

export function getStatusTone(theme?: ThemePalette) {
  return (status: string) => statusTone(status, theme);
}
