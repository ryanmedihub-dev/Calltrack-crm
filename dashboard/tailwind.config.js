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
        /* Primary blue */
        primary:    '#2563EB',
        primaryLt:  '#EFF6FF',
        primaryDk:  '#1D4ED8',
        /* Grays */
        bg:         '#F1F5F9',
        card:       '#FFFFFF',
        border:     '#E2E8F0',
        divider:    '#F1F5F9',
        textPrimary:   '#0F172A',
        textSecondary: '#374151',
        textMuted:     '#94A3B8',
        /* Semantic */
        success:   '#16A34A',
        successLt: '#F0FDF4',
        danger:    '#DC2626',
        dangerLt:  '#FFF1F2',
        warning:   '#D97706',
        warningLt: '#FFFBEB',
        info:      '#0284C7',
        infoLt:    '#F0F9FF',
        purple:    '#7C3AED',
        purpleLt:  '#F5F3FF',
        teal:      '#0D9488',
        tealLt:    '#F0FDFA',
        orange:    '#EA580C',
        orangeLt:  '#FFF7ED',
        /* Sidebar */
        sidebar:        '#0F172A',
        sidebarBorder:  '#1E293B',
        sidebarHov:     '#1E293B',
        sidebarActive:  '#2563EB',
        sidebarMuted:   '#475569',
        sidebarText:    '#94A3B8',
        sidebarSection: '#334155',
      },
      boxShadow: {
        card:       '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        'card-md':  '0 4px 16px rgba(0,0,0,0.07)',
        'card-hover':'0 8px 24px rgba(0,0,0,0.10)',
        modal:      '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
        sidebar:    '1px 0 0 rgba(255,255,255,0.04)',
        glow:       '0 0 0 3px rgba(37,99,235,0.20)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
        'gradient-success': 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
        'gradient-danger':  'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
        'gradient-warning': 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
        'gradient-purple':  'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
        'gradient-teal':    'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)',
        'gradient-orange':  'linear-gradient(135deg, #EA580C 0%, #F97316 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #0F172A 0%, #0F172A 100%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in-up':  'fadeInUp 0.35s ease-out both',
        'fade-in':     'fadeIn 0.22s ease-out both',
        'scale-in':    'scaleIn 0.2s ease-out both',
        'slide-down':  'slideDown 0.18s ease-out both',
        'pulse-ring':  'pulseRing 2s ease-out infinite',
        'shimmer':     'shimmer 1.5s ease-in-out infinite',
        'spin-slow':   'spin 3s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.96) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400% 0' },
          '100%': { backgroundPosition:  '400% 0' },
        },
        pulseRing: {
          '0%':   { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(59,130,246,0.45)' },
          '70%':  { transform: 'scale(1)',    boxShadow: '0 0 0 8px rgba(59,130,246,0)' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(59,130,246,0)' },
        },
      },
    }
  },
  plugins: []
};
