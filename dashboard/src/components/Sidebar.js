'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function Svg({ children, size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const DashboardIcon = () => <Svg><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></Svg>;
const AnalyticsIcon = () => <Svg><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Svg>;
const PhoneIcon     = () => <Svg><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></Svg>;
const LiveIcon      = () => <Svg><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M7.76 7.76a6 6 0 0 0 0 8.49"/><path d="M20.07 4.93a10 10 0 0 1 0 14.14"/><path d="M3.93 4.93a10 10 0 0 0 0 14.14"/></Svg>;
const TargetIcon    = () => <Svg><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></Svg>;
const EmployeesIcon = () => <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>;
const LeadsIcon     = () => <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></Svg>;
const PipelineIcon  = () => <Svg><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Svg>;
const CalendarIcon  = () => <Svg><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Svg>;
const ClientIcon    = () => <Svg><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Svg>;
const ExportIcon    = () => <Svg><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Svg>;
const BellIcon      = () => <Svg><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Svg>;
const ScriptsIcon   = () => <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Svg>;
const ActivityIcon  = () => <Svg><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Svg>;
const SettingsIcon  = () => <Svg><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Svg>;
const LogoutIcon    = () => <Svg size={15}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>;
const CloseIcon     = () => <Svg size={18}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>;
const LeaderIcon    = () => <Svg><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Svg>;

const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard',  Icon: DashboardIcon },
      { href: '/analytics',  label: 'Analytics',  Icon: AnalyticsIcon },
    ]
  },
  {
    label: 'Calls',
    items: [
      { href: '/calls',         label: 'Call Logs',     Icon: PhoneIcon },
      { href: '/calls/live',    label: 'Live Monitor',  Icon: LiveIcon,  badge: 'live' },
      { href: '/calls/targets', label: 'Daily Targets', Icon: TargetIcon },
    ]
  },
  {
    label: 'Management',
    items: [
      { href: '/employees',             label: 'Employees',  Icon: EmployeesIcon },
      { href: '/employees/leaderboard', label: 'Leaderboard',Icon: LeaderIcon },
      { href: '/leads',                 label: 'Leads',      Icon: LeadsIcon },
      { href: '/leads/pipeline',        label: 'Pipeline',   Icon: PipelineIcon },
    ]
  },
  {
    label: 'Reports',
    items: [
      { href: '/reports',        label: 'Periodic Reports', Icon: CalendarIcon },
      { href: '/reports/client', label: 'Client Reports',   Icon: ClientIcon },
      { href: '/reports/export', label: 'Export Center',    Icon: ExportIcon },
    ]
  },
  {
    label: 'Communication',
    items: [
      { href: '/notifications', label: 'Notifications', Icon: BellIcon },
      { href: '/scripts',       label: 'Call Scripts',  Icon: ScriptsIcon },
    ]
  },
  {
    label: 'System',
    items: [
      { href: '/activity', label: 'Activity Log', Icon: ActivityIcon },
      { href: '/settings', label: 'Settings',     Icon: SettingsIcon },
    ]
  },
];

