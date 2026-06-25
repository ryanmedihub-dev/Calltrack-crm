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
        primary:    '#6366F1',
        primaryLt:  '#EEF2FF',
        primaryDk:  '#4F46E5',
        accent:     '#F472B6',
        accentLt:   '#FDF2F8',
        bg:         '#F5F7FF',
        card:       '#FFFFFF',
        border:     '#E2E8F4',
        textPrimary:   '#0F172A',
        textSecondary: '#475569',
        textMuted:     '#94A3B8',
        success:   '#10B981',
        successLt: '#ECFDF5',
        danger:    '#EF4444',
        dangerLt:  '#FFF1F2',
        warning:   '#F59E0B',
        warningLt: '#FFFBEB',
        purple:    '#8B5CF6',
        purpleLt:  '#F5F3FF',
        teal:      '#14B8A6',
        tealLt:    '#F0FDFA',
        orange:    '#F97316',
        orangeLt:  '#FFF7ED',
        sidebar:        '#0C0A1E',
        sidebarBorder:  '#1A1730',
        sidebarHov:     '#1E1A35',
        sidebarActive:  '#3730A3',
        sidebarMuted:   '#6B6894',
        sidebarText:    '#A5A3C8',
        sidebarSection: '#4A476B',
      },
      boxShadow: {
        card:       '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(99,102,241,0.06)',
        'card-md':  '0 4px 16px rgba(0,0,0,0.06), 0 8px 24px rgba(99,102,241,0.08)',
        'card-hover':'0 8px 32px rgba(99,102,241,0.16), 0 2px 8px rgba(0,0,0,0.06)',
        modal:      '0 25px 80px rgba(0,0,0,0.20), 0 8px 32px rgba(99,102,241,0.12)',
        sidebar:    '4px 0 32px rgba(0,0,0,0.20)',
        glow:       '0 0 0 3px rgba(99,102,241,0.22)',
        'glow-sm':  '0 0 0 2px rgba(99,102,241,0.18)',
        'inner-glow':'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        'gradient-success': 'linear-gradient(135deg, #10B981 0%, #14B8A6 100%)',
        'gradient-danger':  'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
        'gradient-warning': 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
        'gradient-teal':    'linear-gradient(135deg, #14B8A6 0%, #0EA5E9 100%)',
        'gradient-purple':  'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
        'gradient-pink':    'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #0C0A1E 0%, #110F2A 100%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in-up':   'fadeInUp 0.4s ease-out both',
        'fade-in':      'fadeIn 0.25s ease-out both',
        'scale-in':     'scaleIn 0.2s ease-out both',
        'slide-down':   'slideDown 0.2s ease-out both',
        'slide-left':   'slideInLeft 0.3s ease-out both',
        'pulse-glow':   'pulseGlow 2s ease-in-out infinite',
        'float':        'float 3s ease-in-out infinite',
        'count-up':     'countUp 0.6s ease-out both',
        'shimmer':      'shimmer 1.6s linear infinite',
        'spin-slow':    'spin 3s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0.4)' },
          '50%':      { boxShadow: '0 0 0 6px rgba(99,102,241,0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
    }
  },
  plugins: []
};
