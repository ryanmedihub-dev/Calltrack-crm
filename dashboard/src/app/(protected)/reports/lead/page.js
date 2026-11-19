"use client";
import { STATUSES, STATUS_LABELS, STATUS_STYLES, statusStyle, statusLabel } from "../../../../lib/leadStatus";
import { Suspense, useEffect, useState, useMemo } from "react";
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
import { DataTable, TLFilter, Truncate, InfoDot, ChartTip, StatCard, Skeleton, EmptyState, InsightCard, Field, LeadStatusBadge } from "../../../../components/report-shared";
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
const GridIco = () => (
  <Ico size={15} className="text-indigo-500">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Ico>
);
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
const TagIco = () => (
  <Ico size={15} className="text-cyan-600">
    <path d="M12 2H4a2 2 0 0 0-2 2v8l10 10 10-10-10-10z" />
    <circle cx="7" cy="7" r="1.5" />
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
const DotsIco = () => (
  <Ico size={14}>
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </Ico>
);
const PlusIco = () => (
  <Ico size={12}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
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
// Talk-time bands (not_connected .. high_engagement) ride a cold -> hot ramp; mirrors
// backend/lib/engagement.js.
// Derived from lib/leadStatus.js so this report uses the same status colours as every other page.
const STATUS_META = Object.fromEntries(STATUSES.map((k) => [k, { label: STATUS_LABELS[k], color: STATUS_STYLES[k].hex }]));
const STATUS_KEYS = Object.keys(STATUS_META);

const TABS = [
  { key: "summary", label: "Summary", icon: <GridIco /> },
  { key: "analysis", label: "Analysis", icon: <BarChartTabIco /> },
  { key: "dayWise", label: "Day-wise Analysis", icon: <CalendarTabIco /> },
  { key: "hourly", label: "Hourly Analysis", icon: <ClockTabIco /> },
  {
    key: "uncontacted",
    label: "Uncontacted",
    icon: <NoEntryIco />,
    hint: "Leads with zero call attempts logged so far.",
  },
  {
    key: "notConnected",
    label: "Not Connected",
    icon: <PhoneTabIco />,
    hint: "Leads currently marked as not connected after being called.",
  },
  {
    key: "sources",
    label: "Lead Sources",
    icon: <TagIco />,
    hint: "Every lead source, grouped, with conversion performance.",
  },
  { key: "leadList", label: "Lead List", icon: <ClipboardIco /> },
];

/* ────────────────────────────────────────────────────────────
   SMALL UI PRIMITIVES
──────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  return <LeadStatusBadge status={status} style={statusStyle(status)} label={statusLabel(status)} />;
}

/* Pin toggle used in Lead List "Contact Number" column — persisted in localStorage
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

/* Generic inline text editor used for Lead List "Notes" column.
   Saves via POST /api/leads/:id/note (appends to the lead's changelog). */
function EditableCell({ initial, onSave, placeholder = "Add note" }) {
  const [value, setValue] = useState(initial || "");
  const [editing, setEditing] = useState(false);
  const commit = () => {
    setEditing(false);
    if (value !== (initial || "")) onSave?.(value);
  };
  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="text-xs border border-blue-300 rounded-md px-2 py-1 outline-none w-full"
      />
    );
  }
  return value ? (
    <div className="flex items-center gap-1.5 justify-between">
      <span className="text-xs text-gray-600 truncate" title={value}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0"
      >
        <DotsIco />
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-xs text-blue-600 font-medium flex items-center gap-1 hover:underline"
    >
      <PlusIco /> {placeholder}
    </button>
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
  status: "Status",
  source: "Source",
  leadTime: "Lead Time",
  tl: "Team Lead",
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
          {FILTER_LABELS[k] || k}:{" "}
          {k === "employee"
            ? employeeName || v
            : k === "status"
              ? String(v).split(",").map((s) => STATUS_META[s]?.label || s).join(", ")
              : String(v).split(",").join(", ")}
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
const PINNED_STORAGE_KEY = "lr_pinned_numbers";

export default function LeadReportsPage() {
  return (
    <Suspense fallback={null}>
      <LeadReportsPageContent />
    </Suspense>
  );
}

function LeadReportsPageContent() {
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const fromDateParam = searchParams.get("fromDate");
  const toDateParam = searchParams.get("toDate");

  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState("summary");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [chartMode, setChartMode] = useState("composed");
  const [pinned, setPinned] = useState({});

  const [filters, setFilters] = useState({
    fromDate: fromDateParam || "",
    toDate: toDateParam || "",
    employee: "",
    status: statusParam || "",
    source: "",
    leadTime: "",
    tl: "",
  });

  // Re-sync when the deep-linked ?status=/?fromDate=/?toDate= change (e.g.
  // navigating here again from a different overview card) without clobbering
  // filters the user has since edited.
  useEffect(() => {
    if (statusParam || fromDateParam || toDateParam) {
      setFilters((f) => ({
        ...f,
        ...(statusParam && { status: statusParam }),
        ...(fromDateParam && { fromDate: fromDateParam }),
        ...(toDateParam && { toDate: toDateParam }),
      }));
    }
  }, [statusParam, fromDateParam, toDateParam]);

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
      ...(filters.status && { status: filters.status }),
      ...(filters.source && { source: filters.source }),
      ...(filters.leadTime && { leadTime: filters.leadTime }),
      ...(filters.tl && { tlName: filters.tl }),
    }),
    [filters],
  );
  const requestParams = useMemo(
    () => ({ ...queryParams, tab: activeTab, limit: 500 }),
    [queryParams, activeTab],
  );

  const {
    data: report,
    loading,
    refreshing,
    refresh,
  } = useReportData("/api/reports/leads-periodic", requestParams);
  const load = refresh;
  useEffect(() => {
    getAllEmployeesSafe(api).then(setEmployees).catch(() => {});
  }, []);

  const saveNote = async (leadId, text) => {
    try {
      await api.post(`/api/leads/${leadId}/note`, { text });
      // Drop the cached report pages so the pre-edit note can't come back when the user
      // leaves this tab and returns inside the cache window.
      invalidateReportCache();
    } catch {}
  };

  const handleExport = () =>
    triggerServerExport({
      endpoint: "/api/leads/export",
      params: {
        ...(filters.fromDate && { startDate: filters.fromDate }),
        ...(filters.toDate && { endDate: filters.toDate }),
        ...(filters.employee && { assignedTo: filters.employee }),
        ...(filters.status && { status: filters.status }),
        ...(filters.tl && { tlName: filters.tl }),
      },
      filename: `leads-${filters.fromDate || "all"}_${filters.toDate || "today"}.csv`,
    });

  const employeeName = filters.employee ? filters.employee.split(',').map((id) => employees.find((e) => e._id === id)?.name || id).join(', ') : undefined;
  const clearFilter = (key) => setFilters((f) => ({ ...f, [key]: "" }));
  const clearAllFilters = () =>
    setFilters({
      fromDate: "",
      toDate: "",
      employee: "",
      status: "",
      source: "",
      leadTime: "",
      tl: "",
    });

  const pieData = (report?.pieData || []).map((d) => ({
    ...d,
    color: STATUS_META[d.key]?.color || d.color,
  }));
  const grandTotal = report?.summary?.total?.leads ?? 0;

  const hourlyChartData = (report?.hourly || []).map((h) => ({
    hour: h.label,
    total: h.total,
    contacted: h.contacted,
  }));
  const dayWiseRows = (report?.daywise || []).map((d) => ({
    ...d,
    id: d.date,
  }));
  const hourlySlotRows = (report?.hourly || []).map((h) => ({
    ...h,
    id: h.hour,
  }));
  const uncontactedRows = (report?.records || []).map((r) => ({
    ...r,
    id: r._id || r.phone,
  }));
  const notConnectedRows = report?.records || [];
  const sourceRows = (report?.records || []).map((r) => ({
    ...r,
    id: r.source,
  }));
  const leadListRows = report?.leads || [];

  const employeeSummaryRows = report?.employeeSummary || [];
  const employeeSummaryFooter = employeeSummaryRows.length
    ? {
        employeeName: "Total",
        total: employeeSummaryRows.reduce((s, e) => s + (e.total || 0), 0),
        new: employeeSummaryRows.reduce((s, e) => s + (e.new || 0), 0),
        contacted: employeeSummaryRows.reduce(
          (s, e) => s + (e.contacted || 0),
          0,
        ),
        follow_up: employeeSummaryRows.reduce(
          (s, e) => s + (e.follow_up || 0),
          0,
        ),
        converted: employeeSummaryRows.reduce(
          (s, e) => s + (e.converted || 0),
          0,
        ),
        lost: employeeSummaryRows.reduce((s, e) => s + (e.lost || 0), 0),
        conversionRate: (() => {
          const t = employeeSummaryRows.reduce((s, e) => s + (e.total || 0), 0);
          const c = employeeSummaryRows.reduce(
            (s, e) => s + (e.converted || 0),
            0,
          );
          return t ? Math.round((c / t) * 100) + "%" : "0%";
        })(),
      }
    : null;

  return (
    <div className="min-h-screen">
      <div className=" space-y-5">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title">Leads report</h1>
            <p className="page-subtitle">{report?.dateLabel ? `Lead status and movement · ${report.dateLabel}` : "Lead status and movement, by period"}</p>
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
              className="flex items-center gap-2 px-3.5 py-2 bg-[var(--blue)] text-white rounded-lg hover:bg-[var(--blue-600)] transition-colors text-sm font-medium shadow-sm"
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
              <span className="text-xs text-gray-500">
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
                          className="form-input pl-9"
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
                          className="form-input pl-9"
                          value={filters.toDate}
                          onChange={(e) =>
                            setFilters({ ...filters, toDate: e.target.value })
                          }
                        />
                      </div>
                    </Field>
                    <Field label="Employee">
                      <MultiSelect value={filters.employee} onChange={(v) => setFilters({ ...filters, employee: v })}
                        placeholder="All employees" noun="employees" ariaLabel="Employee" options={employees.map((e) => [e._id, e.name])} />
                    </Field>
                    <Field label="Status">
                      <MultiSelect value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })}
                        placeholder="All statuses" noun="statuses" ariaLabel="Status"
                        options={STATUS_KEYS.map((k) => [k, STATUS_META[k].label])} />
                    </Field>
                    <Field label="Source">
                      <input
                        type="text"
                        placeholder="e.g. Facebook, Walk-in"
                        className="form-input"
                        value={filters.source}
                        onChange={(e) =>
                          setFilters({ ...filters, source: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Lead Time">
                      <MultiSelect value={filters.leadTime} onChange={(v) => setFilters({ ...filters, leadTime: v })}
                        placeholder="Any time" noun="windows" ariaLabel="Lead time"
                        options={[['morning', 'Morning (6AM–12PM)'], ['afternoon', 'Afternoon (12PM–6PM)'], ['evening', 'Evening (6PM–12AM)']]} />
                    </Field>
                    <Field label="Team Lead">
                      <TLFilter
                        value={filters.tl}
                        onChange={(v) => setFilters({ ...filters, tl: v })}
                        className="w-full"
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
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                <section className="lg:col-span-5 panel overflow-hidden" aria-label="Summary">
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 [&>*]:border-line-2 [&>*]:border-b xl:[&>*]:border-b-0 xl:divide-x divide-line-2">
                    {[
                      { label: "Total leads", value: grandTotal },
                      { label: "Converted", value: report?.sidebarStats?.converted ?? 0, sub: grandTotal ? `${(((report?.sidebarStats?.converted ?? 0) / grandTotal) * 100).toFixed(1)}% of leads` : null, tone: (report?.sidebarStats?.converted ?? 0) > 0 ? "met" : null },
                      { label: "Never called", value: report?.sidebarStats?.uncontacted ?? 0, sub: "Zero call attempts", tone: (report?.sidebarStats?.uncontacted ?? 0) > 0 ? "behind" : null },
                      { label: "Not connected", value: report?.sidebarStats?.notConnected ?? 0, sub: "Called, never reached" },
                      { label: "Follow-ups due", value: report?.sidebarStats?.followUpsDue ?? 0, sub: "Waiting on a call back" },
                      { label: "Sources", value: report?.sidebarStats?.uniqueSources ?? 0, sub: "Distinct lead sources" },
                    ].map((s) => (
                      <div key={s.label} className="px-5 py-4 min-w-0">
                        <p className="stat-label truncate">{s.label}</p>
                        {loading ? <Skeleton className="h-7 w-20 mt-2" /> : (
                          <p className={`stat-number mt-1 ${s.tone === "met" ? "text-met" : s.tone === "behind" ? "text-behind" : ""}`}>{Number(s.value).toLocaleString("en-IN")}</p>
                        )}
                        {s.sub && <p className="text-xs text-ink-3 mt-1 truncate">{s.sub}</p>}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="lg:col-span-5 panel" aria-label="By status">
                  <div className="panel-head">
                    <div>
                      <h3 className="panel-title">By status</h3>
                      <p className="panel-sub">Talk-time stages first, then outcomes set by a person</p>
                    </div>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th className="w-[40%] hidden md:table-cell">Share</th>
                        <th className="!text-right">Leads</th>
                        <th className="!text-right">Avg attempts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {STATUS_KEYS.map((k) => {
                        const n = report?.summary?.[k]?.leads ?? 0;
                        const pct = grandTotal ? (n / grandTotal) * 100 : 0;
                        return (
                          <tr key={k}>
                            <td><StatusBadge status={k} /></td>
                            <td className="hidden md:table-cell">
                              <div className="flex items-center gap-3">
                                <span className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <span className="block h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: n ? `${Math.max(1, pct)}%` : 0, background: STATUS_META[k].color }} />
                                </span>
                                <span className="w-12 text-right text-xs text-ink-3 tabular-nums">{pct < 1 && n ? "<1" : Math.round(pct)}%</span>
                              </div>
                            </td>
                            <td className="text-right font-medium text-ink tabular-nums">{loading ? <Skeleton className="h-3.5 w-12 ml-auto" /> : n.toLocaleString("en-IN")}</td>
                            <td className="text-right tabular-nums">{report?.summary?.[k]?.avgAttempts ?? "—"}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50">
                        <td className="font-semibold text-ink">Total</td>
                        <td className="hidden md:table-cell" />
                        <td className="text-right font-semibold text-ink tabular-nums">{grandTotal.toLocaleString("en-IN")}</td>
                        <td className="text-right font-semibold text-ink tabular-nums">{report?.summary?.total?.avgAttempts ?? 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <div className="lg:col-span-5 panel p-4">
                  <h3 className="panel-title px-1">By employee</h3>
                  <p className="panel-sub px-1 mb-3">Per-employee lead performance</p>
                  <DataTable
                    loading={loading}
                    footer={employeeSummaryFooter}
                    columns={[
                      { key: "employeeName", label: "Employee", width: 150, render: (r) => <Truncate text={r.employeeName} /> },
                      { key: "tlName", label: "TL", width: 100, render: (r) => r.tlName ? <Truncate text={r.tlName} max={14} /> : <span className="text-gray-300">—</span> },
                      {
                        key: "total",
                        label: "Total",
                        align: "right",
                        width: 70,
                      },
                      {
                        key: "new",
                        label: "New",
                        align: "right",
                        searchable: false,
                        width: 70,
                      },
                      {
                        key: "contacted",
                        label: "Contacted",
                        align: "right",
                        searchable: false,
                        width: 90,
                      },
                      {
                        key: "follow_up",
                        label: "Follow-up",
                        align: "right",
                        searchable: false,
                        width: 90,
                      },
                      {
                        key: "converted",
                        label: "Converted",
                        align: "right",
                        searchable: false,
                        width: 100,
                        render: (r) => (
                          <span className="text-emerald-600 font-semibold">
                            {r.converted}
                          </span>
                        ),
                      },
                      {
                        key: "lost",
                        label: "Lost",
                        align: "right",
                        searchable: false,
                        width: 70,
                        render: (r) => (
                          <span className="text-red-600">{r.lost}</span>
                        ),
                      },
                      {
                        key: "conversionRate",
                        label: "Conv. Rate",
                        align: "right",
                        searchable: false,
                        width: 100,
                        render: (r) => `${r.conversionRate}%`,
                      },
                      {
                        key: "avgAttempts",
                        label: "Avg Attempts",
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
                        Leads vs. Contacted — Hourly
                      </h3>
                      <p className="text-xs text-gray-500">
                        Bars = leads created · Line = leads contacted (attempts
                        &gt; 0)
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
                          dataKey="total"
                          name="Leads Created"
                          fill="url(#barGrad)"
                          radius={[4, 4, 0, 0]}
                          barSize={22}
                        />
                        {chartMode === "composed" && (
                          <Line
                            type="monotone"
                            dataKey="contacted"
                            name="Contacted"
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
                        label: "Top Assignee (Volume)",
                        value: report?.topAssignee?.employeeName || "—",
                        sub: report?.topAssignee
                          ? `${report.topAssignee.count} leads assigned`
                          : "",
                      },
                      {
                        label: "Top Converter",
                        value: report?.topConverter?.employeeName || "—",
                        sub: report?.topConverter
                          ? `${report.topConverter.count} converted`
                          : "",
                      },
                      {
                        label: "Top Overall Activity",
                        value: report?.topOverall?.employeeName || "—",
                        sub: report?.topOverall
                          ? `${report.topOverall.count} total call attempts`
                          : "",
                      },
                    ]}
                  />
                  <InsightCard
                    icon={<StopwatchIco />}
                    title="Follow-up Analysis"
                    rows={[
                      {
                        label: "Highest Total Attempts",
                        value: report?.mostAttempts?.employeeName || "—",
                        sub: report?.mostAttempts
                          ? `${report.mostAttempts.count} attempts`
                          : "",
                      },
                      {
                        label: "Most Attempts on a Single Lead",
                        value: report?.mostAttemptedLead
                          ? `${report.mostAttemptedLead.name} (${report.mostAttemptedLead.attempts}×)`
                          : "—",
                        sub: report?.mostAttemptedLead
                          ? `${report.mostAttemptedLead.phone} · currently ${STATUS_META[report.mostAttemptedLead.status]?.label || report.mostAttemptedLead.status}`
                          : "",
                      },
                    ]}
                  />
                  <InsightCard
                    icon={<GaugeIco />}
                    title="Conversion Analysis"
                    rows={[
                      {
                        label: "Conversion Rate",
                        value: `${report?.conversionRate ?? 0}%`,
                      },
                      {
                        label: "Avg Attempts per Lead",
                        value: report?.avgAttemptsPerLead ?? 0,
                      },
                      {
                        label: "Avg Attempts per Converted Lead",
                        value: report?.avgAttemptsPerConverted ?? 0,
                      },
                      {
                        label: "Leads per Day",
                        value: report?.avgLeadsPerDay ?? 0,
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
                  Daily lead volume within the selected date range
                </p>

                <DataTable
                  loading={loading}
                  searchable={false}
                  columns={[
                    { key: "label", label: "Day", width: 200 },
                    {
                      key: "total",
                      label: "Total Leads",
                      align: "right",
                      width: 120,
                    },
                    {
                      key: "converted",
                      label: "Converted",
                      align: "right",
                      width: 120,
                      render: (r) => (
                        <span className="text-emerald-600 font-semibold">
                          {r.converted}
                        </span>
                      ),
                    },
                    {
                      key: "conversionRate",
                      label: "Conv. Rate",
                      align: "right",
                      searchable: false,
                      width: 120,
                      render: (r) => `${r.conversionRate}%`,
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
                            total: r.total,
                            converted: r.converted,
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
                            name="Total Leads"
                            fill="#7C3AED"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="converted"
                            name="Converted"
                            fill="#079455"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      ) : (
                        <ComposedChart
                          data={[...dayWiseRows].reverse().map((r) => ({
                            day: r.label.split(",")[0],
                            total: r.total,
                            converted: r.converted,
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
                            name="Total Leads"
                            stroke="#7C3AED"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="converted"
                            name="Converted"
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
                  Share of total lead volume by hour created (IST)
                </p>
                <DataTable
                  loading={loading}
                  searchable={false}
                  columns={[
                    { key: "label", label: "Time Slot", width: 160 },
                    {
                      key: "total",
                      label: "Total Leads",
                      align: "right",
                      width: 110,
                    },
                    {
                      key: "contacted",
                      label: "Contacted",
                      align: "right",
                      width: 110,
                    },
                    {
                      key: "converted",
                      label: "Converted",
                      align: "right",
                      width: 110,
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

            {/* ═══════════════ UNCONTACTED ═══════════════ */}
            {activeTab === "uncontacted" && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                  Uncontacted Leads{" "}
                  <InfoDot text="Leads with zero call attempts logged so far." />
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Leads that have never been called
                </p>
                <DataTable
                  loading={loading}
                  showRowNumber
                  emptyTitle="Everyone's been contacted"
                  capNotice={
                    report?.total > uncontactedRows.length
                      ? `Showing ${uncontactedRows.length.toLocaleString()} of ${report.total.toLocaleString()} — narrow the date range or filters to see the rest.`
                      : null
                  }
                  columns={[
                    {
                      key: "name",
                      label: "Contact",
                      width: 220,
                      render: (r) => (
                        <div>
                          <p className="font-medium text-gray-900 truncate">
                            {r.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {r.phone}
                          </p>
                        </div>
                      ),
                    },
                    { key: "source", label: "Source", width: 140 },
                    { key: "employeeName", label: "Assigned To", width: 150 },
                    {
                      key: "createdAt",
                      label: "Created At",
                      searchable: false,
                      width: 130,
                      render: (r) => fmtDate(r.createdAt),
                    },
                    {
                      key: "daysSince",
                      label: "Days Since Created",
                      align: "right",
                      searchable: false,
                      width: 150,
                      render: (r) => (
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold">
                          {r.daysSince}d
                        </span>
                      ),
                    },
                  ]}
                  rows={uncontactedRows}
                />
              </div>
            )}

            {/* ═══════════════ NOT CONNECTED ═══════════════ */}
            {activeTab === "notConnected" && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                  Not Connected Leads{" "}
                  <InfoDot text="Leads currently marked as not connected after being called." />
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Attempted but never connected
                </p>
                <DataTable
                  loading={loading}
                  showRowNumber
                  capNotice={
                    report?.total > notConnectedRows.length
                      ? `Showing ${notConnectedRows.length.toLocaleString()} of ${report.total.toLocaleString()} — narrow the date range or filters to see the rest.`
                      : null
                  }
                  columns={[
                    { key: "employeeName", label: "Employee", width: 150 },
                    {
                      key: "name",
                      label: "Contact",
                      width: 220,
                      render: (r) => (
                        <div>
                          <p className="font-medium text-gray-900 truncate">
                            {r.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {r.phone}
                          </p>
                        </div>
                      ),
                    },
                    {
                      key: "status",
                      label: "Status",
                      width: 140,
                      searchable: false,
                      render: (r) => <StatusBadge status={r.status} />,
                    },
                    {
                      key: "attempts",
                      label: "Attempts",
                      align: "right",
                      searchable: false,
                      width: 100,
                    },
                    {
                      key: "lastCallAt",
                      label: "Last Call At",
                      searchable: false,
                      width: 170,
                      render: (r) =>
                        r.lastCallAt ? fmtDateTime(r.lastCallAt) : "—",
                    },
                  ]}
                  rows={notConnectedRows}
                />
              </div>
            )}

            {/* ═══════════════ LEAD SOURCES ═══════════════ */}
            {activeTab === "sources" && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center">
                  Lead Sources{" "}
                  <InfoDot text="Every lead source, grouped, with conversion performance." />
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Where leads are coming from, and how well each source converts
                </p>
                <DataTable
                  loading={loading}
                  columns={[
                    { key: "source", label: "Source", width: 200 },
                    {
                      key: "total",
                      label: "Total Leads",
                      align: "right",
                      width: 130,
                    },
                    {
                      key: "converted",
                      label: "Converted",
                      align: "right",
                      searchable: false,
                      width: 120,
                      render: (r) => (
                        <span className="text-emerald-600 font-semibold">
                          {r.converted}
                        </span>
                      ),
                    },
                    {
                      key: "lost",
                      label: "Lost",
                      align: "right",
                      searchable: false,
                      width: 100,
                      render: (r) => (
                        <span className="text-red-600">{r.lost}</span>
                      ),
                    },
                    {
                      key: "conversionRate",
                      label: "Conv. Rate",
                      align: "right",
                      searchable: false,
                      width: 160,
                      render: (r) => (
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${Math.min(r.conversionRate, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">
                            {r.conversionRate}%
                          </span>
                        </div>
                      ),
                    },
                  ]}
                  rows={sourceRows}
                />
              </div>
            )}

            {/* ═══════════════ LEAD LIST ═══════════════ */}
            {activeTab === "leadList" && (
              <div className="bg-white rounded-xl border border-gray-200">
                <DataTable
                  loading={loading}
                  showRowNumber
                  capNotice={
                    report?.total > leadListRows.length
                      ? `Showing ${leadListRows.length.toLocaleString()} of ${report.total.toLocaleString()} — narrow the date range or filters to see the rest.`
                      : null
                  }
                  columns={[
                    {
                      key: "employeeName", label: "Assigned To", width: 140,
                      render: (r) => (
                        <div>
                          <p><Truncate text={r.employeeName} /></p>
                          {r.tlName && <p className="text-xs text-gray-500">TL: <Truncate text={r.tlName} max={14} /></p>}
                        </div>
                      ),
                    },
                    {
                      key: "phone",
                      label: "Contact Number",
                      width: 160,
                      render: (r) => (
                        <PinnedNumber
                          number={r.phone}
                          pinned={!!pinned[r.phone]}
                          onToggle={() => togglePin(r.phone)}
                        />
                      ),
                    },
                    { key: "name", label: "Contact Name", width: 150, render: (r) => <Truncate text={r.name} /> },
                    {
                      key: "status",
                      label: "Status",
                      width: 140,
                      filterType: "select",
                      filterPlaceholder: "Select",
                      filterOptions: STATUS_KEYS.map((k) => ({
                        value: k,
                        label: STATUS_META[k].label,
                      })),
                      render: (r) => <StatusBadge status={r.status} />,
                    },
                    { key: "source", label: "Source", width: 130 },
                    {
                      key: "attempts",
                      label: "Attempts",
                      align: "right",
                      searchable: false,
                      width: 100,
                    },
                    {
                      key: "followUpDate",
                      label: "Follow-up Date",
                      searchable: false,
                      width: 140,
                      render: (r) =>
                        r.followUpDate ? fmtDate(r.followUpDate) : "—",
                    },
                    {
                      key: "createdAt",
                      label: "Created At",
                      width: 130,
                      filterType: "date",
                      filterValue: (r) => r.createdAt,
                      render: (r) => fmtDate(r.createdAt),
                    },
                    {
                      key: "notes",
                      label: "Notes",
                      width: 160,
                      render: (r) => (
                        <EditableCell
                          initial={r.lastCallNote}
                          placeholder="Add note"
                          onSave={(val) => saveNote(r._id, val)}
                        />
                      ),
                    },
                  ]}
                  rows={leadListRows}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
