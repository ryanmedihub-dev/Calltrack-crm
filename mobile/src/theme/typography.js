import { Colors } from './colors';

export const T = {
  display:   { fontSize: 28, fontWeight: '800', color: Colors.text,     lineHeight: 34 },
  h1:        { fontSize: 22, fontWeight: '700', color: Colors.text,     lineHeight: 28 },
  h2:        { fontSize: 18, fontWeight: '700', color: Colors.text,     lineHeight: 24 },
  h3:        { fontSize: 15, fontWeight: '600', color: Colors.text,     lineHeight: 20 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text,     lineHeight: 20 },
  body:      { fontSize: 14, fontWeight: '400', color: Colors.text,     lineHeight: 20 },
  bodySemi:  { fontSize: 14, fontWeight: '600', color: Colors.text,     lineHeight: 20 },
  caption:   { fontSize: 12, fontWeight: '500', color: Colors.textSec,  lineHeight: 16, letterSpacing: 0.2 },
  label:     { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  tiny:      { fontSize: 11, fontWeight: '400', color: Colors.textMuted, lineHeight: 15 },
  mono:      { fontSize: 13, fontFamily: 'monospace', color: Colors.textSec },
  number:    { fontSize: 26, fontWeight: '800', color: Colors.text,     lineHeight: 32 },
};
