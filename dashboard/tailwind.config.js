/** @type {import('tailwindcss').Config} */
// Neutral scale shared by `gray` and `slate`, so the ~1,000 existing gray-* / slate-* utilities in
// pages all land on the design system's cool neutrals instead of two slightly different greys.
const neutral = {
  50:  '#FAF9FC',
  100: '#F4F3F8',
  200: '#E9E7EF',
  300: '#D5D2DE',
  400: '#A19DB2',
  500: '#6B6880',
  600: '#524F63',
  700: '#3D3A4D',
  800: '#26233A',
  900: '#1A1726',
  950: '#110F1C',
};

const violet = {
  50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 300: '#C4B5FD', 400: '#A78BFA',
  500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9', 800: '#5B21B6', 900: '#4C1D95', 950: '#2E1065',
};

module.exports = {
  content: [
    './src/pages/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
    './src/app/**/*.{js,jsx}',
    './src/lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        gray: neutral,
        slate: neutral,
        // Brand accent is violet: blue-* and indigo-* utilities all resolve to it.
        indigo: violet,
        blue: violet,
        violet,
        primary:   '#7C3AED',
        primaryLt: '#F5F3FF',
        primaryDk: '#6D28D9',
        bg:        '#FAFAFC',
        card:      '#FFFFFF',
        border:    '#E9E7EF',
        divider:   '#F1F0F5',
        textPrimary:   '#1A1726',
        textSecondary: '#4A4658',
        textMuted:     '#6B6880',
        success: '#079455', successLt: '#ECFDF3',
        danger:  '#D92D20', dangerLt:  '#FEF3F2',
        warning: '#B54708', warningLt: '#FFFAEB',
        info:    '#7C3AED', infoLt:    '#F5F3FF',
        ink: { DEFAULT: '#1A1726', 2: '#4A4658', 3: '#6B6880', 4: '#A19DB2' },
        line: { DEFAULT: '#E9E7EF', 2: '#F1F0F5' },
        met: '#079455',
        behind: '#D92D20',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      // Panels are separated by hairline seams; shadow is reserved for things that float.
      boxShadow: {
        sm: 'none',
        DEFAULT: 'none',
        md: 'none',
        card: 'none',
        'card-md': 'none',
        'card-hover': 'none',
        sidebar: 'none',
        lg: '0 12px 32px -8px rgba(26,23,38,0.18), 0 4px 8px -4px rgba(26,23,38,0.06)',
        xl: '0 16px 40px -10px rgba(26,23,38,0.22), 0 6px 12px -6px rgba(26,23,38,0.08)',
        '2xl': '0 24px 56px -12px rgba(26,23,38,0.28)',
        modal: '0 24px 56px -12px rgba(26,23,38,0.28)',
        glow: '0 0 0 3px rgba(124,58,237,0.14)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '0.75rem',
        '3xl': '1rem',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      animation: {
        'fade-in':  'ct-fade 160ms cubic-bezier(0.23,1,0.32,1) both',
        'scale-in': 'ct-pop 200ms cubic-bezier(0.23,1,0.32,1) both',
        shimmer:    'ct-shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
