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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

export default function TopBar({ collapsed, onToggle, onMobileToggle, user }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const pageTitle = PAGE_TITLES[pathname] || 'CallTrack';
  const crumbs    = buildCrumbs(pathname);

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

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <>
      <header
        className={[
          'h-16 bg-white border-b border-border',
          'flex items-center justify-between px-4 lg:px-5',
          'fixed top-0 right-0 left-0 z-20',
          'transition-[left] duration-300 ease-in-out',
          // desktop: offset by sidebar; mobile: full width (left-0 above)
          collapsed ? 'lg:left-[68px]' : 'lg:left-60',
        ].join(' ')}>

        {/* Left — hamburger + title/breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile hamburger — opens drawer */}
          <button
            onClick={onMobileToggle}
            className="lg:hidden flex-shrink-0 p-1.5 text-textMuted hover:text-textPrimary hover:bg-bg rounded-lg transition-colors">
            <HamburgerIcon />
          </button>

          {/* Desktop hamburger — collapses sidebar */}
          <button
            onClick={onToggle}
            className="hidden lg:flex flex-shrink-0 p-1.5 text-textMuted hover:text-textPrimary hover:bg-bg rounded-lg transition-colors">
            <HamburgerIcon />
          </button>

          {/* Breadcrumb or page title */}
          {crumbs ? (
            <nav className="flex items-center gap-1.5 text-sm min-w-0">
              {crumbs.map((crumb, i) => (
                <span key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                  {i > 0 && <span className="text-border flex-shrink-0"><ChevronRight /></span>}
                  {crumb.current ? (
                    <span className="font-semibold text-textPrimary truncate">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href}
                      className="text-textMuted hover:text-textPrimary transition-colors truncate">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          ) : (
            <h1 className="text-sm font-semibold text-textPrimary truncate">{pageTitle}</h1>
          )}
        </div>

        {/* Right — search + notifications + user */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Command Palette trigger — hidden on very small screens */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-bg border border-border text-textMuted text-xs px-3 py-2 rounded-xl hover:border-primary/40 hover:text-textSecondary transition-all">
            <SearchIcon />
            <span className="hidden md:inline">Search…</span>
            <kbd className="hidden lg:inline ml-1 text-[10px] bg-white border border-border rounded px-1 py-0.5 font-mono text-textMuted">⌘K</kbd>
          </button>

          {/* Mobile search icon only */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="sm:hidden p-2 text-textMuted hover:text-textPrimary hover:bg-bg rounded-xl transition-colors">
            <SearchIcon />
          </button>

          {/* Notifications */}
          <Link href="/notifications"
            className="relative p-2 text-textMuted hover:text-textPrimary hover:bg-bg rounded-xl transition-colors">
            <BellIcon />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full border-2 border-white" />
          </Link>

          {/* Live badge */}
          <span className="hidden md:flex items-center gap-1.5 text-xs bg-green-50 text-green-600 border border-green-200 px-2.5 py-1.5 rounded-full font-medium select-none">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>

          {/* Divider */}
          <div className="hidden sm:block h-6 w-px bg-border" />

          {/* User avatar + name */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-xs font-bold select-none flex-shrink-0">
              {initials}
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-semibold text-textPrimary leading-none">{user?.name || '…'}</p>
              <p className="text-xs text-textMuted mt-0.5 capitalize">{user?.role || ''}</p>
            </div>
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
