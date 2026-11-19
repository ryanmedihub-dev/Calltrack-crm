"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FEATURES } from "../lib/features";
import { isAdminUser } from "../lib/auth";

function Icon({ children, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const ic = {
  Dashboard: () => (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  ),
  Analytics: () => (
    <Icon>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </Icon>
  ),
  CallLogs: () => (
    <Icon>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </Icon>
  ),
  Live: () => (
    <Icon>
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 7.76a6 6 0 0 0 0 8.49M20.07 4.93a10 10 0 0 1 0 14.14M3.93 4.93a10 10 0 0 0 0 14.14" />
    </Icon>
  ),
  Targets: () => (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Icon>
  ),
  Overview: () => (
    <Icon>
      <rect x="3" y="3" width="18" height="4" rx="1.5" />
      <rect x="3" y="10" width="8" height="11" rx="1.5" />
      <rect x="14" y="10" width="7" height="5" rx="1.5" />
      <rect x="14" y="18" width="7" height="3" rx="1.5" />
    </Icon>
  ),
  AgentReport: () => (
    <Icon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  ),
  AttemptReport: () => (
    <Icon>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </Icon>
  ),
  LogsReport: () => (
    <Icon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </Icon>
  ),
  Employees: () => (
    <Icon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  ),
  Leaderboard: () => (
    <Icon>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Icon>
  ),
  Leads: () => (
    <Icon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="23" y1="11" x2="17" y2="11" />
      <line x1="20" y1="8" x2="20" y2="14" />
    </Icon>
  ),
  Pipeline: () => (
    <Icon>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </Icon>
  ),
  Reports: () => (
    <Icon>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </Icon>
  ),
  Client: () => (
    <Icon>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  ),
  Export: () => (
    <Icon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </Icon>
  ),
  Bell: () => (
    <Icon>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Icon>
  ),
  Scripts: () => (
    <Icon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </Icon>
  ),
  Activity: () => (
    <Icon>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </Icon>
  ),
  Settings: () => (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  ),
  Logout: () => (
    <Icon size={14}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Icon>
  ),
  Close: () => (
    <Icon size={16}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Icon>
  ),
  ChevronRight: () => (
    <Icon size={11}>
      <polyline points="9 18 15 12 9 6" />
    </Icon>
  ),
  AlertCircle: () => (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </Icon>
  ),
  Clock: () => (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  ),
  MapPin: () => (
    <Icon>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </Icon>
  ),
  Upload: () => (
    <Icon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </Icon>
  ),
  UserCheck: () => (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </Icon>
  ),
  UserEdit: () => (
    <Icon>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
      <line x1="16" y1="11" x2="21" y2="11" />
      <line x1="16" y1="15" x2="21" y2="15" />
    </Icon>
  ),
  UserMinus: () => (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </Icon>
  ),
};

// Every page has exactly one home in the nav (reports live under Reports, not repeated in
// each section). `admin: true` entries are hidden from managers/TLs.
export const NAV = [
  { href: "/dashboard", label: "Dashboard", Ic: ic.Dashboard },
  { href: "/analytics", label: "Analytics", Ic: ic.Analytics },
  { href: "/team", label: "Team", Ic: ic.Employees },
  null,
  {
    href: "/calls", label: "Calls", Ic: ic.CallLogs,
    children: [
      { href: "/calls/overview", label: "Overview" },
      { href: "/calls/live", label: "Live monitor", live: true },
      { href: "/calls/unsynced", label: "Not synced" },
    ],
  },
  {
    href: "/leads", label: "Leads", Ic: ic.Leads,
    children: [
      { href: "/leads/overview", label: "Overview" },
      { href: "/leads/live-data", label: "Live data", live: true, feature: "LEAD_POOL" },
      { href: "/leads/pipeline", label: "Pipeline" },
      { href: "/leads/follow-ups", label: "Follow-ups" },
      { href: "/leads/assingned-leads", label: "Assigned leads" },
      { href: "/leads/leads-logs", label: "Activity log" },
      { href: "/leads/leads-uploads", label: "Import leads" },
    ],
  },
  {
    href: "/employees", label: "Employees", Ic: ic.AgentReport,
    children: [
      { href: "/employees/overview", label: "Overview" },
      { href: "/employees/leaderboard", label: "Leaderboard" },
      { href: "/calls/targets", label: "Daily targets" },
      { href: "/employees/performance-report", label: "Performance" },
    ],
  },
  {
    href: "/reports", label: "Reports", Ic: ic.Reports,
    children: [
      { href: "/reports", label: "Periodic reports", exact: true },
      { href: "/reports/calllogs", label: "Calls report" },
      { href: "/reports/lead", label: "Leads report" },
      { href: "/reports/Employess", label: "Employees report" },
      { href: "/reports/client", label: "Client report" },
      { href: "/reports/users", label: "Users report", admin: true },
      { href: "/reports/export", label: "Export center" },
    ],
  },
  {
    href: "/users", label: "Users", Ic: ic.UserEdit, admin: true,
    children: [
      { href: "/users/overview", label: "Overview" },
      { href: "/users/active", label: "Active users" },
      { href: "/users/update-users", label: "Add & edit users" },
      { href: "/users/remove-users", label: "Remove users" },
    ],
  },
  null,
  { href: "/downloads", label: "Downloads", Ic: ic.Export },
  { href: "/notifications", label: "Notifications", Ic: ic.Bell },
  { href: "/scripts", label: "Call scripts", Ic: ic.Scripts },
  { href: "/activity", label: "Audit log", Ic: ic.Activity, admin: true },
  { href: "/settings", label: "Settings", Ic: ic.Settings },
];

// Managers/TLs never see admin-only entries (the API would refuse them anyway).
function navFor(user) {
  if (isAdminUser(user)) return NAV;
  return NAV.filter((i) => !i?.admin).map((i) =>
    i?.children ? { ...i, children: i.children.filter((c) => !c.admin) } : i
  );
}

function visibleChildren(item) {
  if (!item?.children) return [];
  return item.children.filter((c) => !c.feature || FEATURES[c.feature]);
}

const EASE_OUT = [0.23, 1, 0.32, 1];

export default function Sidebar({ collapsed, mobileOpen, onMobileClose, user, onLogout }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const asideRef = useRef(null);
  const flyRef = useRef(null);
  const nav = navFor(user);

  const isActive = (href, exact) =>
    exact || href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const groupActive = (item) => isActive(item.href) || visibleChildren(item).some((c) => isActive(c.href, c.exact));

  // Expanded rail: groups open inline (accordion). The active group starts open.
  const [open, setOpen] = useState(() => new Set());
  useEffect(() => {
    const g = nav.find((i) => i?.children && groupActive(i));
    if (g) setOpen((s) => (s.has(g.href) ? s : new Set(s).add(g.href)));
    // `user` too: admin-only groups only join the nav once the user has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user]);
  const toggle = (href) => setOpen((s) => { const n = new Set(s); n.has(href) ? n.delete(href) : n.add(href); return n; });

  // Collapsed rail: groups open a flyout anchored to the item.
  const [fly, setFly] = useState(null);
  useEffect(() => setFly(null), [pathname, collapsed]);
  useEffect(() => {
    if (!fly) return;
    const onDown = (e) => {
      if (flyRef.current?.contains(e.target) || asideRef.current?.contains(e.target)) return;
      setFly(null);
    };
    const onKey = (e) => e.key === "Escape" && setFly(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [fly]);

  const initials = (user?.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = isAdminUser(user) ? "Admin" : user?.role === "tl" ? "Team lead" : user?.role ? user.role[0].toUpperCase() + user.role.slice(1) : "";

  const itemBase =
    "group/nav relative flex items-center w-full h-9 rounded-lg text-[13.5px] transition-colors duration-150";
  const itemState = (active) =>
    active
      ? "bg-[var(--blue-50)] text-[var(--blue-600)] font-medium"
      : "text-ink-2 hover:bg-[#F4F3F8] hover:text-ink";
  const rail = collapsed ? "lg:justify-center lg:px-0 px-2.5 gap-2.5" : "px-2.5 gap-2.5";

  return (
    <>
      <aside
        ref={asideRef}
        aria-label="Main navigation"
        className={[
          "fixed left-0 top-0 bottom-0 z-40 flex flex-col select-none bg-[var(--rail)] border-r border-line",
          "w-[var(--sidebar-w)] transition-[width,transform] duration-200 ease-out motion-reduce:transition-none",
          collapsed ? "lg:w-[var(--sidebar-w-collapsed)]" : "lg:w-[var(--sidebar-w)]",
          mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full",
          "lg:translate-x-0 lg:shadow-none",
        ].join(" ")}
      >
        {/* Brand */}
        <div className={`flex items-center h-[var(--topbar-h)] shrink-0 px-4 gap-2.5 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          <span className="w-8 h-8 rounded-lg bg-[var(--blue)] text-white flex items-center justify-center text-xs font-bold tracking-tight shrink-0">CT</span>
          <span className={`min-w-0 leading-tight ${collapsed ? "lg:hidden" : ""}`}>
            <span className="block text-[14px] font-semibold text-ink tracking-tight">CallTrack</span>
            <span className="block text-[11.5px] text-ink-3">{isAdminUser(user) ? "Admin console" : "Team console"}</span>
          </span>
          <button onClick={onMobileClose} aria-label="Close menu"
            className="lg:hidden ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-ink-3 hover:bg-[#F4F3F8]">
            <ic.Close />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-2 pb-4" style={{ scrollbarWidth: "none" }}>
          <ul className="space-y-0.5">
            {nav.map((item, i) => {
              if (item === null) return <li key={`sep-${i}`} aria-hidden className="h-3" />;

              if (item.children) {
                const kids = visibleChildren(item);
                if (!kids.length) return null;
                const active = groupActive(item);
                const isOpen = open.has(item.href);
                const flyOpen = fly?.item.href === item.href;
                return (
                  <li key={item.href}>
                    <button
                      title={collapsed ? item.label : undefined}
                      aria-expanded={collapsed ? flyOpen : isOpen}
                      onClick={(e) => {
                        if (collapsed && window.matchMedia("(min-width: 1024px)").matches) {
                          const r = e.currentTarget.getBoundingClientRect();
                          setFly(flyOpen ? null : { item, top: r.top });
                        } else toggle(item.href);
                      }}
                      className={`${itemBase} ${rail} ${collapsed && active ? itemState(true) : active && !isOpen ? "text-ink font-medium hover:bg-[#F4F3F8]" : itemState(false)}`}
                    >
                      <span className={`shrink-0 ${active ? "text-[var(--blue)]" : "text-ink-3 group-hover/nav:text-ink-2"}`}><item.Ic /></span>
                      <span className={`flex-1 text-left truncate ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                      <span className={`shrink-0 text-ink-4 transition-transform duration-200 ease-out ${isOpen ? "rotate-90" : ""} ${collapsed ? "lg:hidden" : ""}`}>
                        <ic.ChevronRight />
                      </span>
                    </button>

                    {/* Inline children (expanded rail, and always on the mobile drawer) */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.ul
                          key="kids"
                          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: EASE_OUT }}
                          className={`overflow-hidden ${collapsed ? "lg:hidden" : ""}`}
                        >
                          <div className="relative ml-[19px] pl-3 py-1 border-l border-line space-y-0.5">
                            {kids.map((c) => {
                              const a = isActive(c.href, c.exact);
                              return (
                                <Link key={c.href} href={c.href} onClick={onMobileClose} aria-current={a ? "page" : undefined}
                                  className={`flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] transition-colors duration-150 ${a ? "bg-[var(--blue-50)] text-[var(--blue-600)] font-medium" : "text-ink-3 hover:text-ink hover:bg-[#F4F3F8]"}`}>
                                  <span className="flex-1 truncate">{c.label}</span>
                                  {c.live && <span className="live-dot" aria-label="Live" />}
                                </Link>
                              );
                            })}
                          </div>
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </li>
                );
              }

              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={onMobileClose} title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`${itemBase} ${rail} ${itemState(active)}`}>
                    <span className={`shrink-0 ${active ? "text-[var(--blue)]" : "text-ink-3 group-hover/nav:text-ink-2"}`}><item.Ic /></span>
                    <span className={`flex-1 truncate ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Account */}
        <div className="shrink-0 border-t border-line p-3">
          <div className={`flex items-center gap-2.5 ${collapsed ? "lg:flex-col lg:gap-2" : ""}`}>
            <span className="w-8 h-8 rounded-full bg-[var(--blue-100)] text-[var(--blue-600)] flex items-center justify-center text-xs font-semibold shrink-0" title={user?.name}>
              {initials}
            </span>
            <span className={`flex-1 min-w-0 leading-tight ${collapsed ? "lg:hidden" : ""}`}>
              <span className="block text-[13px] font-medium text-ink truncate">{user?.name || "…"}</span>
              <span className="block text-[11.5px] text-ink-3 truncate">{roleLabel}</span>
            </span>
            <button onClick={onLogout} title="Sign out" aria-label="Sign out"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-3 hover:text-behind hover:bg-[var(--behind-50)] transition-colors duration-150 shrink-0">
              <ic.Logout />
            </button>
          </div>
        </div>
      </aside>

      {/* Collapsed-rail flyout — scales out of the item it belongs to */}
      <AnimatePresence>
        {fly && (
          <motion.div
            key={fly.item.href}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            style={{
              left: "calc(var(--sidebar-w-collapsed) + 8px)",
              top: Math.min(fly.top, (typeof window !== "undefined" ? window.innerHeight : 800) - (visibleChildren(fly.item).length * 32 + 56)),
              transformOrigin: "left top",
            }}
            className="fixed z-50 w-56 bg-white border border-line rounded-xl shadow-lg"
          >
            {/* ref on an inner element: a ref directly on AnimatePresence's child trips a React warning */}
            <div ref={flyRef} className="p-1.5">
            <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-ink-3">{fly.item.label}</p>
            {visibleChildren(fly.item).map((c) => {
              const a = isActive(c.href, c.exact);
              return (
                <Link key={c.href} href={c.href} onClick={() => setFly(null)} aria-current={a ? "page" : undefined}
                  className={`flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] transition-colors duration-150 ${a ? "bg-[var(--blue-50)] text-[var(--blue)] font-medium" : "text-ink-2 hover:bg-gray-100 hover:text-ink"}`}>
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.live && <span className="live-dot" aria-label="Live" />}
                </Link>
              );
            })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
