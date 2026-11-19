// Numbered pager for server-paginated pages. Same look as DataTable's pager: quiet buttons, the
// current page as a blue chip.
const Chevron = ({ dir }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points={dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
  </svg>
);

export default function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;

  const range = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) range.push(i);
  if (range[0] > 2) range.unshift('…');
  if (range[0] !== 1) range.unshift(1);
  if (range[range.length - 1] < pages - 1) range.push('…');
  if (range[range.length - 1] !== pages) range.push(pages);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 pt-4">
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="btn-secondary btn-sm btn-icon w-8">
        <Chevron dir="left" />
      </button>
      {range.map((p, i) => (p === '…' ? (
        <span key={`gap-${i}`} className="w-8 text-center text-xs text-ink-4 select-none">…</span>
      ) : (
        <button key={p} type="button" onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined}
          className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-medium tabular-nums transition-colors duration-150 ${p === page ? 'bg-[var(--blue)] text-white' : 'text-ink-2 hover:bg-gray-100'}`}>
          {p.toLocaleString('en-IN')}
        </button>
      )))}
      <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className="btn-secondary btn-sm btn-icon w-8">
        <Chevron dir="right" />
      </button>
    </nav>
  );
}
