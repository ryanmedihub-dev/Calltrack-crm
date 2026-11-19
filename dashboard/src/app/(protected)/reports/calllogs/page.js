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
import { getAllEmployeesSafe } from '../../../../lib/employees';
import { useReportData, invalidateReportCache } from "../../../../lib/useReportData";
import { triggerServerExport } from "../../../../lib/downloads";
import { fmtDate, fmtTime, fmtDateTime } from "../../../../lib/timezone";
import { motion, AnimatePresence } from "framer-motion";
import { DataTable, TLFilter, Truncate, EditableRemarks, CallBadge, InfoDot, ChartTip, StatCard, Skeleton, EmptyState, InsightCard, Field, TYPE_META , PageHeader } from "../../../../components/report-shared";
import MultiSelect from '../../../../components/MultiSelect';
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
/* Pin toggle used in Call History "To Number" column — persisted in localStorage
   (there's no backend field for this, so it's client-only but genuinely persists). */
function PinnedNumber({ number, pinned, onToggle }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-ink font-medium tabular-nums">{number}</span>
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
          className="inline-flex items-center gap-1.5 h-7 bg-white text-ink-2 text-xs pl-2.5 pr-1 rounded-md border border-line"
        >
          {FILTER_LABELS[k] || k}: {k === "employee" ? employeeName || v : String(v).split(",").join(", ")}
          <button
            onClick={() => onClear(k)}
            className="w-5 h-5 rounded flex items-center justify-center text-ink-3 hover:bg-gray-100 hover:text-ink transition-colors"
          >
            <XIco />
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs font-medium text-ink-3 hover:text-ink px-1 transition-colors"
      >
        Clear all
      </button>
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

  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState("summary");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [chartMode, setChartMode] = useState("composed");
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

  const queryParams = useMemo(
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
  const buildParams = useCallback(() => queryParams, [queryParams]);

  // Changing the tab or any filter invalidates the current Call History page number —
  // without this, jumping to page 40 then narrowing the date range would request a page
  // that no longer exists and render an empty table.
  //
  // This runs *before* the fetch effect inside useReportData (effects fire in declaration
  // order), so the page reset is already folded into `requestParams` by the time a request
  // goes out — the old code reset the page in a later effect and paid for two requests per
  // tab switch, the first of which was for a page number it had already invalidated.
  useEffect(() => {
    setHistPage(1);
  }, [activeTab, queryParams]);

  const requestParams = useMemo(
    () => ({
      ...queryParams,
      tab: activeTab,
      // Call History walks real server pages; the other tabs are bounded
      // aggregates that still come back in one shot.
      ...(activeTab === "callHistory"
        ? { page: histPage, limit: histLimit }
        : { limit: 500 }),
    }),
    [queryParams, activeTab, histPage, histLimit],
  );

  const {
    data: report,
    loading,
    refreshing,
    refresh,
  } = useReportData("/api/reports/periodic", requestParams);
  const load = refresh;
  useEffect(() => {
    getAllEmployeesSafe(api).then(setEmployees).catch(() => {});
  }, []);

  // Rethrow on failure so EditableRemarks rolls back its optimistic text instead of
  // showing an edit that never actually reached the server.
  const saveNote = async (callId, notes) => {
    await api.patch(`/api/calls/${callId}/notes`, { notes });
    // The row on screen already shows the new text optimistically, but every cached page of
    // this report still holds the old one — drop them so leaving the tab and coming back
    // inside the cache window doesn't resurrect the pre-edit remark.
    invalidateReportCache();
  };

  const handleExport = () =>
    triggerServerExport({
      endpoint: "/api/calls/export",
      params: buildParams(),
      filename: `calls-${filters.fromDate || "all"}_${filters.toDate || "today"}.csv`,
    });

  const employeeName = filters.employee ? filters.employee.split(',').map((id) => employees.find((e) => e._id === id)?.name || id).join(', ') : undefined;
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
    <div>
      <div className="space-y-5">
        <PageHeader
          title="Calls report"
          description={report?.dateLabel ? `Call activity · ${report.dateLabel}` : 'Call activity across agents, by period'}
          actions={
            <>
              <button onClick={() => load(true)} className="btn-secondary" disabled={refreshing}>
                <RefreshIco spinning={refreshing} /> Refresh
              </button>
              <button onClick={handleExport} className="btn-primary">
                <DownloadIco /> Export CSV
              </button>
            </>
          }
        />

        {/* ── Filters ── */}
        <div className="panel">
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
            className="w-full flex items-center justify-between gap-3 px-5 h-12 text-left"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="text-[13px] font-medium text-ink">Filters</span>
              <span className="text-[13px] text-ink-3 truncate">
                {filters.fromDate || 'Any date'} – {filters.toDate || 'today'}
              </span>
            </span>
            <span className={`text-ink-3 transition-transform duration-200 ease-out ${filtersOpen ? 'rotate-180' : ''}`}><ChevronIco open={false} /></span>
          </button>

          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 pt-4 border-t border-line-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-4">
                    <Field label="From">
                      <input type="date" className="form-input" value={filters.fromDate}
                        onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
                    </Field>
                    <Field label="To">
                      <input type="date" className="form-input" value={filters.toDate}
                        onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
                    </Field>
                    <Field label="Employee">
                      <MultiSelect value={filters.employee} onChange={(v) => setFilters({ ...filters, employee: v })}
                        placeholder="All employees" noun="employees" ariaLabel="Employee" options={employees.map((e) => [e._id, e.name])} />
                    </Field>
                    <Field label="Call type">
                      <MultiSelect value={filters.callType} onChange={(v) => setFilters({ ...filters, callType: v })}
                        placeholder="All types" noun="types" ariaLabel="Call type" options={[['incoming', 'Incoming'], ['outgoing', 'Outgoing'], ['missed', 'Missed'], ['rejected', 'Rejected']]} />
                    </Field>
                    <Field label="Duration">
                      <MultiSelect value={filters.duration} onChange={(v) => setFilters({ ...filters, duration: v })}
                        placeholder="Any duration" noun="ranges" ariaLabel="Duration"
                        options={[['0-60', 'Under 1 min'], ['60-300', '1 – 5 min'], ['300+', 'Over 5 min']]} />
                    </Field>
                    <Field label="Time of day">
                      <MultiSelect value={filters.callTime} onChange={(v) => setFilters({ ...filters, callTime: v })}
                        placeholder="Any time" noun="windows" ariaLabel="Time of day"
                        options={[['morning', 'Morning (6 AM–12 PM)'], ['afternoon', 'Afternoon (12–6 PM)'], ['evening', 'Evening (6 PM–12 AM)']]} />
                    </Field>
                    <Field label="Team lead">
                      <TLFilter value={filters.tl} onChange={(v) => setFilters({ ...filters, tl: v })} className="w-full" />
                    </Field>
                    <Field label="Lead source">
                      <input type="text" placeholder="Meta, Call, Upload…" className="form-input" value={filters.source}
                        onChange={(e) => setFilters({ ...filters, source: e.target.value })} />
                    </Field>
                  </div>
                  <div className="flex justify-end gap-2 mt-5">
                    <button onClick={clearAllFilters} className="btn-ghost">Reset</button>
                    <button onClick={() => load()} className="btn-primary">Apply filters</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ActiveFilterChips filters={filters} employeeName={employeeName} onClear={clearFilter} onClearAll={clearAllFilters} />

        {/* ── Tabs ── */}
        <div className="tab-nav mb-0" role="tablist">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} role="tab" aria-selected={active} onClick={() => setActiveTab(tab.key)}
                className={`tab-item !border-transparent ${active ? 'text-ink' : ''}`}>
                {tab.label}
                {tab.hint && <InfoDot text={tab.hint} />}
                {active && (
                  <motion.span layoutId="callsTabUnderline" className="absolute left-0 right-0 -bottom-px h-0.5 bg-[var(--blue)] rounded-full"
                    transition={{ duration: 0.25, ease: [0.77, 0, 0.175, 1] }} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="space-y-5"
          >
            {/* ═══════════════ SUMMARY ═══════════════ */}
            {activeTab === "summary" && (
              <div className="space-y-5">
                <section className="panel overflow-hidden" aria-label="Summary">
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 [&>*]:border-line-2 [&>*]:border-b xl:[&>*]:border-b-0 xl:divide-x divide-line-2">
                    {[
                      { label: 'Total calls', value: grandTotal },
                      { label: 'Connected', value: report?.sidebarStats?.connectedCalls ?? 0, sub: grandTotal ? `${Math.round(((report?.sidebarStats?.connectedCalls ?? 0) / grandTotal) * 100)}% of calls` : null },
                      { label: 'Unique clients', value: report?.sidebarStats?.uniqueClients ?? 0, sub: `${(report?.sidebarStats?.uniqueConnectedCalls ?? 0).toLocaleString('en-IN')} reached` },
                      { label: 'Never attended', value: report?.sidebarStats?.neverAttended ?? 0, sub: 'Missed, never called back', tone: (report?.sidebarStats?.neverAttended ?? 0) > 0 ? 'behind' : null },
                      { label: 'Not picked up', value: report?.sidebarStats?.notPickupByClient ?? 0, sub: 'Outgoing, client didn’t answer' },
                      { label: 'Active calling time', value: report?.sidebarStats?.workingHours ?? '0s', sub: 'First to last call, summed' },
                    ].map((s) => (
                      <div key={s.label} className="px-5 py-4 min-w-0">
                        <p className="stat-label">{s.label}</p>
                        {loading ? <Skeleton className="h-7 w-20 mt-2" /> : (
                          <p className={`stat-number mt-1 ${s.tone === 'behind' ? 'text-behind' : ''}`}>
                            {typeof s.value === 'number' ? s.value.toLocaleString('en-IN') : s.value}
                          </p>
                        )}
                        {s.sub && <p className="text-xs text-ink-3 mt-1 truncate">{s.sub}</p>}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="panel" aria-label="Call type breakdown">
                  <div className="panel-head">
                    <div>
                      <h3 className="panel-title">By call type</h3>
                      <p className="panel-sub">Calls and talk time per type</p>
                    </div>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th className="w-[40%] hidden md:table-cell">Share</th>
                        <th className="!text-right">Calls</th>
                        <th className="!text-right">Talk time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["outgoing", "incoming", "missed", "rejected"].map((k) => {
                        const calls = report?.summary?.[k]?.calls ?? 0;
                        const pct = grandTotal ? (calls / grandTotal) * 100 : 0;
                        return (
                          <tr key={k}>
                            <td><CallBadge type={k} /></td>
                            <td className="hidden md:table-cell">
                              <div className="flex items-center gap-3">
                                <span className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <span className="block h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: TYPE_META[k].color }} />
                                </span>
                                <span className="w-10 text-right text-xs text-ink-3 tabular-nums">{Math.round(pct)}%</span>
                              </div>
                            </td>
                            <td className="text-right font-medium text-ink tabular-nums">{calls.toLocaleString('en-IN')}</td>
                            <td className="text-right tabular-nums">{report?.summary?.[k]?.duration ?? '—'}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50">
                        <td className="font-semibold text-ink">Total</td>
                        <td className="hidden md:table-cell" />
                        <td className="text-right font-semibold text-ink tabular-nums">{grandTotal.toLocaleString('en-IN')}</td>
                        <td className="text-right font-semibold text-ink tabular-nums">{report?.summary?.total?.duration ?? '0s'}</td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section className="panel" aria-label="Employee summary">
                  <div className="panel-head">
                    <div>
                      <h3 className="panel-title">By employee</h3>
                      <p className="panel-sub">Per-employee call performance for this period</p>
                    </div>
                  </div>
                  <div className="p-4 pt-3">
                  <DataTable
                    loading={loading}
                    footer={employeeSummaryFooter}
                    columns={[
                      { key: "employeeName", label: "Employee", width: 170, render: (r) => <span className="font-medium text-ink"><Truncate text={r.employeeName} max={22} /></span> },
                      { key: "tlName", label: "Team lead", width: 120, render: (r) => r.tlName ? <Truncate text={r.tlName} max={14} /> : <span className="text-ink-4">—</span> },
                      { key: "totalCalls", label: "Total", align: "right", width: 80 },
                      { key: "incoming", label: "In", align: "right", searchable: false, width: 64 },
                      { key: "outgoing", label: "Out", align: "right", searchable: false, width: 64 },
                      { key: "missed", label: "Missed", align: "right", searchable: false, width: 76, render: (r) => r.missed ? <span className="text-behind">{r.missed.toLocaleString('en-IN')}</span> : <span className="text-ink-4">0</span> },
                      { key: "connectedCalls", label: "Connected", align: "right", searchable: false, width: 96 },
                      { key: "neverAttended", label: "Never attended", align: "right", searchable: false, width: 124 },
                      { key: "notPickupByClient", label: "Not picked up", align: "right", searchable: false, width: 116 },
                      { key: "uniqueClients", label: "Unique clients", align: "right", searchable: false, width: 116 },
                      { key: "totalDuration", label: "Talk time", align: "right", searchable: false, width: 104 },
                    ]}
                    rows={employeeSummaryRows}
                  />
                  </div>
                </section>
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
                      <p className="text-xs text-gray-500">
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
                              stopColor="#7C3AED"
                              stopOpacity={0.9}
                            />
                            <stop
                              offset="100%"
                              stopColor="#7C3AED"
                              stopOpacity={0.25}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#F4F3F8"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="hour"
                          tick={{ fill: "#A19DB2", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          interval={1}
                        />
                        <YAxis
                          tick={{ fill: "#A19DB2", fontSize: 10 }}
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
                            stroke="#079455"
                            strokeWidth={2}
                            dot={{ r: 3, fill: "#079455" }}
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
                <p className="text-xs text-gray-500 mb-4">
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
                            stroke="#F4F3F8"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="day"
                            tick={{ fill: "#A19DB2", fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tick={{ fill: "#A19DB2", fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            width={40}
                          />
                          <Tooltip content={<ChartTip />} />
                          <Bar
                            dataKey="total"
                            name="Total Calls"
                            fill="#7C3AED"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="connected"
                            name="Connected"
                            fill="#079455"
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
                            stroke="#F4F3F8"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="day"
                            tick={{ fill: "#A19DB2", fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tick={{ fill: "#A19DB2", fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            width={40}
                          />
                          <Tooltip content={<ChartTip />} />
                          <Line
                            type="monotone"
                            dataKey="total"
                            name="Total Calls"
                            stroke="#7C3AED"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="connected"
                            name="Connected"
                            stroke="#079455"
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
                <p className="text-xs text-gray-500 mb-4">
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
                <p className="text-xs text-gray-500 mb-4">
                  Missed calls with zero follow-up outgoing call
                </p>
                <DataTable
                  loading={loading}
                  showRowNumber
                  emptyTitle="Nothing slipped through"
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
                          <p className="text-xs text-gray-500 truncate">
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
                <p className="text-xs text-gray-500 mb-4">
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
                          <p className="text-xs text-gray-500 truncate">
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
                <p className="text-xs text-gray-500 mb-4">
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
                          <p className="text-xs text-gray-500 truncate">
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
                          {r.employeeTL && <p className="text-xs text-gray-500">TL: <Truncate text={r.employeeTL} max={14} /></p>}
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
    </div>
  );
}
