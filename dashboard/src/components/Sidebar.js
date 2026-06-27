'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function Icon({ children, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const icons = {
  Dashboard:  () => <Icon><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></Icon>,
  Analytics:  () => <Icon><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Icon>,
  CallLogs:   () => <Icon><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Icon>,
  Live:       () => <Icon><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 7.76a6 6 0 0 0 0 8.49M20.07 4.93a10 10 0 0 1 0 14.14M3.93 4.93a10 10 0 0 0 0 14.14"/></Icon>,
  Targets:    () => <Icon><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></Icon>,
  Employees:  () => <Icon><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Icon>,
  Leaderboard:() => <Icon><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Icon>,
  Leads:      () => <Icon><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></Icon>,
  Pipeline:   () => <Icon><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Icon>,
  Reports:    () => <Icon><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Icon>,
  Client:     () => <Icon><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>,
  Export:     () => <Icon><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Icon>,
  Bell:       () => <Icon><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Icon>,
  Scripts:    () => <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Icon>,
  Activity:   () => <Icon><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Icon>,
  Settings:   () => <Icon><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icon>,
  Logout:     () => <Icon size={15}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Icon>,
  Close:      () => <Icon size={17}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>,
};

const NAV = [
  {
    section: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard',  Ic: icons.Dashboard  },
      { href: '/analytics',  label: 'Analytics',  Ic: icons.Analytics  },
    ],
  },
  {
    section: 'Calls',
    items: [
      { href: '/calls',         label: 'Call Logs',     Ic: icons.CallLogs },
      { href: '/calls/live',    label: 'Live Monitor',  Ic: icons.Live, live: true },
      { href: '/calls/targets', label: 'Daily Targets', Ic: icons.Targets },
    ],
  },
  {
    section: 'Management',
    items: [
      { href: '/employees',             label: 'Employees',   Ic: icons.Employees   },
      { href: '/employees/leaderboard', label: 'Leaderboard', Ic: icons.Leaderboard },
      { href: '/leads',                 label: 'Leads',       Ic: icons.Leads       },
      { href: '/leads/pipeline',        label: 'Pipeline',    Ic: icons.Pipeline    },
    ],
  },
  {
    section: 'Reports',
    items: [
      { href: '/reports',        label: 'Periodic Reports', Ic: icons.Reports },
      { href: '/reports/client', label: 'Client Reports',   Ic: icons.Client  },
      { href: '/reports/export', label: 'Export Center',    Ic: icons.Export  },
    ],
  },
  {
    section: 'Communication',
    items: [
      { href: '/notifications', label: 'Notifications', Ic: icons.Bell    },
      { href: '/scripts',       label: 'Call Scripts',  Ic: icons.Scripts },
    ],
  },
  {
    section: 'System',
    items: [
      { href: '/activity', label: 'Activity Log', Ic: icons.Activity },
      { href: '/settings', label: 'Settings',     Ic: icons.Settings },
    ],
  },
];

export default function Sidebar({ collapsed, mobileOpen, onMobileClose, user, onLogout }) {
  const pathname = usePathname();

  const isActive = (href) =>
    href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <aside
      className={[
        'flex flex-col fixed left-0 top-0 bottom-0 z-40',
        'transition-all duration-300 ease-in-out overflow-hidden',
        collapsed ? 'lg:w-[64px]' : 'lg:w-56',
        'w-56',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0',
      ].join(' ')}
      style={{ background: '#0F172A' }}>

      {/* ── Brand ──────────────────────────────────── */}
      <div className={`flex items-center gap-3 h-14 px-4 flex-shrink-0 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: '#2563EB' }}>
          <span className="text-white text-[9px] font-black tracking-tight select-none">CT</span>
        </div>
        <div className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
          <p className="text-white text-[13px] font-bold leading-none">CallTrack</p>
          <p className="text-[10px] mt-0.5 font-medium" style={{ color: '#475569' }}>Manager Panel</p>
        </div>
        <button onClick={onMobileClose} className="lg:hidden p-1 rounded"
          style={{ color: '#475569' }}>
          <icons.Close />
        </button>
      </div>

      {/* ── Nav ────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
        {NAV.map(({ section, items }) => (
          <div key={section} className="mb-1">
            {/* Section label */}
            {collapsed ? (
              <div className="hidden lg:block mx-3 my-2.5" style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            ) : (
              <p className="px-4 pt-3 pb-1 text-[10px] font-700 uppercase tracking-[0.1em] select-none"
                style={{ color: '#334155', fontWeight: 700 }}>
                {section}
              </p>
            )}

            {items.map(({ href, label, Ic, live }) => {
              const active = isActive(href);
              return (
                <div key={href} className={`mx-2 my-0.5 ${collapsed ? 'lg:mx-1.5' : ''}`}>
                  <Link
                    href={href}
                    onClick={onMobileClose}
                    title={collapsed ? label : undefined}
                    className={[
                      'relative flex items-center rounded-lg text-[13px] font-medium',
                      'transition-colors duration-150 select-none group',
                      collapsed ? 'lg:justify-center lg:p-2.5 px-3 py-2 gap-2.5' : 'px-3 py-2 gap-2.5',
                    ].join(' ')}
                    style={active ? {
                      background: 'rgba(37,99,235,0.18)',
                      color: '#fff',
                    } : { color: '#94A3B8' }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#CBD5E1'; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#94A3B8'; } }}>

                    {/* Active left accent */}
                    {active && !collapsed && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full" style={{ background: '#3B82F6' }} />
                    )}

                    <span className="flex-shrink-0" style={{ color: active ? '#60A5FA' : 'inherit' }}>
                      <Ic />
                    </span>

                    <span className={`truncate flex-1 ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>

                    {live && !collapsed && (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(22,163,74,0.15)', color: '#4ADE80', border: '1px solid rgba(22,163,74,0.2)' }}>
                        <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── User ───────────────────────────────────── */}
      <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: '#2563EB' }}>{initials}</div>
            <button onClick={onLogout} title="Logout"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: '#475569' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.12)'; e.currentTarget.style.color = '#F87171'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#475569'; }}>
              <icons.Logout />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: '#2563EB' }}>{initials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold leading-none truncate">{user?.name || 'User'}</p>
              <p className="text-[11px] mt-0.5 capitalize truncate" style={{ color: '#475569' }}>{user?.role || ''}</p>
            </div>
            <button onClick={onLogout} title="Logout"
              className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
              style={{ color: '#475569' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.12)'; e.currentTarget.style.color = '#F87171'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#475569'; }}>
              <icons.Logout />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
