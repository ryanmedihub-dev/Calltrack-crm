'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import CommandPalette from './CommandPalette';

const PAGE_TITLES = {
  '/dashboard':             'Dashboard',
  '/analytics':             'Analytics',
  '/analytics/advanced':    'Advanced Analytics',
  '/employees':             'Employees',
  '/employees/leaderboard': 'Leaderboard',
  '/leads':                 'Leads',
  '/leads/pipeline':        'Pipeline',
  '/calls':                 'Call Logs',
  '/calls/live':            'Live Monitor',
  '/calls/targets':         'Daily Targets',
  '/reports':               'Periodic Reports',
  '/reports/client':        'Client Reports',
  '/reports/export':        'Export Center',
  '/notifications':         'Notifications',
  '/scripts':               'Call Scripts',
  '/activity':              'Activity Log',
  '/settings':              'Settings',
};

const PAGE_SUBTITLES = {
  '/dashboard':    'Real-time operations overview',
  '/analytics':    'Trends and performance insights',
  '/calls':        'Review all call activity',
  '/calls/live':   'Monitor active calls in real time',
  '/employees':    'Manage your team',
  '/leads':        'Track and convert contacts',
  '/reports':      'Generate and export reports',
  '/settings':     'Configure your workspace',
};

const PARENTS = {
  analytics: { label: 'Analytics', href: '/analytics' },
  employees: { label: 'Employees', href: '/employees' },
  leads:     { label: 'Leads',     href: '/leads'     },
  calls:     { label: 'Call Logs', href: '/calls'     },
  reports:   { label: 'Reports',   href: '/reports'   },
};

function buildCrumbs(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length <= 1) return null;
  const parent = PARENTS[parts[0]];
  return [
    parent,
    { label: PAGE_TITLES[pathname] || parts[parts.length - 1], href: pathname, current: true },
  ].filter(Boolean);
}

export default function TopBar({ collapsed, onToggle, onMobileToggle, user }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const pageTitle    = PAGE_TITLES[pathname]    || 'CallTrack';
  const pageSubtitle = PAGE_SUBTITLES[pathname] || '';
  const crumbs       = buildCrumbs(pathname);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <>
      <header
        className={[
          'h-14 flex items-center justify-between pl-4 pr-4 lg:pr-5',
          'fixed top-0 right-0 left-0 z-30',
          'transition-all duration-300 ease-in-out',
          collapsed ? 'lg:left-[64px]' : 'lg:left-56',
          scrolled
            ? 'shadow-sm'
            : '',
        ].join(' ')}
        style={{ background: '#ffffff', borderBottom: '1px solid #E2E8F0' }}>

        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onMobileToggle}
            className="lg:hidden flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#64748B' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#64748B'; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <button onClick={onToggle}
            className="hidden lg:flex flex-shrink-0 w-8 h-8 rounded-lg items-center justify-center transition-colors"
            style={{ color: '#64748B' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#64748B'; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <div className="hidden sm:block h-5 w-px" style={{ background: '#E2E8F0' }} />

          <div className="min-w-0">
            {crumbs ? (
              <nav className="flex items-center gap-1.5 min-w-0">
                {crumbs.map((crumb, i) => (
                  <span key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                    {i > 0 && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    )}
                    {crumb.current ? (
                      <span className="font-semibold truncate text-[13px]" style={{ color: '#0F172A' }}>{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href} className="truncate text-[13px] transition-colors"
                        style={{ color: '#94A3B8' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#64748B'}
                        onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}>
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                ))}
              </nav>
            ) : (
              <div className="flex items-baseline gap-2">
                <h1 className="text-[14px] font-bold leading-none" style={{ color: '#0F172A' }}>{pageTitle}</h1>
                {pageSubtitle && (
                  <p className="hidden md:block text-[12px] leading-none truncate" style={{ color: '#94A3B8' }}>{pageSubtitle}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Search — desktop */}
          <button onClick={() => setPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 text-xs px-3 h-8 rounded-lg transition-all"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#94A3B8' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.background = '#EFF6FF'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = '#F8FAFC'; }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span className="hidden md:inline font-medium">Search…</span>
            <kbd className="hidden lg:inline ml-1 text-[10px] rounded px-1 py-0.5 font-mono"
              style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>⌘K</kbd>
          </button>

          {/* Search — mobile */}
          <button onClick={() => setPaletteOpen(true)}
            className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.color = '#2563EB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#94A3B8'; }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          {/* Notifications */}
          <Link href="/notifications"
            className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#64748B' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#64748B'; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full border-2 border-white"
              style={{ background: '#EF4444' }} />
          </Link>

          {/* Live badge */}
          <span className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold px-2.5 h-6 rounded-full select-none"
            style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.20)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22C55E' }} />
            Live
          </span>

          <div className="hidden sm:block h-5 w-px" style={{ background: '#E2E8F0' }} />

          {/* User chip */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold select-none"
              style={{ background: '#2563EB' }}>
              {initials}
            </div>
            <div className="hidden md:block">
              <p className="text-[12px] font-semibold leading-none" style={{ color: '#0F172A' }}>{user?.name || '…'}</p>
              <p className="text-[11px] mt-0.5 capitalize leading-none" style={{ color: '#94A3B8' }}>{user?.role || ''}</p>
            </div>
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
