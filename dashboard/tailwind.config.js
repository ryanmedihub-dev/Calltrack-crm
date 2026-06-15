/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
    './src/app/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary:    '#1A6BFF',
        primaryLt:  '#EEF4FF',
        primaryDk:  '#1458D6',
        bg:         '#F1F5F9',
        card:       '#FFFFFF',
        border:     '#E2E8F0',
        textPrimary:    '#0F172A',
        textSecondary:  '#475569',
        textMuted:      '#94A3B8',
        success:   '#10B981',
        successLt: '#ECFDF5',
        danger:    '#EF4444',
        dangerLt:  '#FEF2F2',
        warning:   '#F59E0B',
        warningLt: '#FFFBEB',
        purple:    '#8B5CF6',
        purpleLt:  '#F5F3FF',
        teal:      '#0EA5E9',
        tealLt:    '#F0F9FF',
        sidebar:       '#0F172A',
        sidebarBorder: '#1E293B',
        sidebarHov:    '#1E293B',
        sidebarActive: '#1e3a8a',
        sidebarMuted:  '#64748B',
        sidebarText:   '#CBD5E1',
      },
      boxShadow: {
        card:      '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md': '0 4px 12px rgba(0,0,0,0.08)',
        'card-lg': '0 8px 24px rgba(0,0,0,0.10)',
        modal:     '0 20px 60px rgba(0,0,0,0.18)',
        sidebar:   '4px 0 20px rgba(0,0,0,0.12)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    }
  },
  plugins: []
};
