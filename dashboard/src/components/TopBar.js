'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import CommandPalette from './CommandPalette';
import { NAV } from './Sidebar';

const EXTRA = { '/employees': 'Employee', '/analytics/advanced': 'Advanced analytics', '/calls/logs-report': 'Call logs', '/employees/performance-reports': 'Performance reports', '/users': 'Users' };

// Breadcrumb from the nav's own labels, so the trail always matches what the sidebar calls a page.
function crumbsFor(pathname) {
  for (const item of NAV) {
    if (!item) continue;
    if (!item.children && (pathname === item.href || pathname.startsWith(item.href + '/'))) {
      return pathname === item.href ? [{ label: item.label }] : [{ label: item.label, href: item.href }, { label: EXTRA[pathname] || 'Details' }];
    }
    const child = item.children?.find((c) => pathname === c.href);
    if (child) return [{ label: item.label }, { label: child.label }];
  }
  if (/^\/employees\/[^/]+$/.test(pathname)) return [{ label: 'Employees', href: '/employees/overview' }, { label: 'Employee' }];
  const extra = EXTRA[pathname];
  return extra ? [{ label: extra }] : [];
}

const Svg = ({ children, s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);

export default function TopBar({ collapsed, onToggle, onMobileToggle }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const crumbs = crumbsFor(pathname);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((v) => !v); }
    };
    const onScroll = () => setScrolled(window.scrollY > 2);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onScroll); };
  }, []);

  const iconBtn = 'w-9 h-9 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink hover:bg-gray-100 transition-colors duration-150 active:scale-[0.97]';

  return (
    <>
      <header
        className={[
          'fixed top-0 right-0 left-0 z-30 h-[var(--topbar-h)] flex items-center gap-3 px-4 lg:px-6',
          'bg-[var(--bg)] transition-[left,box-shadow] duration-200 ease-out motion-reduce:transition-none',
          collapsed ? 'lg:left-[var(--sidebar-w-collapsed)]' : 'lg:left-[var(--sidebar-w)]',
          scrolled ? 'shadow-[0_1px_0_var(--line)]' : '',
        ].join(' ')}
      >
        <button onClick={onMobileToggle} aria-label="Open menu" className={`lg:hidden ${iconBtn}`}>
          <Svg><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></Svg>
        </button>
        <button onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={`hidden lg:flex ${iconBtn} -ml-2`}>
          <Svg><rect x="3" y="4" width="18" height="16" rx="2.5"/><line x1="9" y1="4" x2="9" y2="20"/></Svg>
        </button>

        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex items-center gap-1.5 text-[13px] min-w-0">
            {crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <span className="text-ink-4" aria-hidden>/</span>}
                {c.href
                  ? <Link href={c.href} className="text-ink-3 hover:text-ink truncate transition-colors">{c.label}</Link>
                  : <span className={`truncate ${i === crumbs.length - 1 ? 'text-ink font-medium' : 'text-ink-3'}`} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>

        <button onClick={() => setPaletteOpen(true)}
          className="hidden sm:flex items-center gap-2 h-9 w-56 lg:w-64 pl-3 pr-2 rounded-lg bg-white border border-line text-[13px] text-ink-3 hover:border-gray-300 hover:text-ink-2 transition-colors duration-150">
          <Svg s={14}><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></Svg>
          <span className="flex-1 text-left">Search pages…</span>
          <kbd className="text-xs font-sans text-ink-3 bg-gray-100 rounded px-1.5 h-5 inline-flex items-center">Ctrl K</kbd>
        </button>
        <button onClick={() => setPaletteOpen(true)} aria-label="Search" className={`sm:hidden ${iconBtn}`}>
          <Svg><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></Svg>
        </button>

        <Link href="/notifications" aria-label="Notifications" className={iconBtn}>
          <Svg><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Svg>
        </Link>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
