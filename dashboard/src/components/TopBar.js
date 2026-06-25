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
  '/dashboard':   'Your real-time operations overview',
  '/analytics':   'Trends and performance insights',
  '/calls':       'Sync and review all call activity',
  '/calls/live':  'Monitor active calls in real time',
  '/employees':   'Manage your team members',
  '/leads':       'Track and convert your contacts',
  '/reports':     'Generate and export reports',
  '/settings':    'Configure your workspace',
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

function HamburgerIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
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
          'h-16 flex items-center justify-between pl-4 pr-4 lg:pr-5',
          'fixed top-0 right-0 left-0 z-30',
          'transition-all duration-300 ease-in-out',
          collapsed ? 'lg:left-[66px]' : 'lg:left-60',
          scrolled
            ? 'bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-sm'
            : 'bg-white/80 backdrop-blur-md border-b border-slate-100',
        ].join(' ')}>

        {/* Left — toggle + breadcrumb / title */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile hamburger */}
          <button onClick={onMobileToggle}
            className="lg:hidden flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ color: '#64748B' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#64748B'; }}>
            <HamburgerIcon />
          </button>

          {/* Desktop toggle */}
          <button onClick={onToggle}
            className="hidden lg:flex flex-shrink-0 w-9 h-9 rounded-xl items-center justify-center transition-colors"
            style={{ color: '#64748B' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#64748B'; }}>
            <HamburgerIcon />
          </button>

          {/* Divider */}
          <div className="hidden sm:block h-5 w-px bg-slate-200" />

          {/* Breadcrumb or title + subtitle */}
          <div className="min-w-0">
            {crumbs ? (
              <nav className="flex items-center gap-1.5 text-sm min-w-0">
                {crumbs.map((crumb, i) => (
                  <span key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                    {i > 0 && <span className="text-slate-300 flex-shrink-0"><ChevronRight /></span>}
                    {crumb.current ? (
                      <span className="font-semibold text-slate-800 truncate text-[13px]">{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href}
                        className="text-slate-400 hover:text-slate-600 transition-colors truncate text-[13px]">
                        {crumb.label}
                      </Link>
                    )}
                  </span>
                ))}
              </nav>
            ) : (
              <div className="flex items-baseline gap-2">
                <h1 className="text-[14px] font-bold text-slate-800 leading-none">{pageTitle}</h1>
                {pageSubtitle && (
                  <p className="hidden md:block text-[12px] text-slate-400 leading-none truncate">{pageSubtitle}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right — search + actions + user */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search button — desktop */}
          <button onClick={() => setPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 text-xs px-3 py-2 rounded-xl transition-all"
            style={{
              background: '#F8FAFF',
              border: '1px solid #E2E8F4',
              color: '#94A3B8',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)';
              e.currentTarget.style.color = '#6366F1';
              e.currentTarget.style.background = '#F5F7FF';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E2E8F4';
              e.currentTarget.style.color = '#94A3B8';
              e.currentTarget.style.background = '#F8FAFF';
            }}>
            <SearchIcon />
            <span className="hidden md:inline font-medium">Search…</span>
            <kbd className="hidden lg:inline ml-1 text-[10px] rounded-md px-1.5 py-0.5 font-mono"
              style={{ background: '#EEF2FF', color: '#6366F1', border: '1px solid #C7D2FE' }}>
              ⌘K
            </kbd>
          </button>

          {/* Mobile search */}
          <button onClick={() => setPaletteOpen(true)}
            className="sm:hidden w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F5F7FF'; e.currentTarget.style.color = '#6366F1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#94A3B8'; }}>
            <SearchIcon />
          </button>

          {/* Notifications */}
          <Link href="/notifications"
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F5F7FF'; e.currentTarget.style.color = '#6366F1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#94A3B8'; }}>
            <BellIcon />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white"
              style={{ background: '#EF4444' }} />
          </Link>

          {/* Live indicator */}
          <span className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full select-none"
            style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            Live
          </span>

          {/* Vertical divider */}
          <div className="hidden sm:block h-6 w-px bg-slate-200" />

          {/* User chip */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-bold select-none flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 2px 8px rgba(99,102,241,0.30)' }}>
              {initials}
            </div>
            <div className="hidden md:block">
              <p className="text-[12px] font-semibold text-slate-800 leading-none">{user?.name || '…'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 capitalize leading-none">{user?.role || ''}</p>
            </div>
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
