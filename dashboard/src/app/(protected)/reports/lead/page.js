"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
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
const STATUS_META = {
  new: { label: "New", color: "#2563EB", bg: "#EFF6FF" },
  contacted: { label: "Contacted", color: "#0891B2", bg: "#ECFEFF" },
  not_connected: { label: "Not Connected", color: "#DC2626", bg: "#FEF2F2" },
  interested: { label: "Interested", color: "#0D9488", bg: "#F0FDFA" },
  not_interested: { label: "Not Interested", color: "#94A3B8", bg: "#F8FAFC" },
  follow_up: { label: "Follow-up", color: "#D97706", bg: "#FFFBEB" },
  booking_done: { label: "Booking Done", color: "#7C3AED", bg: "#F5F3FF" },
  converted: { label: "Converted", color: "#16A34A", bg: "#F0FDF4" },
  lost: { label: "Lost", color: "#B91C1C", bg: "#FEF2F2" },
};
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
  const m = STATUS_META[status] || STATUS_META.new;
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

/* Pin toggle used in Lead List "Contact Number" column — persisted in localStorage
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
   GENERIC DATA TABLE — search per column, sort, pagination
──────────────────────────────────────────────────────────── */

// Ryan Clinic brand tokens — reuse these across the dashboard for consistency
const BRAND = {
  red: "#D32F2F",
  redSoft: "#FEECEC",
  amber: "#FFC107",
  amberSoft: "#FFF8E1",
  purple: "#302658",
  cream: "#FFF5EC",
};

// Builds a windowed page list with ellipses: 1 … 4 5 [6] 7 8 … 20
function getPageList(current, total) {
  const delta = 1;
  const pages = [];
  for (let i = 1; i <= total; i++) {
    if (
      i === 1 ||
      i === total ||
      (i >= current - delta && i <= current + delta)
    ) {
      pages.push(i);
    }
  }
  const withDots = [];
  let prev = 0;
  for (const p of pages) {
    if (prev && p - prev === 2) withDots.push(prev + 1);
    else if (prev && p - prev > 2) withDots.push("…");
    withDots.push(p);
    prev = p;
  }
  return withDots;
}

