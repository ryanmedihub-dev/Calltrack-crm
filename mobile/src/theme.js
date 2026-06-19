export const C = {
  bg:           '#F4F7FF',
  surface:      '#FFFFFF',
  surfaceAlt:   '#F8FAFF',

  primary:      '#1A6BFF',
  primaryLight: '#EBF2FF',
  primaryDark:  '#0050CC',

  incoming:     '#16A34A',
  incomingBg:   '#DCFCE7',
  outgoing:     '#D97706',
  outgoingBg:   '#FEF3C7',
  missed:       '#DC2626',
  missedBg:     '#FFF1F1',
  rejected:     '#7C3AED',
  rejectedBg:   '#F3F0FF',

  text:         '#0F172A',
  textSec:      '#475569',
  textMuted:    '#94A3B8',

  border:       '#E2E8F0',
  shadow:       'rgba(15,23,42,0.06)',
};

export const TYPE = {
  incoming: { fg: C.incoming, bg: C.incomingBg, label: 'Incoming', icon: '↙' },
  outgoing: { fg: C.outgoing, bg: C.outgoingBg, label: 'Outgoing', icon: '↗' },
  missed:   { fg: C.missed,   bg: C.missedBg,   label: 'Missed',   icon: '↙' },
  rejected: { fg: C.rejected, bg: C.rejectedBg, label: 'Rejected', icon: '✕' },
};
