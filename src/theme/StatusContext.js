// Maps a box status to its display tone, icon name and human label.
// Centralized so Boxes / BoxDetails / Dashboard / Analytics all agree.

export const BOX_STATUSES = {
  STORED: 'stored',
  DISPATCHED: 'dispatched',
  RETURNED: 'returned',
};

export const STATUS_TONES = {
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

export function statusTone(status, theme) {
  const tone = STATUS_TONES[status] || {
    key: status,
    color: 'text',
    icon: 'help-circle-outline',
    label: status,
  };
  return {
    ...tone,
    resolvedColor: theme?.[tone.color] || theme?.muted || '#888',
  };
}

export function getStatusTone(theme) {
  return (status) => statusTone(status, theme);
}