export function DataTable({
  columns,
  rows,
  loading = false,
  pageSize = 10,
  searchable = true,
  emptyTitle = "No results found",
  emptyDescription = "Try adjusting your filters or search terms.",
  footer,
  capNotice,
  maxBodyHeight, // e.g. 480 — enables a scrolling body with a sticky header
  showRowNumber = false, // adds a leading "Sr. No." column
  getRowId = (row, i) => row.id ?? row._id ?? i,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [colSearch, setColSearch] = useState({});
  const [page, setPage] = useState(1);
  const [rpp, setRpp] = useState(pageSize);
  const [scrolled, setScrolled] = useState(false);

  // Sr. No. is a synthetic, non-filterable, non-sortable column prepended to whatever was passed in.
  const displayColumns = useMemo(
    () =>
      showRowNumber
        ? [
            {
              key: "__srNo",
              label: "Sr. No.",
              width: 72,
              sortable: false,
              searchable: false,
            },
            ...columns,
          ]
        : columns,
    [columns, showRowNumber],
  );

  const activeFilterCount = Object.values(colSearch).filter(Boolean).length;

  // Filtering runs against the column's own filterValue (defaults to row[key]) so it stays
  // correct even when the cell's on-screen render() shows something else (badges, pins, etc).
  const matchesFilter = (row, col, val) => {
    const raw = col.filterValue ? col.filterValue(row) : row[col.key];
    if (col.filterType === "select") {
      return String(raw ?? "") === val;
    }
    if (col.filterType === "date") {
      if (!raw) return false;
      const d = new Date(raw);
      const sel = new Date(val);
      if (isNaN(d.getTime()) || isNaN(sel.getTime())) return false;
      return (
        d.getFullYear() === sel.getFullYear() &&
        d.getMonth() === sel.getMonth() &&
        d.getDate() === sel.getDate()
      );
    }
    return String(raw ?? "")
      .toLowerCase()
      .includes(String(val).toLowerCase());
  };

  const filtered = useMemo(() => {
    let r = rows;
    displayColumns.forEach((c) => {
      const val = colSearch[c.key];
      if (!val) return;
      r = r.filter((row) => matchesFilter(row, c, val));
    });
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av ?? "").localeCompare(String(bv ?? ""));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, colSearch, sortKey, sortDir, displayColumns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rpp));
  const pageRows = filtered.slice((page - 1) * rpp, page * rpp);

  useEffect(() => setPage(1), [colSearch, rpp, rows]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const clearFilters = () => setColSearch({});

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {capNotice && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 border-b text-xs"
          style={{
            background: BRAND.amberSoft,
            borderColor: "#FDE7A8",
            color: "#8A6D00",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: BRAND.amber }}
          />
          {capNotice}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: BRAND.purple }}
          >
            {filtered.length.toLocaleString()}{" "}
            {filtered.length === 1 ? "record" : "records"}
          </span>
          <AnimatePresence>
            {activeFilterCount > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear filters
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          Rows
          <select
            value={rpp}
            onChange={(e) => setRpp(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gray-400 bg-white"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Table */}
      <div
        className="overflow-auto"
        style={maxBodyHeight ? { maxHeight: maxBodyHeight } : undefined}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
      >
        <table
          className="w-full text-sm"
          style={{ minWidth: 640, tableLayout: "fixed" }}
        >
          <colgroup>
            {displayColumns.map((c) => (
              <col
                key={c.key}
                style={{
                  width: c.width ? c.width : `${100 / displayColumns.length}%`,
                }}
              />
            ))}
          </colgroup>
          <thead
            className="sticky top-0 z-10 transition-shadow"
            style={{
              background: "#FAFAFA",
              boxShadow: scrolled ? "0 1px 0 0 rgba(0,0,0,0.06)" : "none",
            }}
          >
            <tr>
              {displayColumns.map((c) => {
                const isSorted = sortKey === c.key;
                const sortable = c.sortable !== false;
                return (
                  <th
                    key={c.key}
                    aria-sort={
                      isSorted
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis ${
                      c.align === "right" ? "text-right" : "text-left"
                    }`}
                    style={{ color: isSorted ? BRAND.purple : "#6B7280" }}
                  >
                    <button
                      onClick={() => sortable && toggleSort(c.key)}
                      disabled={!sortable}
                      className={`group inline-flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 ${
                        sortable ? "cursor-pointer" : "cursor-default"
                      }`}
                      style={{ "--tw-ring-color": BRAND.red }}
                    >
                      {c.label}
                      {sortable && (
                        <span className="inline-flex">
                          {isSorted ? (
                            sortDir === "asc" ? (
                              <ArrowUp
                                className="w-3.5 h-3.5"
                                style={{ color: BRAND.red }}
                              />
                            ) : (
                              <ArrowDown
                                className="w-3.5 h-3.5"
                                style={{ color: BRAND.red }}
                              />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400 transition-colors" />
                          )}
                        </span>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>

            {/* Per-column filter row — always visible, directly under the headers */}
            {searchable && (
              <tr className="bg-white">
                {displayColumns.map((c) => (
                  <th
                    key={c.key}
                    className="px-4 py-2 border-t border-gray-100 font-normal align-top"
                  >
                    {c.searchable === false ? null : c.filterType ===
                      "select" ? (
                      <select
                        value={colSearch[c.key] || ""}
                        onChange={(e) =>
                          setColSearch((s) => ({
                            ...s,
                            [c.key]: e.target.value,
                          }))
                        }
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 outline-none bg-white focus:border-gray-400 transition-colors"
                      >
                        <option value="">
                          {c.filterPlaceholder || "Select"}
                        </option>
                        {(c.filterOptions || []).map((opt) => {
                          const value =
                            typeof opt === "string" ? opt : opt.value;
                          const label =
                            typeof opt === "string" ? opt : opt.label;
                          return (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    ) : c.filterType === "date" ? (
                      <div className="relative">
                        <input
                          type="date"
                          value={colSearch[c.key] || ""}
                          onChange={(e) =>
                            setColSearch((s) => ({
                              ...s,
                              [c.key]: e.target.value,
                            }))
                          }
                          className="w-full pl-2 pr-2 py-1.5 text-xs rounded-lg border border-gray-200 outline-none bg-white focus:border-gray-400 transition-colors"
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          placeholder="Search"
                          value={colSearch[c.key] || ""}
                          onChange={(e) =>
                            setColSearch((s) => ({
                              ...s,
                              [c.key]: e.target.value,
                            }))
                          }
                          className="w-full pl-3 pr-8 py-1.5 text-xs rounded-lg border border-gray-200 outline-none bg-white focus:border-gray-400 transition-colors"
                        />
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            )}
          </thead>

          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: Math.min(rpp, 8) }).map((_, i) => (
                <tr key={i}>
                  {displayColumns.map((c, j) => (
                    <td key={j} className="px-4 py-3 overflow-hidden">
                      <Skeleton className="h-4 w-24 max-w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={displayColumns.length} className="py-14">
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center mb-1"
                      style={{ background: BRAND.cream }}
                    >
                      <Inbox
                        className="w-5 h-5"
                        style={{ color: BRAND.purple }}
                      />
                    </div>
                    <p className="text-sm font-medium text-gray-700">
                      {emptyTitle}
                    </p>
                    <p className="text-xs text-gray-400 max-w-xs">
                      {emptyDescription}
                    </p>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearFilters}
                        className="mt-1 text-xs font-medium px-3 py-1.5 rounded-lg text-white"
                        style={{ background: BRAND.red }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <motion.tr
                  key={getRowId(row, i)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.015, 0.15) }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {displayColumns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3 overflow-hidden ${
                        c.align === "right"
                          ? "text-right tabular-nums"
                          : "text-left"
                      } ${c.render ? "" : "whitespace-nowrap"}`}
                    >
                      {c.key === "__srNo" ? (
                        <span className="text-gray-500">
                          {(page - 1) * rpp + i + 1}
                        </span>
                      ) : c.render ? (
                        c.render(row)
                      ) : (
                        <span
                          className="block truncate"
                          title={
                            row[c.key] != null ? String(row[c.key]) : undefined
                          }
                        >
                          {row[c.key]}
                        </span>
                      )}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>

          {footer && !loading && pageRows.length > 0 && (
            <tfoot>
              <tr
                className="border-t-2 border-gray-100 font-semibold"
                style={{ background: BRAND.cream }}
              >
                {displayColumns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-2.5 overflow-hidden whitespace-nowrap ${
                      c.align === "right"
                        ? "text-right tabular-nums"
                        : "text-left"
                    }`}
                    style={{ color: BRAND.purple }}
                  >
                    <span className="block truncate">
                      {footer[c.key] !== undefined ? footer[c.key] : ""}
                    </span>
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            Showing {(page - 1) * rpp + 1}
            {"–"}
            {Math.min(page * rpp, filtered.length)} of{" "}
            {filtered.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(1)}
              className="p-1.5 rounded-md border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
              aria-label="First page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded-md border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {getPageList(page, totalPages).map((p, idx) =>
              p === "…" ? (
                <span
                  key={`dots-${idx}`}
                  className="px-1.5 text-xs text-gray-300"
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="min-w-[28px] h-7 px-1.5 rounded-md text-xs font-medium transition-colors"
                  style={
                    p === page
                      ? { background: BRAND.red, color: "#fff" }
                      : { color: "#4B5563" }
                  }
                >
                  {p}
                </button>
              ),
            )}

            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-md border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(totalPages)}
              className="p-1.5 rounded-md border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
              aria-label="Last page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
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
  status: "Status",
  source: "Source",
  leadTime: "Lead Time",
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
          {FILTER_LABELS[k] || k}:{" "}
          {k === "employee"
            ? employeeName || v
            : k === "status"
              ? STATUS_META[v]?.label || v
              : v}
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
const PINNED_STORAGE_KEY = "lr_pinned_numbers";

export default function LeadReportsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState("summary");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [chartMode, setChartMode] = useState("composed");
  const [report, setReport] = useState(null);
  const [pinned, setPinned] = useState({});

  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    employee: "",
    status: "",
    source: "",
    leadTime: "",
  });

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
      ...(filters.status && { status: filters.status }),
      ...(filters.source && { source: filters.source }),
      ...(filters.leadTime && { leadTime: filters.leadTime }),
    }),
    [filters],
  );

  const load = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      try {
        const res = await api.get("/api/reports/leads-periodic", {
          params: { ...buildParams(), tab: activeTab, limit: 500 },
        });
        setReport(res.data?.data || null);
      } catch {
        setReport(null);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [buildParams, activeTab],
  );

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    api
      .get("/api/employees")
      .then((r) => setEmployees(r.data.data || []))
      .catch(() => {});
  }, []);

  const saveNote = async (leadId, text) => {
    try {
      await api.post(`/api/leads/${leadId}/note`, { text });
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
      },
      filename: `leads-${filters.fromDate || "all"}_${filters.toDate || "today"}.csv`,
    });

  const employeeName = employees.find((e) => e._id === filters.employee)?.name;
  const clearFilter = (key) => setFilters((f) => ({ ...f, [key]: "" }));
  const clearAllFilters = () =>
    setFilters({
      fromDate: "",
      toDate: "",
      employee: "",
      status: "",
      source: "",
      leadTime: "",
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
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              Reports <span className="text-gray-300">/</span>{" "}
              <span className="text-gray-500">Lead Reports</span>
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">
              {report?.dateLabel || "Lead Reports"}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                    <Field label="Status">
                      <select
                        className="input"
                        value={filters.status}
                        onChange={(e) =>
                          setFilters({ ...filters, status: e.target.value })
                        }
                      >
                        <option value="">All statuses</option>
                        {STATUS_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {STATUS_META[k].label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Source">
                      <input
                        type="text"
                        placeholder="e.g. Facebook, Walk-in"
                        className="input"
                        value={filters.source}
                        onChange={(e) =>
                          setFilters({ ...filters, source: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Lead Time">
                      <select
                        className="input"
                        value={filters.leadTime}
                        onChange={(e) =>
                          setFilters({ ...filters, leadTime: e.target.value })
                        }
                      >
                        <option value="">Any time</option>
                        <option value="morning">Morning (6AM–12PM)</option>
                        <option value="afternoon">Afternoon (12PM–6PM)</option>
                        <option value="evening">Evening (6PM–12AM)</option>
                      </select>
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
                    label="Total Leads"
                    value={grandTotal.toLocaleString()}
                    color="#2563EB"
                    icon={<UsersIco />}
                  />
                  <StatCard
                    label="Converted Leads"
                    value={(
                      report?.sidebarStats?.converted ?? 0
                    ).toLocaleString()}
                    color="#16A34A"
                    icon={<CheckIco />}
                  />
                  <StatCard
                    label="Unique Sources"
                    value={(
                      report?.sidebarStats?.uniqueSources ?? 0
                    ).toLocaleString()}
                    color="#7C3AED"
                    icon={<TagIco />}
                  />
                  <StatCard
                    label="Follow-ups Due"
                    value={(
                      report?.sidebarStats?.followUpsDue ?? 0
                    ).toLocaleString()}
                    color="#D97706"
                    icon={<ClockIco />}
                  />
                </div>

                <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-1">
                    Leads
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Overall split by status
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
                        <p className="text-xs text-gray-400">Leads</p>
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
                    Lead Status Breakdown
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2  gap-20">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase">
                          <th className="text-left pb-2 px-4">Status</th>
                          <th className="text-right pb-2 px-4">Leads</th>
                          <th className="text-right pb-2 px-4">Avg Attempts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black ">
                        {STATUS_KEYS.map((k) => (
                          <tr key={k}>
                            <td className="py-2.5 px-4">
                              <StatusBadge status={k} />
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-gray-900">
                              {(
                                report?.summary?.[k]?.leads ?? 0
                              ).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right text-gray-500">
                              {report?.summary?.[k]?.avgAttempts ?? "—"}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-gray-100">
                          <td className="py-2.5 px-4 font-bold text-gray-900">
                            Total
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-gray-900">
                            {grandTotal.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-gray-900">
                            {report?.summary?.total?.avgAttempts ?? 0}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="grid grid-cols-2 md:grid-cols-2 gap-3 border-t border-gray-100">
                      {[
                        {
                          label: "Uncontacted",
                          value: report?.sidebarStats?.uncontacted ?? 0,
                          color: "#DC2626",
                        },
                        {
                          label: "Not Connected",
                          value: report?.sidebarStats?.notConnected ?? 0,
                          color: "#EA580C",
                        },
                        {
                          label: "Contacted",
                          value: report?.sidebarStats?.contacted ?? 0,
                          color: "#16A34A",
                        },
                        {
                          label: "Converted",
                          value: report?.sidebarStats?.converted ?? 0,
                          color: "#0891B2",
                        },
                        {
                          label: "Unique Sources",
                          value: report?.sidebarStats?.uniqueSources ?? 0,
                          color: "#7C3AED",
                        },
                        {
                          label: "Follow-ups Due",
                          value: report?.sidebarStats?.followUpsDue ?? 0,
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
                    Per-employee lead performance
                  </p>
                  <DataTable
                    loading={loading}
                    footer={employeeSummaryFooter}
                    columns={[
                      { key: "employeeName", label: "Employee", width: 160 },
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
                      <p className="text-xs text-gray-400">
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
                <p className="text-xs text-gray-400 mb-4">
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
                            name="Total Leads"
                            fill="#2563EB"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="converted"
                            name="Converted"
                            fill="#16A34A"
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
                            name="Total Leads"
                            stroke="#2563EB"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="converted"
                            name="Converted"
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
                <p className="text-xs text-gray-400 mb-4">
                  Leads that have never been called
                </p>
                <DataTable
                  loading={loading}
                  showRowNumber
                  emptyTitle="Everyone's been contacted 🎉"
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
                          <p className="text-xs text-gray-400 truncate">
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
                <p className="text-xs text-gray-400 mb-4">
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
                          <p className="text-xs text-gray-400 truncate">
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
                <p className="text-xs text-gray-400 mb-4">
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
                    { key: "employeeName", label: "Assigned To", width: 140 },
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
                    { key: "name", label: "Contact Name", width: 160 },
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
