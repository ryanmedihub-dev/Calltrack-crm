'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../../../lib/api';
import { STATUSES, statusStyle, statusLabel } from '../../../../lib/leadStatus';
import { PageHeader, fmtNum, Skeleton } from '../../../../components/report-shared';
import DateRangeFilter, { formatRangeLabel, rangeToDates } from '../../../../components/DateRangeFilter';

// The first nine statuses are talk-time bands set automatically by calls; the rest are set by a person.
const BANDS = STATUSES.slice(0, 9);
const OUTCOMES = STATUSES.slice(9);
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

const DESTINATIONS = [
  { href: '/leads/pipeline', label: 'Pipeline', desc: 'Board view of leads by status' },
  { href: '/leads/follow-ups', label: 'Follow-ups', desc: 'Leads waiting on a call back' },
  { href: '/leads/assingned-leads', label: 'Assigned leads', desc: 'Who owns which lead; reassign' },
  { href: '/leads/leads-logs', label: 'Activity log', desc: 'Every status change and note' },
  { href: '/leads/leads-uploads', label: 'Import leads', desc: 'Bulk upload from CSV or Excel' },
  { href: '/reports/lead', label: 'Leads report', desc: 'Status-wise report and export' },
];

function StatusRows({ keys, counts, total, fromDate, toDate, loading }) {
  const max = Math.max(1, ...keys.map((k) => counts[k] || 0));
  return (
    <ul className="px-3 py-2">
      {keys.map((k) => {
        const n = counts[k] || 0;
        const st = statusStyle(k);
        return (
          <li key={k}>
            <Link href={`/reports/lead?status=${k}&fromDate=${fromDate}&toDate=${toDate}`}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_72px_44px] items-center gap-4 h-10 px-2 rounded-lg hover:bg-gray-50 transition-colors duration-150">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                <span className="text-[13px] text-ink-2 truncate">{statusLabel(k)}</span>
              </span>
              <span className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <span className="block h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: n ? `${Math.max(1.5, (n / max) * 100)}%` : 0, background: st.hex }} />
              </span>
              <span className="text-right text-[13px] font-medium text-ink tabular-nums">{loading ? <Skeleton className="h-3 w-12 ml-auto" /> : fmtNum(n)}</span>
              <span className="text-right text-xs text-ink-3 tabular-nums">{loading ? '' : `${pct(n, total)}%`}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function LeadsOverviewPage() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ range: 'all', startDate: null, endDate: null });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const params = { limit: 1 };
      if (dateRange.range && dateRange.range !== 'all') {
        params.range = dateRange.range;
        if (dateRange.range === 'custom') { params.startDate = dateRange.startDate; params.endDate = dateRange.endDate; }
      }
      try {
        const results = await Promise.all(
          STATUSES.map((s) =>
            api.get('/api/leads', { params: { ...params, status: s } })
              .then((r) => ({ key: s, count: r.data?.data?.total || 0 }))
              .catch(() => ({ key: s, count: 0 })),
          ),
        );
        const map = {};
        results.forEach((r) => { map[r.key] = r.count; });
        setCounts(map);
      } catch {}
      setLoading(false);
    })();
  }, [dateRange]);

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const worked = BANDS.slice(2).reduce((s, k) => s + (counts[k] || 0), 0); // reached at least 'low' talk time
  const rangeLabel = formatRangeLabel(dateRange);
  const { fromDate, toDate } = rangeToDates(dateRange);
  const bandTotal = BANDS.reduce((s, k) => s + (counts[k] || 0), 0);
  const outcomeTotal = OUTCOMES.reduce((s, k) => s + (counts[k] || 0), 0);

  const scores = [
    { label: 'Total leads', value: fmtNum(total), sub: rangeLabel },
    { label: 'Untouched', value: fmtNum(counts.new || 0), sub: `${pct(counts.new, total)}% still new` },
    { label: 'Had a real conversation', value: fmtNum(worked), sub: `${pct(worked, total)}% of leads` },
    { label: 'Waiting on follow-up', value: fmtNum(counts.follow_up || 0), sub: 'Need a call back', tone: counts.follow_up ? 'warn' : null },
    { label: 'Booked', value: fmtNum(counts.booking_done || 0), sub: `${pct(counts.booking_done, total)}% of leads` },
    { label: 'Converted', value: fmtNum(counts.converted || 0), sub: `${(total ? ((counts.converted || 0) / total) * 100 : 0).toFixed(1)}% conversion`, tone: counts.converted ? 'met' : null },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads overview"
        description={`Where every lead stands · ${rangeLabel}`}
        actions={<><DateRangeFilter value={dateRange} onChange={setDateRange} includeAll /><Link href="/leads/leads-uploads" className="btn-primary">Import leads</Link></>}
      />

      <section className="panel overflow-hidden" aria-label="Summary">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 [&>*]:border-line-2 [&>*]:border-b xl:[&>*]:border-b-0 xl:divide-x divide-line-2">
          {scores.map((s) => (
            <div key={s.label} className="px-5 py-4 min-w-0">
              <p className="stat-label truncate">{s.label}</p>
              {loading ? <Skeleton className="h-7 w-20 mt-2" /> : (
                <p className={`stat-number mt-1 ${s.tone === 'met' ? 'text-met' : s.tone === 'warn' ? 'text-[var(--warn)]' : ''}`}>{s.value}</p>
              )}
              <p className="text-xs text-ink-3 mt-1 truncate">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="panel" aria-label="Talk-time stages">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Talk-time stages</h2>
              <p className="panel-sub">Set automatically from each lead’s best call · {fmtNum(bandTotal)} leads</p>
            </div>
          </div>
          <StatusRows keys={BANDS} counts={counts} total={total} fromDate={fromDate} toDate={toDate} loading={loading} />
        </section>

        <section className="panel" aria-label="Outcomes">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Outcomes</h2>
              <p className="panel-sub">Set by an agent or manager · {fmtNum(outcomeTotal)} leads</p>
            </div>
          </div>
          <StatusRows keys={OUTCOMES} counts={counts} total={total} fromDate={fromDate} toDate={toDate} loading={loading} />
          <p className="px-5 pb-4 text-xs text-ink-3">Outcomes are never overwritten by a later call.</p>
        </section>
      </div>

      <section className="panel" aria-label="Lead pages">
        <div className="panel-head"><h2 className="panel-title">Go to</h2></div>
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 px-3 py-2">
          {DESTINATIONS.map((p) => (
            <li key={p.href}>
              <Link href={p.href} className="group/go flex items-center gap-3 px-2 h-14 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium text-ink group-hover/go:text-[var(--blue)] transition-colors">{p.label}</span>
                  <span className="block text-xs text-ink-3 truncate">{p.desc}</span>
                </span>
                <svg className="text-ink-4 transition-transform duration-150 group-hover/go:translate-x-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
