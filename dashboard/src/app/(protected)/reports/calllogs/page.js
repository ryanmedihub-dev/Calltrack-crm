"use client";
import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
  Area,
} from "recharts";
import api from "../../../../lib/api";
import { triggerServerExport } from "../../../../lib/downloads";
import { fmtDate, fmtTime, fmtDateTime } from "../../../../lib/timezone";
import { motion, AnimatePresence } from "framer-motion";
import { DataTable, TLFilter, Truncate, EditableRemarks } from "../../../../components/report-shared";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  X,
  Inbox,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────
   ICONS
──────────────────────────────────────────────────────────── */
const Ico = ({ size = 16, children, className = "", fill = "none" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);
const CalendarIco = () => (
  <Ico size={14}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </Ico>
);
const PhoneIco = ({ s = 14 }) => (
  <Ico size={s}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </Ico>
);
const CheckIco = () => (
  <Ico size={14}>
    <polyline points="20 6 9 17 4 12" />
  </Ico>
);
const XIco = () => (
  <Ico size={12}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Ico>
);
const ClockIco = () => (
  <Ico size={14}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Ico>
);
const UsersIco = () => (
  <Ico size={14}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Ico>
);
const DownloadIco = () => (
  <Ico size={14}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </Ico>
);
const RefreshIco = ({ spinning }) => (
  <Ico size={14} className={spinning ? "animate-spin" : ""}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </Ico>
);
const ChevronIco = ({ open }) => (
  <Ico
    size={14}
    className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
  >
    <polyline points="6 9 12 15 18 9" />
  </Ico>
);
const SearchIco = () => (
  <Ico size={13}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Ico>
);
const ArrowUpIco = () => (
  <Ico size={12}>
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </Ico>
);
const ArrowDownIco = () => (
  <Ico size={12}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </Ico>
);
const InboxIco = () => (
  <Ico size={32}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </Ico>
);

/* Tab-specific icons */
const BarChartTabIco = () => (
  <Ico size={15} className="text-blue-500">
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </Ico>
);
const CalendarTabIco = () => (
  <Ico size={15} className="text-amber-500">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </Ico>
);
const ClockTabIco = () => (
  <Ico size={15} className="text-sky-500">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 14" />
  </Ico>
);
const NoEntryIco = () => (
  <Ico size={15} className="text-red-500">
    <circle cx="12" cy="12" r="9" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Ico>
);
const PhoneTabIco = () => (
  <Ico size={15} className="text-rose-500">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </Ico>
);
const PersonTabIco = () => (
  <Ico size={15} className="text-gray-700">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
  </Ico>
);
const ClipboardIco = () => (
  <Ico size={15} className="text-gray-700">
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <line x1="9" y1="10" x2="15" y2="10" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </Ico>
);
const GridIco = () => (
  <Ico size={15} className="text-indigo-500">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Ico>
);

/* Extra icons for content-specific components */
const PinIco = ({ filled }) => (
  <Ico
    size={13}
    className={filled ? "text-amber-500" : "text-gray-300"}
    fill={filled ? "currentColor" : "none"}
  >
    <path d="M12 17v5M9 3h6l-1 6 4 4H8l4-4-1-6z" />
  </Ico>
);
const TrophyIco = () => (
  <Ico size={16} className="text-amber-500">
    <path d="M6 9H4a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1h3M18 9h2a2 2 0 0 0 2-2V5a1 1 0 0 0-1-1h-3M6 4h12v6a6 6 0 0 1-12 0V4z" />
    <path d="M12 15v3M8 21h8" />
  </Ico>
);
const StopwatchIco = () => (
  <Ico size={16} className="text-blue-500">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l3 2M9 2h6" />
  </Ico>
);
const GaugeIco = () => (
  <Ico size={16} className="text-emerald-500">
    <path d="M12 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4.93 19.07A10 10 0 1 1 19.07 19.07" />
    <path d="M12 13l3.5-3.5" />
  </Ico>
);

/* ────────────────────────────────────────────────────────────
   CONSTANTS
──────────────────────────────────────────────────────────── */
const TYPE_META = {
  incoming: { label: "Incoming", color: "#16A34A", bg: "#F0FDF4" },
  outgoing: { label: "Outgoing", color: "#D97706", bg: "#FFFBEB" },
  missed: { label: "Missed", color: "#DC2626", bg: "#FEF2F2" },
  rejected: { label: "Rejected", color: "#7C3AED", bg: "#F5F3FF" },
};
const TABS = [
  { key: "summary", label: "Summary", icon: <GridIco /> },
  { key: "analysis", label: "Analysis", icon: <BarChartTabIco /> },
  { key: "dayWise", label: "Day-wise Analysis", icon: <CalendarTabIco /> },
  { key: "hourly", label: "Hourly Analysis", icon: <ClockTabIco /> },
  {
    key: "neverAttended",
    label: "Never Attended",
    icon: <NoEntryIco />,
    hint: "Calls that were never returned, even after being missed.",
  },
  {
    key: "notPickup",
    label: "Not Pickup by Client",
    icon: <PhoneTabIco />,
    hint: "Outgoing calls the client never answered.",
  },
  {
    key: "uniqueClients",
    label: "Unique Clients",
    icon: <PersonTabIco />,
    hint: "One row per distinct phone number contacted.",
  },
  { key: "callHistory", label: "Call History", icon: <ClipboardIco /> },
];

/* Client-side formatter for raw call durations (seconds) coming straight off a CallLog doc. */
function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s === 0) return "0s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/* ────────────────────────────────────────────────────────────
   SMALL UI PRIMITIVES