export default function Sidebar({ collapsed, mobileOpen, onMobileClose, user, onLogout }) {
  const pathname = usePathname();

  const isActive = (href) =>
    href === '/dashboard'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/');

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <aside className={[
      'w-60',
      collapsed ? 'lg:w-[66px]' : 'lg:w-60',
      'flex flex-col fixed left-0 top-0 bottom-0 z-40',
      'transition-all duration-300 ease-in-out overflow-hidden',
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
      'lg:translate-x-0',
    ].join(' ')}
    style={{ background: 'linear-gradient(180deg, #0C0A1E 0%, #100E28 100%)', boxShadow: '4px 0 32px rgba(0,0,0,0.28)' }}>

      {/* ── Brand header ─────────────────────────────── */}
      <div className={`h-16 border-b flex items-center flex-shrink-0 ${collapsed ? 'lg:justify-center px-4 lg:px-0' : 'px-4'}`}
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className={`flex items-center gap-3 min-w-0 flex-1 ${collapsed ? 'lg:justify-center' : ''}`}>
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 select-none"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.40)' }}>
            <span className="text-white text-[10px] font-black tracking-tight">CT</span>
          </div>
          {/* Brand name */}
          <div className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="text-white text-[13px] font-bold leading-none tracking-tight">CallTrack</p>
            <p className="text-[10px] mt-0.5 font-medium tracking-widest uppercase" style={{ color: '#6B6894' }}>CRM Panel</p>
          </div>
        </div>
        {/* Mobile close */}
        <button onClick={onMobileClose}
          className="lg:hidden ml-auto p-1.5 rounded-lg transition-colors"
          style={{ color: '#6B6894' }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = '#6B6894'}>
          <CloseIcon />
        </button>
      </div>

      {/* ── Nav ──────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3" style={{ scrollbarWidth: 'none' }}>
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            {/* Group label */}
            {collapsed ? (
              <div className="hidden lg:block mx-4 my-2" style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            ) : (
              <p className="px-4 pt-4 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] select-none"
                style={{ color: '#4A476B' }}>
                {group.label}
              </p>
            )}

            {group.items.map(({ href, label, Icon, badge }) => {
              const active = isActive(href);
              return (
                <div key={href} className={`relative mx-2 my-0.5 ${collapsed ? 'lg:mx-1.5' : ''}`}>
                  <Link
                    href={href}
                    onClick={onMobileClose}
                    title={collapsed ? label : undefined}
                    className={[
                      'group relative flex items-center rounded-xl text-sm font-medium',
                      'transition-all duration-150 select-none',
                      collapsed ? 'lg:justify-center lg:p-2.5 px-2.5 py-2.5 gap-3' : 'gap-3 px-3 py-2.5',
                      active
                        ? 'text-white'
                        : 'hover:text-white',
                    ].join(' ')}
                    style={active ? {
                      background: 'rgba(99,102,241,0.18)',
                      boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.25)',
                    } : {}}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = ''; }}
                  >
                    {/* Active left bar */}
                    {active && (
                      <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full ${collapsed ? 'lg:hidden' : ''}`}
                        style={{ background: 'linear-gradient(180deg, #818CF8, #6366F1)' }} />
                    )}

                    {/* Icon */}
                    <span className={`flex-shrink-0 transition-colors ${active ? 'text-indigo-300' : 'text-sidebarMuted group-hover:text-slate-300'}`}>
                      <Icon />
                    </span>

                    {/* Label */}
                    <span className={`truncate flex-1 leading-none text-[13px] ${collapsed ? 'lg:hidden' : ''} ${active ? 'text-white' : 'text-sidebarText'}`}>
                      {label}
                    </span>

                    {/* Live badge */}
                    {badge === 'live' && !collapsed && (
                      <span className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(16,185,129,0.15)', color: '#34D399', border: '1px solid rgba(16,185,129,0.25)' }}>
                        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE
                      </span>
                    )}

                    {/* Tooltip for collapsed state */}
                    {collapsed && (
                      <span className="tooltip pointer-events-none hidden lg:block">
                        {label}
                        {badge === 'live' && <span className="ml-1.5 w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" />}
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── User + Logout ─────────────────────────────── */}
      <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
              {initials}
            </div>
            <button onClick={onLogout} title="Logout"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ color: '#6B6894' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#F87171'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#6B6894'; }}>
              <LogoutIcon />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 select-none"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold leading-none truncate">{user?.name || 'User'}</p>
              <p className="text-[11px] mt-0.5 capitalize truncate" style={{ color: '#6B6894' }}>{user?.role || ''}</p>
            </div>
            <button onClick={onLogout} title="Logout"
              className="flex-shrink-0 p-2 rounded-lg transition-all"
              style={{ color: '#6B6894' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#F87171'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#6B6894'; }}>
              <LogoutIcon />
            </button>
          </div>
        )}
      </div>

      {/* Version */}
      {!collapsed && (
        <div className="pb-2 text-center flex-shrink-0">
          <span className="text-[9px] font-medium" style={{ color: '#2E2B4A' }}>v2.0.0</span>
        </div>
      )}
    </aside>
  );
}
