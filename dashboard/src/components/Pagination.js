function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

export default function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;

  const getRange = () => {
    const delta = 2;
    const range = [];
    for (let i = Math.max(1, page - delta); i <= Math.min(pages, page + delta); i++) {
      range.push(i);
    }
    if (range[0] > 2) range.unshift('...');
    if (range[0] !== 1) range.unshift(1);
    if (range[range.length - 1] < pages - 1) range.push('...');
    if (range[range.length - 1] !== pages) range.push(pages);
    return range;
  };

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: '34px', height: '34px', borderRadius: '10px',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    transition: 'all 0.15s ease', border: '1px solid #E2E8F4',
    background: '#fff', color: '#475569',
  };

  return (
    <div className="flex items-center justify-center gap-1.5 mt-5">
      {/* Prev */}
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        style={{ ...btnBase, opacity: page <= 1 ? 0.35 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer', padding: '0 10px' }}
        onMouseEnter={e => { if (page > 1) { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#6366F1'; } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F4'; e.currentTarget.style.color = '#475569'; }}>
        <ChevronLeft />
      </button>

      {/* Page numbers */}
      {getRange().map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="text-xs px-1 select-none" style={{ color: '#94A3B8' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            style={{
              ...btnBase,
              background: p === page ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : '#fff',
              color: p === page ? '#fff' : '#475569',
              borderColor: p === page ? 'transparent' : '#E2E8F4',
              boxShadow: p === page ? '0 4px 12px rgba(99,102,241,0.30)' : 'none',
            }}
            onMouseEnter={e => { if (p !== page) { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#6366F1'; } }}
            onMouseLeave={e => { if (p !== page) { e.currentTarget.style.borderColor = '#E2E8F4'; e.currentTarget.style.color = '#475569'; } }}>
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        style={{ ...btnBase, opacity: page >= pages ? 0.35 : 1, cursor: page >= pages ? 'not-allowed' : 'pointer', padding: '0 10px' }}
        onMouseEnter={e => { if (page < pages) { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#6366F1'; } }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F4'; e.currentTarget.style.color = '#475569'; }}>
        <ChevronRight />
      </button>
    </div>
  );
}
