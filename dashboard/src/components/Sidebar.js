"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FEATURES } from "../lib/features";
import { isAdminUser } from "../lib/auth";

function Icon({ children, size = 15 }) {
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

const NAV = [
  { href: "/dashboard", label: "Dashboard", Ic: ic.Dashboard },
  { href: "/analytics", label: "Analytics", Ic: ic.Analytics },
  { href: "/team", label: "Team", Ic: ic.Employees },
  null,
  {
    href: "/calls",
    label: "Calls",
    Ic: ic.CallLogs,
    children: [
      { href: "/calls/overview", label: "Overview", Ic: ic.Overview },
      { href: "/calls/live", label: "Live Monitor", Ic: ic.Live, live: true },
      {
        href: "/calls/unsynced",
        label: "Not Synced Calls",
        Ic: ic.AlertCircle,
      },
      {
        href: "/reports/Employess",
        label: "Agents Report",
        Ic: ic.AgentReport,
      },
      { href: "/reports/calllogs", label: "Calls Report", Ic: ic.LogsReport },
      { href: "/reports/client", label: "Client Report", Ic: ic.Client },
    ],
  },
  null,
  {
    href: "/employees",
    label: "Employees",
    Ic: ic.Employees,
    children: [
      { href: "/employees/overview", label: "Overview", Ic: ic.Overview },
      {
        href: "/employees/leaderboard",
        label: "Leaderboard",
        Ic: ic.Leaderboard,
      },
      { href: "/calls/targets", label: "Daily Targets", Ic: ic.Targets },
      { href: "/reports/lead", label: "Leads Report", Ic: ic.Leads },
      {
        href: "/employees/performance-report",
        label: "Performance Report",
        Ic: ic.AttemptReport,
      },
      {
        href: "/reports/Employess",
        label: "Workload Report",
        Ic: ic.Activity,
      },
    ],
  },
  null,
  {
    href: "/leads",
    label: "Leads",
    Ic: ic.Leads,
    children: [
      { href: "/leads/live-data", label: "Live Data", Ic: ic.Live, live: true, feature: "LEAD_POOL" },
      { href: "/leads/overview", label: "Overview", Ic: ic.Overview },
      { href: "/leads/pipeline", label: "Pipeline", Ic: ic.Pipeline },
      { href: "/leads/follow-ups", label: "Follow-ups", Ic: ic.Reports },
      { href: "/leads/assingned-leads", label: "Assigned Leads", Ic: ic.Leads },
      { href: "/leads/leads-logs", label: "Leads Logs", Ic: ic.LogsReport },
      { href: "/leads/leads-uploads", label: "Leads Uploads", Ic: ic.Upload },
    ],
  },
  null,
  {
    href: "/users",
    label: "Users",
    admin: true,
    Ic: ic.AgentReport,
    children: [
      { href: "/users/overview", label: "Overview", Ic: ic.Overview },
      { href: "/users/active", label: "Active Users", Ic: ic.UserCheck },
      { href: "/users/update-users", label: "Update Users", Ic: ic.UserEdit },
      { href: "/users/remove-users", label: "Remove Users", Ic: ic.UserMinus },
    ],
  },

  null,
  {
    href: "/reports",
    label: "Reports",
    Ic: ic.Reports,
    children: [
      { href: "/reports/client", label: "Client", Ic: ic.Client },
      { href: "/reports/lead", label: "Lead", Ic: ic.Leads },
      { href: "/reports/Employess", label: "Employees", Ic: ic.Employees },
      { href: "/reports/calllogs", label: "Call Logs", Ic: ic.CallLogs },
      { href: "/reports/users", label: "Users", Ic: ic.AgentReport, admin: true },
      { href: "/reports/export", label: "Export Center", Ic: ic.Export },
    ],
  },
  null,
  { href: "/downloads", label: "Downloads", Ic: ic.Export },
  { href: "/notifications", label: "Notifications", Ic: ic.Bell },
  { href: "/scripts", label: "Scripts", Ic: ic.Scripts },
  null,
  { href: "/activity", label: "Activity", Ic: ic.Activity, admin: true },
  { href: "/settings", label: "Settings", Ic: ic.Settings },
];

// A child is hidden when it names a feature flag that is currently off. Centralised here so
// the active-check, the flyout height calc and the flyout item list can never disagree about
// which children are visible.
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

export default function Sidebar({
  collapsed,
  mobileOpen,
  onMobileClose,
  user,
  onLogout,
}) {
  const pathname = usePathname();
  const sidebarRef = useRef(null);
  const popupRef = useRef(null);

  // popup = { item, anchorTop, anchorBottom }
  const [popup, setPopup] = useState(null);

  const isActive = (href) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleParentClick = (item, e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    if (popup?.item.href === item.href) {
      setPopup(null);
    } else {
      setPopup({ item, anchorTop: rect.top, anchorBottom: rect.bottom });
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    if (!popup) return;
    const handler = (e) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target) &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target)
      ) {
        setPopup(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popup]);

  // Close on route change
  useEffect(() => {
    setPopup(null);
  }, [pathname]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  // Compute flyout panel top position (keep within viewport)
  const getPopupTop = () => {
    if (!popup) return 0;
    const POPUP_ITEM_H = 42;
    const POPUP_HEADER = 52;
    const POPUP_PAD = 16;
    const totalH =
      POPUP_HEADER + visibleChildren(popup.item).length * POPUP_ITEM_H + POPUP_PAD;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    let top = popup.anchorTop;
    if (top + totalH > vh - 12) top = Math.max(12, vh - totalH - 12);
    return top;
  };

  const sidebarW = collapsed ? 56 : 196;

  return (
    <>
      <aside
        ref={sidebarRef}
        className={[
          "flex flex-col fixed left-0 top-0 bottom-0 z-40 select-none",
          "transition-all duration-300 ease-in-out overflow-hidden",
          collapsed ? "lg:w-14" : "lg:w-[225px]",
          "w-[196px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        ].join(" ")}
        style={{ background: "#FAFBFC", borderRight: "1px solid #EAECF0" }}
      >
        {/* Brand */}
        <div
          className={`flex items-center h-[56px] flex-shrink-0 px-3 ${collapsed ? "lg:justify-center lg:px-0" : "gap-2.5"}`}
          style={{ borderBottom: "1px solid #EAECF0" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#2563EB,#60A5FA)" }}
          >
            <span className="text-white text-[9px] font-black tracking-tight">
              CT
            </span>
          </div>
          <div className={`flex-1 min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <p
              className="text-[13px] font-bold leading-none"
              style={{ color: "#0F172A" }}
            >
              CallTrack
            </p>
            <p className="text-[10px] mt-[3px]" style={{ color: "#94A3B8" }}>
              Manager Panel
            </p>
          </div>
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1 rounded"
            style={{ color: "#94A3B8" }}
          >
            <ic.Close />
          </button>
        </div>

        {/* Nav */}
        <nav
          className="flex-1 mt-5 overflow-y-auto py-2 px-2"
          style={{ scrollbarWidth: "none" }}
        >
          {navFor(user).map((item, i) => {
            if (item === null) {
              return (
                <div
                  key={`div-${i}`}
                  className={`my-1.5 ${collapsed ? "lg:mx-1" : "mx-1"}`}
                  style={{ height: "1px", background: "#EAECF0" }}
                />
              );
            }

            if (item.children) {
              const kids = visibleChildren(item);
              if (kids.length === 0) return null;
              const parentActive =
                isActive(item.href) ||
                kids.some((c) => isActive(c.href));
              const isOpen = popup?.item.href === item.href;

              return (
                <button
                  key={item.href}
                  onClick={(e) => handleParentClick(item, e)}
                  title={collapsed ? item.label : undefined}
                  className={[
                    "w-full flex items-center rounded-lg text-[13.5px] font-medium transition-colors duration-100 mt-0.5",
                    collapsed
                      ? "lg:justify-center lg:p-2.5 px-2.5 py-[7px] gap-2"
                      : "px-2.5 py-[9px] gap-2",
                  ].join(" ")}
                  style={
                    isOpen
                      ? { background: "#EFF6FF", color: "#2563EB" }
                      : parentActive
                        ? { background: "#EFF6FF", color: "#2563EB" }
                        : { color: "#64748B" }
                  }
                  onMouseEnter={(e) => {
                    if (!parentActive && !isOpen) {
                      e.currentTarget.style.background = "#F1F5F9";
                      e.currentTarget.style.color = "#334155";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!parentActive && !isOpen) {
                      e.currentTarget.style.background = "";
                      e.currentTarget.style.color = "#64748B";
                    }
                  }}
                >
                  <span className="flex-shrink-0">
                    <item.Ic />
                  </span>
                  <span
                    className={`flex-1 text-left truncate ${collapsed ? "lg:hidden" : ""}`}
                  >
                    {item.label}
                  </span>
                  {!collapsed && (
                    <span
                      className="flex-shrink-0 transition-transform duration-200"
                      style={{
                        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                        opacity: 0.45,
                      }}
                    >
                      <ic.ChevronRight />
                    </span>
                  )}
                </button>
              );
            }

            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                title={collapsed ? item.label : undefined}
                className={[
                  "flex items-center rounded-lg text-[13.5px] font-medium transition-colors duration-100 mt-0.5",
                  collapsed
                    ? "lg:justify-center lg:p-2.5 px-2.5 py-[9px] gap-2"
                    : "px-2.5 py-[9px] gap-2",
                ].join(" ")}
                style={
                  active
                    ? { background: "#EFF6FF", color: "#2563EB" }
                    : { color: "#64748B" }
                }
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "#F1F5F9";
                    e.currentTarget.style.color = "#334155";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "";
                    e.currentTarget.style.color = "#64748B";
                  }
                }}
              >
                <span
                  className="flex-shrink-0"
                  style={{ color: active ? "#2563EB" : "inherit" }}
                >
                  <item.Ic />
                </span>
                <span
                  className={`flex-1 truncate ${collapsed ? "lg:hidden" : ""}`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div
          className="flex-shrink-0 p-2"
          style={{ borderTop: "1px solid #EAECF0" }}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold"
                style={{
                  background: "linear-gradient(135deg,#2563EB,#60A5FA)",
                }}
              >
                {initials}
              </div>
              <button
                onClick={onLogout}
                title="Logout"
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "#94A3B8" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#FFF1F2";
                  e.currentTarget.style.color = "#EF4444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                  e.currentTarget.style.color = "#94A3B8";
                }}
              >
                <ic.Logout />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 px-1 py-1 rounded-lg"
              style={{ background: "#F1F5F9" }}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg,#2563EB,#60A5FA)",
                }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] font-semibold leading-none truncate"
                  style={{ color: "#0F172A" }}
                >
                  {user?.name || "User"}
                </p>
                <p
                  className="text-[10.5px] mt-0.5 capitalize truncate"
                  style={{ color: "#94A3B8" }}
                >
                  {user?.role || ""}
                </p>
              </div>
              <button
                onClick={onLogout}
                title="Logout"
                className="flex-shrink-0 p-1.5 rounded-md transition-colors"
                style={{ color: "#94A3B8" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#FFF1F2";
                  e.currentTarget.style.color = "#EF4444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                  e.currentTarget.style.color = "#94A3B8";
                }}
              >
                <ic.Logout />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Flyout popup panel */}
      {popup && (
        <>
          {/* Invisible backdrop to detect outside clicks on mobile */}
          <div
            className="fixed inset-0 z-[45] lg:hidden"
            onClick={() => setPopup(null)}
          />

          <div
            ref={popupRef}
            className="fixed z-50"
            style={{
              left: sidebarW + 8,
              top: getPopupTop(),
              width: 272,
              /* entry animation */
              animation: "slideInLeft 0.18s cubic-bezier(0.16,1,0.3,1) both",
            }}
          >
            {/* Arrow pointing left */}
            <div
              style={{
                position: "absolute",
                left: -6,
                top: 18,
                width: 0,
                height: 0,
                borderTop: "6px solid transparent",
                borderBottom: "6px solid transparent",
                borderRight: "6px solid #fff",
                filter: "drop-shadow(-2px 0 2px rgba(0,0,0,0.06))",
              }}
            />

            {/* Panel */}
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                boxShadow:
                  "0 8px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06)",
                border: "1px solid #E2E8F0",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                className="flex items-center gap-2.5 px-4 py-3"
                style={{
                  borderBottom: "1px solid #F1F5F9",
                  background: "#FAFBFC",
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "#EFF6FF", color: "#2563EB" }}
                >
                  <popup.item.Ic />
                </div>
                <p
                  className="font-bold text-[13px]"
                  style={{ color: "#0F172A" }}
                >
                  {popup.item.label}
                </p>
              </div>

              {/* Items */}
              <div>
                {visibleChildren(popup.item).map((child, idx, arr) => {
                  const active = isActive(child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => {
                        setPopup(null);
                        onMobileClose?.();
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                      style={{
                        borderBottom:
                          idx < arr.length - 1
                            ? "1px solid #F8FAFC"
                            : "none",
                        background: active ? "#EFF6FF" : "transparent",
                        textDecoration: "none",
                        color: active ? "#2563EB" : "#374151",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "#F8FAFC";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <span
                        className="flex-shrink-0"
                        style={{ color: active ? "#2563EB" : "#94A3B8" }}
                      >
                        <child.Ic />
                      </span>
                      <span className="flex-1 text-[13px] font-medium">
                        {child.label}
                      </span>
                      {child.live && (
                        <span
                          className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            background: "rgba(22,163,74,0.10)",
                            color: "#16A34A",
                            border: "1px solid rgba(22,163,74,0.20)",
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          LIVE
                        </span>
                      )}
                      {active && (
                        <span
                          className="flex-shrink-0"
                          style={{ color: "#2563EB" }}
                        >
                          <ic.ChevronRight />
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <style>{`
            @keyframes slideInLeft {
              from { opacity: 0; transform: translateX(-10px) scale(0.97); }
              to   { opacity: 1; transform: translateX(0)   scale(1);    }
            }
          `}</style>
        </>
      )}
    </>
  );
}