──────────────────────────────────────────────────────────── */
function CallBadge({ type }) {
  const m = TYPE_META[type] || TYPE_META.outgoing;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ color: m.color, background: m.bg }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: m.color }}
      />
      {m.label}
    </span>
  );
}

function InfoDot({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex ml-1 cursor-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[9px] font-bold flex items-center justify-center">
        i
      </span>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute z-20 left-1/2 -translate-x-1/2 top-6 w-56 bg-gray-900 text-white text-[11px] leading-snug rounded-lg px-3 py-2 shadow-xl"
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg px-3 py-2 text-xs shadow-lg border border-gray-200">
      <p className="text-gray-500 font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p
          key={i}
          className="font-semibold flex items-center gap-1.5"
          style={{ color: p.color || p.fill }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color || p.fill }}
          />
          {p.name}: {p.value?.toLocaleString?.() ?? p.value}
        </p>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-white rounded-xl border border-gray-200 p-4 overflow-hidden group hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div
        className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-[0.06] group-hover:opacity-[0.1] transition-opacity"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${color}14`, color }}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-3 tabular-nums">
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

function Skeleton({ className = "" }) {
  return <div className={`bg-gray-100 rounded animate-pulse ${className}`} />;
}

function EmptyState({
  title = "No records found",
  hint = "Try widening your date range or clearing filters.",
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <InboxIco />
      <p className="mt-3 text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  );
}

/* Pin toggle used in Call History "To Number" column — persisted in localStorage
   (there's no backend field for this, so it's client-only but genuinely persists). */
function PinnedNumber({ number, pinned, onToggle }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-amber-600 font-medium">{number}</span>
      <button
        type="button"
        onClick={onToggle}
        title={pinned ? "Unpin" : "Pin this number"}
      >
        <PinIco filled={pinned} />
      </button>
    </div>
  );
}

/* Highlight card used in Analysis tab */
function InsightCard({ icon, title, rows }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h4 className="text-sm font-bold text-gray-900">{title}</h4>
      </div>
      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={i} className={i > 0 ? "pt-3 border-t border-gray-100" : ""}>
            <p className="text-xs text-gray-400">{r.label}</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {r.value}
            </p>
            {r.sub && <p className="text-xs text-gray-500 mt-0.5">{r.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   FILTER CHIP BAR
──────────────────────────────────────────────────────────── */
const FILTER_LABELS = {
  fromDate: "From",
  toDate: "To",
  employee: "Employee",
  callType: "Type",
  duration: "Duration",
  callTime: "Call Time",
  tl: "Team Lead",
  source: "Source",
};
function ActiveFilterChips({ filters, employeeName, onClear, onClearAll }) {
  const entries = Object.entries(filters).filter(([, v]) => !!v);
  if (entries.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full"
        >
          {FILTER_LABELS[k] || k}: {k === "employee" ? employeeName || v : v}
          <button
            onClick={() => onClear(k)}
            className="hover:bg-blue-100 rounded-full p-0.5"
          >
            <XIco />
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
      >
        Clear all
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   MAIN PAGE
──────────────────────────────────────────────────────────── */
const PINNED_STORAGE_KEY = "cr_pinned_numbers";

export default function PeriodicReportsPage() {
  return (
    <Suspense fallback={null}>
      <PeriodicReportsPageContent />
    </Suspense>
  );
}

function PeriodicReportsPageContent() {
  const searchParams = useSearchParams();
  const callTypeParam = searchParams.get("callType");
  const employeeParam = searchParams.get("employeeId");
  const fromDateParam = searchParams.get("fromDate");
  const toDateParam = searchParams.get("toDate");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState("summary");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [chartMode, setChartMode] = useState("composed");
  const [report, setReport] = useState(null);
  const [pinned, setPinned] = useState({});
  // Call History is served page-by-page rather than capped at one big client-side slab —
  // a wide date range runs to tens of thousands of calls, and the old flat `limit: 500`
  // silently hid everything past the newest 500.
  const [histPage, setHistPage] = useState(1);
  const [histLimit, setHistLimit] = useState(50);

  const [filters, setFilters] = useState({
    fromDate: fromDateParam || "",
    toDate: toDateParam || "",
    employee: employeeParam || "",
    callType: callTypeParam || "",
    duration: "",
    callTime: "",
    tl: "",
    source: "",
  });

  // Re-sync when deep-linked ?callType=/?employeeId=/?fromDate=/?toDate= change
  // (e.g. arriving here again from a different dashboard card) without
  // clobbering filters the user has since edited.
  useEffect(() => {
    if (callTypeParam || employeeParam || fromDateParam || toDateParam) {
      setFilters((f) => ({
        ...f,
        ...(callTypeParam && { callType: callTypeParam }),
        ...(employeeParam && { employee: employeeParam }),
        ...(fromDateParam && { fromDate: fromDateParam }),
        ...(toDateParam && { toDate: toDateParam }),
      }));
    }
  }, [callTypeParam, employeeParam, fromDateParam, toDateParam]);

  useEffect(() => {
    try {
      setPinned(JSON.parse(localStorage.getItem(PINNED_STORAGE_KEY) || "{}"));
    } catch {}
  }, []);
  const togglePin = (number) => {
    setPinned((p) => {
      const next = { ...p, [number]: !p[number] };
      try {
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const buildParams = useCallback(
    () => ({
      ...(filters.fromDate && { startDate: filters.fromDate }),
      ...(filters.toDate && { endDate: filters.toDate }),
      ...(filters.employee && { employeeId: filters.employee }),
      ...(filters.callType && { callType: filters.callType }),
      ...(filters.duration && { duration: filters.duration }),
      ...(filters.callTime && { callTime: filters.callTime }),
      ...(filters.tl && { tlName: filters.tl }),
      ...(filters.source && { source: filters.source }),
    }),
    [filters],
  );

  const load = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      try {
        const isHistory = activeTab === "callHistory";
        const res = await api.get("/api/reports/periodic", {
          params: {
            ...buildParams(),
            tab: activeTab,
            // Call History walks real server pages; the other tabs are bounded
            // aggregates that still come back in one shot.
            ...(isHistory
              ? { page: histPage, limit: histLimit }
              : { limit: 500 }),
          },
        });
        setReport(res.data?.data || null);
      } catch {
        setReport(null);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [buildParams, activeTab, histPage, histLimit],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Changing the tab or any filter invalidates the current Call History page number —
  // without this, jumping to page 40 then narrowing the date range would request a page
  // that no longer exists and render an empty table.
  useEffect(() => {
    setHistPage(1);
  }, [activeTab, filters]);
  useEffect(() => {
    api
      .get("/api/employees")
      .then((r) => setEmployees(r.data.data || []))
      .catch(() => {});
  }, []);

  // Rethrow on failure so EditableRemarks rolls back its optimistic text instead of
  // showing an edit that never actually reached the server.
  const saveNote = async (callId, notes) => {
    await api.patch(`/api/calls/${callId}/notes`, { notes });
  };

  const handleExport = () =>
    triggerServerExport({
      endpoint: "/api/calls/export",
      params: buildParams(),
      filename: `calls-${filters.fromDate || "all"}_${filters.toDate || "today"}.csv`,
    });

  const employeeName = employees.find((e) => e._id === filters.employee)?.name;
  const clearFilter = (key) => setFilters((f) => ({ ...f, [key]: "" }));
  const clearAllFilters = () =>
    setFilters({
      fromDate: "",
      toDate: "",
      employee: "",
      callType: "",
      duration: "",
      callTime: "",
      tl: "",
      source: "",
    });

  const pieData = (report?.pieData || []).map((d) => ({
    ...d,
    color: TYPE_META[d.name.toLowerCase()]?.color || d.color,
  }));
  const grandTotal = report?.summary?.total?.calls ?? 0;

  const hourlyChartData = (report?.hourly || []).map((h) => ({
    hour: h.label,
    calls: h.totalCalls,
    connected: h.connected,
  }));
  const dayWiseRows = (report?.daywise || []).map((d) => ({
    ...d,
    id: d.date,
  }));
  const hourlySlotRows = (report?.hourly || []).map((h) => ({
    ...h,
    id: h.hour,
  }));
  const neverAttendedRows = (report?.records || []).map((r) => ({
    ...r,
    id: r.contactNumber,
    employeesLabel: (r.employees || []).join(", "),
  }));
  const notPickupRows = report?.records || [];
  const uniqueClientRows = (report?.records || []).map((r) => ({
    ...r,
    id: r.contactNumber,
    employeesLabel: (r.employees || []).join(", "),
  }));
  const callHistoryRows = report?.calls || [];

  const employeeSummaryRows = report?.employeeSummary || [];
  const employeeSummaryFooter = employeeSummaryRows.length
    ? {
        employeeName: "Total",
        totalCalls: employeeSummaryRows.reduce(
          (s, e) => s + (e.totalCalls || 0),
          0,
        ),
        incoming: employeeSummaryRows.reduce(
          (s, e) => s + (e.incoming || 0),
          0,
        ),
        outgoing: employeeSummaryRows.reduce(
          (s, e) => s + (e.outgoing || 0),
          0,
        ),
        missed: employeeSummaryRows.reduce((s, e) => s + (e.missed || 0), 0),
        rejected: employeeSummaryRows.reduce(
          (s, e) => s + (e.rejected || 0),
          0,
        ),
        connectedCalls: employeeSummaryRows.reduce(
          (s, e) => s + (e.connectedCalls || 0),
          0,
        ),
        totalDuration: formatDuration(
          employeeSummaryRows.reduce(
            (s, e) => s + (e.totalDurationSec || 0),
            0,
          ),
        ),
      }
    : null;

  return (
    <div className="min-h-screen">
      <div className=" space-y-5">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              Reports <span className="text-gray-300">/</span>{" "}
              <span className="text-gray-500">Periodic Reports</span>
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">
              {report?.dateLabel || "Call Reports"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <RefreshIco spinning={refreshing} /> Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3.5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium shadow-sm"
            >
              <DownloadIco /> Export
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-800">
                Filters
              </span>
              <span className="text-xs text-gray-400">
                {filters.fromDate || "Any date"} – {filters.toDate || "today"}
              </span>
            </div>
            <ChevronIco open={filtersOpen} />
          </button>

          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Field label="From Date">
                      <div className="relative">
                        <input
                          type="date"
                          className="input pl-9"
                          value={filters.fromDate}
                          onChange={(e) =>
                            setFilters({ ...filters, fromDate: e.target.value })
                          }
                        />
                      </div>
                    </Field>
                    <Field label="To Date">
                      <div className="relative">
                        <input
                          type="date"
                          className="input pl-9"
                          value={filters.toDate}
                          onChange={(e) =>
                            setFilters({ ...filters, toDate: e.target.value })
                          }
                        />
                      </div>
                    </Field>
                    <Field label="Employee">
                      <select
                        className="input"
                        value={filters.employee}
                        onChange={(e) =>
                          setFilters({ ...filters, employee: e.target.value })
                        }
                      >
                        <option value="">All employees</option>
                        {employees.map((e) => (
                          <option key={e._id} value={e._id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Call Type">
                      <select
                        className="input"
                        value={filters.callType}
                        onChange={(e) =>
                          setFilters({ ...filters, callType: e.target.value })
                        }
                      >
                        <option value="">All types</option>
                        <option value="incoming">Incoming</option>
                        <option value="outgoing">Outgoing</option>
                        <option value="missed">Missed</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </Field>
                    <Field label="Duration">
                      <select
                        className="input"
                        value={filters.duration}
                        onChange={(e) =>
                          setFilters({ ...filters, duration: e.target.value })
                        }
                      >
                        <option value="">Any duration</option>
                        <option value="0-60">0 – 60s</option>
                        <option value="60-300">60 – 300s</option>
                        <option value="300+">300s+</option>
                      </select>
                    </Field>
                    <Field label="Call Time">
                      <select
                        className="input"
                        value={filters.callTime}
                        onChange={(e) =>
                          setFilters({ ...filters, callTime: e.target.value })
                        }
                      >
                        <option value="">Any time</option>
                        <option value="morning">Morning (6AM–12PM)</option>
                        <option value="afternoon">Afternoon (12PM–6PM)</option>
                        <option value="evening">Evening (6PM–12AM)</option>
                      </select>
                    </Field>
                    <Field label="Team Lead">
                      <TLFilter
                        value={filters.tl}
                        onChange={(v) => setFilters({ ...filters, tl: v })}
                        className="w-full"
                      />
                    </Field>
                    <Field label="Source">
                      <input
                        type="text"
                        placeholder="e.g. Meta, Call, Upload"
                        className="input"
                        value={filters.source}
                        onChange={(e) =>
                          setFilters({ ...filters, source: e.target.value })
                        }
                      />
                    </Field>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100">
                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={clearAllFilters}
                        className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => load()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ActiveFilterChips
          filters={filters}
          employeeName={employeeName}
          onClear={clearFilter}
          onClearAll={clearAllFilters}
        />

        {/* ── Tab nav ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <div className="flex gap-1 px-4 py-3 overflow-hidden">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-2 py-3.5 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                  activeTab === tab.key
                    ? "text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span
                  className={`flex items-center justify-center transition-transform ${activeTab === tab.key ? "scale-110" : ""}`}
                >
                  {tab.icon}
                </span>
                {tab.label}
                {tab.hint && <InfoDot text={tab.hint} />}
                {activeTab === tab.key && (
                  <motion.span
                    layoutId="tabUnderline"
                    className="absolute left-3 right-3 -bottom-px h-[2.5px] bg-blue-600 rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-5"
          >
            {/* ═══════════════ SUMMARY ═══════════════ */}
            {activeTab === "summary" && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 grid grid-cols-2 gap-3 auto-rows-min">
                  <StatCard
                    label="Total Calls"
                    value={grandTotal.toLocaleString()}
                    color="#2563EB"
                    icon={<PhoneIco s={16} />}
                  />
                  <StatCard
                    label="Connected Calls"
                    value={(
                      report?.sidebarStats?.connectedCalls ?? 0
                    ).toLocaleString()}
                    color="#16A34A"
                    icon={<CheckIco />}
                  />
                  <StatCard
                    label="Unique Clients"
                    value={(
                      report?.sidebarStats?.uniqueClients ?? 0
                    ).toLocaleString()}
                    color="#7C3AED"
                    icon={<UsersIco />}
                  />
                  <StatCard
                    label="Working Hours"
                    value={report?.sidebarStats?.workingHours ?? "0s"}
                    color="#D97706"
                    icon={<ClockIco />}
                  />
                </div>

                <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-1">
                    Calls
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Overall split by call type
                  </p>
                  {loading ? (
                    <Skeleton className="h-56 w-full" />
                  ) : (
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={54}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {pieData.map((e, i) => (
                              <Cell key={i} fill={e.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                        style={{ top: -8 }}
                      >
                        <p className="text-2xl font-bold text-gray-900">
                          {grandTotal.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400">Calls</p>
                      </div>
                      <div className="flex justify-center gap-4 mt-2 flex-wrap">
                        {pieData.map((d, i) => (
                          <span
                            key={i}
                            className="flex items-center gap-1.5 text-xs text-gray-500"
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: d.color }}
                            />{" "}
                            {d.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-7">
                    Call Type Breakdown
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2  gap-20">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase">
                          <th className="text-left pb-2 px-4">Call Type</th>
                          <th className="text-right pb-2 px-4">Calls</th>
                          <th className="text-right pb-2 px-4">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black ">
                        {["incoming", "outgoing", "missed", "rejected"].map(
                          (k) => (
                            <tr key={k}>
                              <td className="py-2.5 px-4">
                                <CallBadge type={k} />
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold text-gray-900">
                                {(
                                  report?.summary?.[k]?.calls ?? 0
                                ).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-4 text-right text-gray-500">
                                {report?.summary?.[k]?.duration ?? "—"}
                              </td>
                            </tr>
                          ),
                        )}
                        <tr className="border-t-2 border-gray-100">
                          <td className="py-2.5 px-4 font-bold text-gray-900">
                            Total
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-gray-900">
                            {grandTotal.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-gray-900">
                            {report?.summary?.total?.duration ?? "0s"}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="grid grid-cols-2 md:grid-cols-2 gap-3 border-t border-gray-100">
                      {[
                        {
                          label: "Never Attended",
                          value: report?.sidebarStats?.neverAttended ?? 0,
                          color: "#DC2626",
                        },
                        {
                          label: "Not Pickup by Client",
                          value: report?.sidebarStats?.notPickupByClient ?? 0,
                          color: "#EA580C",
                        },
                        {
                          label: "Connected Calls",
                          value: report?.sidebarStats?.connectedCalls ?? 0,
                          color: "#16A34A",
                        },
                        {
                          label: "Unique Connected",
                          value:
                            report?.sidebarStats?.uniqueConnectedCalls ?? 0,
                          color: "#0891B2",
                        },
                        {
                          label: "Unique Clients",
                          value: report?.sidebarStats?.uniqueClients ?? 0,
                          color: "#7C3AED",
                        },
                        {
                          label: "Working Hours",
                          value: report?.sidebarStats?.workingHours ?? "0s",
                          color: "#D97706",
                        },
                      ].map((s, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400">{s.label}</p>
                          <p
                            className="text-sm font-bold mt-0.5"
                            style={{ color: s.color }}
                          >
                            {s.value.toLocaleString?.() ?? s.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-1">
                    Employee Summary
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Per-employee call performance
                  </p>
                  <DataTable
                    loading={loading}
                    footer={employeeSummaryFooter}
                    columns={[
                      { key: "employeeName", label: "Employee", width: 160, render: (r) => <Truncate text={r.employeeName} /> },
                      { key: "tlName", label: "TL", width: 110, render: (r) => r.tlName ? <Truncate text={r.tlName} max={14} /> : <span className="text-gray-300">—</span> },
                      {
                        key: "totalCalls",
                        label: "Total",
                        align: "right",
                        width: 80,
                      },
                      {
                        key: "incoming",
                        label: "In",
                        align: "right",
                        searchable: false,
                        width: 70,
                      },
                      {
                        key: "outgoing",
                        label: "Out",
                        align: "right",
                        searchable: false,
                        width: 70,
                      },
                      {
                        key: "missed",
                        label: "Missed",
                        align: "right",
                        searchable: false,
                        width: 80,
                      },
                      {
                        key: "connectedCalls",
                        label: "Connected",
                        align: "right",
                        searchable: false,
                        width: 100,
                        render: (r) => (
                          <span className="text-emerald-600 font-semibold">
                            {r.connectedCalls}
                          </span>
                        ),
                      },
                      {
                        key: "neverAttended",
                        label: "Never Attended",
                        align: "right",
                        searchable: false,
                        width: 130,
                      },
                      {
                        key: "notPickupByClient",
                        label: "Not Pickup",
                        align: "right",
                        searchable: false,
                        width: 110,
                      },
                      {
                        key: "uniqueClients",
                        label: "Unique Clients",
                        align: "right",
                        searchable: false,
                        width: 120,
                      },
                      {
                        key: "totalDuration",
                        label: "Duration",
                        align: "right",
                        searchable: false,
                        width: 110,
                      },
                    ]}
                    rows={employeeSummaryRows}
                  />
                </div>
              </div>
            )}

            {/* ═══════════════ ANALYSIS ═══════════════ */}
            {activeTab === "analysis" && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        Calls vs. Connected — Hourly
                      </h3>
                      <p className="text-xs text-gray-400">
                        Bars = total calls · Line = connected calls
                      </p>
                    </div>
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                      {["composed", "bar"].map((m) => (
                        <button
                          key={m}
                          onClick={() => setChartMode(m)}
                          className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${chartMode === m ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  {loading ? (
                    <Skeleton className="h-72 w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={hourlyChartData}>
                        <defs>
                          <linearGradient
                            id="barGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#2563EB"
                              stopOpacity={0.9}
                            />
                            <stop
                              offset="100%"
                              stopColor="#2563EB"
                              stopOpacity={0.25}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#F1F5F9"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="hour"
                          tick={{ fill: "#94A3B8", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          interval={1}
                        />
                        <YAxis
                          tick={{ fill: "#94A3B8", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          width={32}
                          allowDecimals={false}
                        />
                        <Tooltip content={<ChartTip />} />
                        <Bar
                          dataKey="calls"
                          name="Total Calls"
                          fill="url(#barGrad)"
                          radius={[4, 4, 0, 0]}
                          barSize={22}
                        />
                        {chartMode === "composed" && (
                          <Line
                            type="monotone"
                            dataKey="connected"
                            name="Connected"
                            stroke="#16A34A"
                            strokeWidth={2}
                            dot={{ r: 3, fill: "#16A34A" }}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InsightCard
                    icon={<TrophyIco />}
                    title="Top Employees"
                    rows={[
                      {
                        label: "Top Dialer (Outgoing)",
                        value: report?.topDialer?.employeeName || "—",
                        sub: report?.topDialer
                          ? `${report.topDialer.count} dialed calls`
                          : "",
                      },
                      {
                        label: "Top Receiver (Incoming)",
                        value: report?.topReceiver?.employeeName || "—",
                        sub: report?.topReceiver
                          ? `${report.topReceiver.count} received calls`
                          : "",
                      },
                      {
                        label: "Top Overall Caller",
                        value: report?.topOverall?.employeeName || "—",
                        sub: report?.topOverall
                          ? `${report.topOverall.count} total calls (In + Out)`
                          : "",
                      },
                    ]}
                  />
                  <InsightCard
                    icon={<StopwatchIco />}
                    title="Total Call Duration Analysis"
                    rows={[
                      {
                        label: "Highest Total Duration",
                        value: report?.mostDuration?.employeeName || "—",
                        sub: report?.mostDuration?.duration || "0s",
                      },
                      {
                        label: "Longest Single Call",
                        value: report?.longestCall
                          ? `${report.longestCall.duration} (${TYPE_META[report.longestCall.callType]?.label || report.longestCall.callType})`
                          : "—",
                        sub: report?.longestCall
                          ? `To ${report.longestCall.contactName} (${report.longestCall.contactNumber}), ${fmtDateTime(report.longestCall.timestamp)}`
                          : "",
                      },
                    ]}
                  />
                  <InsightCard
                    icon={<GaugeIco />}
                    title="Avg. Duration of Connected Calls"
                    rows={[
                      {
                        label: "Per Incoming Call",
                        value: report?.avgIncomingDuration || "0s",
                      },
                      {
                        label: "Per Outgoing Call",
                        value: report?.avgOutgoingDuration || "0s",
                      },
                      {
                        label: "Per Day",
                        value: report?.avgPerDay || "0s",
                        sub: report?.dayCount
                          ? `${report.dayCount} business day${report.dayCount === 1 ? "" : "s"}`
                          : "",
                      },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* ═══════════════ DAY-WISE ═══════════════ */}
            {activeTab === "dayWise" && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-gray-900">
                    Business Days: {dayWiseRows.length}
                  </h3>
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    {["line", "bar"].map((m) => (
                      <button
                        key={m}
                        onClick={() => setChartMode(m)}
                        className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${chartMode === m ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
                      >
                        {m} chart
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  Daily totals within the selected date range
                </p>

                <DataTable
                  loading={loading}
                  searchable={false}
                  columns={[
                    { key: "label", label: "Day", width: 180 },
                    {
                      key: "totalCalls",
                      label: "Total Calls",
                      align: "right",
                      width: 130,
                    },
                    {
                      key: "connected",
                      label: "Connected",
                      align: "right",
                      width: 130,
                      render: (r) => (
                        <span className="text-emerald-600 font-semibold">
                          {r.connected}
                        </span>
                      ),
                    },
                    {
                      key: "duration",
                      label: "Total Duration",
                      align: "right",
                      searchable: false,
                      width: 150,
                    },
                  ]}
                  rows={dayWiseRows}
                />

                {!loading && dayWiseRows.length > 0 && (
                  <div className="mt-6">
                    <ResponsiveContainer width="100%" height={220}>
                      {chartMode === "bar" ? (
                        <BarChart
                          data={[...dayWiseRows].reverse().map((r) => ({
                            day: r.label.split(",")[0],
                            total: r.totalCalls,
                            connected: r.connected,
                          }))}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#F1F5F9"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="day"
                            tick={{ fill: "#94A3B8", fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tick={{ fill: "#94A3B8", fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            width={40}
                          />
                          <Tooltip content={<ChartTip />} />
                          <Bar
                            dataKey="total"
                            name="Total Calls"
                            fill="#2563EB"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="connected"
                            name="Connected"
                            fill="#16A34A"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      ) : (
                        <ComposedChart
                          data={[...dayWiseRows].reverse().map((r) => ({
                            day: r.label.split(",")[0],
                            total: r.totalCalls,
                            connected: r.connected,
                          }))}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#F1F5F9"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="day"
                            tick={{ fill: "#94A3B8", fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tick={{ fill: "#94A3B8", fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            width={40}
                          />
                          <Tooltip content={<ChartTip />} />
                          <Line
                            type="monotone"
                            dataKey="total"
                            name="Total Calls"
                            stroke="#2563EB"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="connected"
                            name="Connected"
                            stroke="#16A34A"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </ComposedChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════ HOURLY ═══════════════ */}
            {activeTab === "hourly" && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1">
                  Hourly Time Slots
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Share of total call volume by hour (IST)
                </p>
                <DataTable
                  loading={loading}
                  searchable={false}
                  columns={[
                    { key: "label", label: "Time Slot", width: 160 },
                    {
                      key: "totalCalls",
                      label: "Total Calls",
                      align: "right",
                      width: 120,
                    },
                    {
                      key: "connected",
                      label: "Connected",
                      align: "right",
                      width: 120,
                    },
                    {
                      key: "duration",
                      label: "Duration",
                      align: "right",
                      width: 120,
                    },
                    {
                      key: "pct",
                      label: "% of Total",
                      align: "right",
                      width: 160,
                      render: (r) => (
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(r.pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">
                            {r.pct}%
                          </span>
                        </div>
                      ),
                    },
                  ]}
                  rows={hourlySlotRows}
                />
              </div>
            )}

            {/* ═══════════════ NEVER ATTENDED ═══════════════ */}
            {activeTab === "neverAttended" && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                  Never Attended{" "}
                  <InfoDot text="Calls that were never returned, even after being missed." />
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Missed calls with zero follow-up outgoing call
                </p>
                <DataTable
                  loading={loading}
                  showRowNumber
                  emptyTitle="Nothing slipped through 🎉"
                  capNotice={
                    report?.total > neverAttendedRows.length
                      ? `Showing ${neverAttendedRows.length.toLocaleString()} of ${report.total.toLocaleString()} — narrow the date range or filters to see the rest.`
                      : null
                  }
                  columns={[
                    {
                      key: "contactName",
                      label: "Contact",
                      width: 220,
                      render: (r) => (
                        <div>
                          <p className="font-medium text-gray-900 truncate">
                            {r.contactName}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {r.contactNumber}
                          </p>
                        </div>
                      ),
                    },
                    {
                      key: "employeesLabel",
                      label: "Employees Involved",
                      width: 220,
                    },
                    {
                      key: "missedCount",
                      label: "Missed Count",
                      align: "right",
                      searchable: false,
                      width: 130,
                      render: (r) => (
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold">
                          {r.missedCount}×
                        </span>
                      ),
                    },
                    {
                      key: "lastMissedAt",
                      label: "Last Missed At",
                      searchable: false,
                      width: 170,
                      render: (r) => fmtDateTime(r.lastMissedAt),
                    },
                  ]}
                  rows={neverAttendedRows}
                />
              </div>
            )}

            {/* ═══════════════ NOT PICKUP BY CLIENT ═══════════════ */}
            {activeTab === "notPickup" && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                  Not Pickup by Client{" "}
                  <InfoDot text="Outgoing calls the client never answered." />
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Outbound attempts that went unanswered
                </p>
                <DataTable
                  loading={loading}
                  showRowNumber
                  capNotice={
                    report?.total > notPickupRows.length
                      ? `Showing ${notPickupRows.length.toLocaleString()} of ${report.total.toLocaleString()} — narrow the date range or filters to see the rest.`
                      : null
                  }
                  columns={[
                    { key: "employeeName", label: "Employee", width: 150 },
                    {
                      key: "contactName",
                      label: "Contact",
                      width: 220,
                      render: (r) => (
                        <div>
                          <p className="font-medium text-gray-900 truncate">
                            {r.contactName}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {r.contactNumber}
                          </p>
                        </div>
                      ),
                    },
                    {
                      key: "callType",
                      label: "Call Type",
                      width: 140,
                      filterType: "select",
                      filterPlaceholder: "Select",
                      filterOptions: Object.entries(TYPE_META).map(
                        ([value, m]) => ({
                          value,
                          label: m.label,
                        }),
                      ),
                      render: (r) => <CallBadge type={r.callType} />,
                    },
                    {
                      key: "date",
                      label: "Date",
                      width: 130,
                      filterType: "date",
                      filterValue: (r) => r.timestamp,
                      render: (r) => fmtDate(r.timestamp),
                    },
                    {
                      key: "time",
                      label: "Time",
                      searchable: false,
                      width: 100,
                      render: (r) => fmtTime(r.timestamp),
                    },
                  ]}
                  rows={notPickupRows}
                />
              </div>
            )}

            {/* ═══════════════ UNIQUE CLIENTS ═══════════════ */}
            {activeTab === "uniqueClients" && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                  Unique Clients{" "}
                  <InfoDot text="One row per distinct phone number contacted." />
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Every distinct client contacted this period
                </p>
                <DataTable
                  loading={loading}
                  showRowNumber
                  capNotice={
                    report?.total > uniqueClientRows.length
                      ? `Showing ${uniqueClientRows.length.toLocaleString()} of ${report.total.toLocaleString()} — narrow the date range or filters to see the rest.`
                      : null
                  }
                  columns={[
                    {
                      key: "contactName",
                      label: "Client",
                      width: 200,
                      render: (r) => (
                        <div>
                          <p className="font-medium text-gray-900 truncate">
                            {r.contactName}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {r.contactNumber}
                          </p>
                        </div>
                      ),
                    },
                    {
                      key: "totalCalls",
                      label: "Total",
                      align: "right",
                      width: 80,
                    },
                    {
                      key: "incoming",
                      label: "In",
                      align: "right",
                      searchable: false,
                      width: 70,
                    },
                    {
                      key: "outgoing",
                      label: "Out",
                      align: "right",
                      searchable: false,
                      width: 70,
                    },
                    {
                      key: "missed",
                      label: "Missed",
                      align: "right",
                      searchable: false,
                      width: 80,
                      render: (r) => (
                        <span className="text-red-600">{r.missed}</span>
                      ),
                    },
                    {
                      key: "connectedCalls",
                      label: "Connected",
                      align: "right",
                      searchable: false,
                      width: 100,
                      render: (r) => (
                        <span className="text-emerald-600 font-semibold">
                          {r.connectedCalls}
                        </span>
                      ),
                    },
                    {
                      key: "lastCallAt",
                      label: "Last Call Details",
                      searchable: false,
                      width: 260,
                      render: (r) => (
                        <div className="bg-gray-50 rounded-lg px-3 py-2 max-w-full">
                          <p className="text-xs text-gray-500 truncate">
                            {r.employeesLabel} — {fmtDateTime(r.lastCallAt)}
                          </p>
                        </div>
                      ),
                    },
                    {
                      key: "totalDuration",
                      label: "Duration",
                      align: "right",
                      searchable: false,
                      width: 110,
                    },
                  ]}
                  rows={uniqueClientRows}
                />
              </div>
            )}

            {/* ═══════════════ CALL HISTORY ═══════════════ */}
            {activeTab === "callHistory" && (
              <div className="bg-white rounded-xl border border-gray-200">
                <DataTable
                  loading={loading}
                  showRowNumber
                  serverMode
                  page={histPage}
                  totalPages={report?.pages || 1}
                  totalCount={report?.total ?? 0}
                  pageSize={histLimit}
                  onPageChange={setHistPage}
                  onPageSizeChange={(n) => { setHistLimit(n); setHistPage(1); }}
                  columns={[
                    {
                      key: "employeeName", label: "Employee", width: 150,
                      render: (r) => (
                        <div>
                          <p><Truncate text={r.employeeName} /></p>
                          {r.employeeTL && <p className="text-[11px] text-gray-400">TL: <Truncate text={r.employeeTL} max={14} /></p>}
                        </div>
                      ),
                    },
                    {
                      key: "contactNumber",
                      label: "To Number",
                      width: 160,
                      render: (r) => (
                        <PinnedNumber
                          number={r.contactNumber}
                          pinned={!!pinned[r.contactNumber]}
                          onToggle={() => togglePin(r.contactNumber)}
                        />
                      ),
                    },
                    { key: "contactName", label: "Contact Name", width: 150, render: (r) => <Truncate text={r.contactName} /> },
                    {
                      key: "source",
                      label: "Source",
                      width: 120,
                      searchable: false,
                      render: (r) => r.source
                        ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">{r.source}</span>
                        : <span className="text-gray-300">—</span>,
                    },
                    {
                      key: "contactType",
                      label: "Contact Type",
                      width: 110,
                      filterType: "select",
                      filterOptions: ["New", "Repeat"],
                      render: (r) => (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.contactType === "New" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>
                          {r.contactType || "—"}
                        </span>
                      ),
                    },
                    {
                      key: "date",
                      label: "Date",
                      width: 130,
                      filterType: "date",
                      filterValue: (r) => r.timestamp,
                      render: (r) => fmtDate(r.timestamp),
                    },
                    {
                      key: "time",
                      label: "Time",
                      searchable: false,
                      width: 90,
                      render: (r) => fmtTime(r.timestamp),
                    },
                    {
                      key: "duration",
                      label: "Duration",
                      align: "right",
                      searchable: false,
                      width: 100,
                      render: (r) => formatDuration(r.duration),
                    },
                    {
                      key: "callType",
                      label: "Call Type",
                      width: 140,
                      filterType: "select",
                      filterPlaceholder: "Select",
                      filterOptions: Object.entries(TYPE_META).map(
                        ([value, m]) => ({
                          value,
                          label: m.label,
                        }),
                      ),
                      render: (r) => <CallBadge type={r.callType} />,
                    },
                    {
                      key: "notes",
                      label: "Remarks",
                      width: 220,
                      wrap: true,
                      render: (r) => (
                        <EditableRemarks
                          value={r.notes}
                          updatedAt={r.notesUpdatedAt}
                          updatedByName={r.notesUpdatedByName}
                          onSave={(val) => saveNote(r._id, val)}
                        />
                      ),
                    },
                  ]}
                  rows={callHistoryRows}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
          font-size: 0.8125rem;
          outline: none;
          background: white;
          transition: border-color 0.15s;
        }
        .input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
      `}</style>
    </div>
  );
}
