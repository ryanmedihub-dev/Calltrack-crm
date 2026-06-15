export default function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="px-4 py-1.5 rounded-lg bg-white border border-border text-textSecondary text-sm font-medium disabled:opacity-40 hover:border-primary hover:text-primary transition-colors"
      >
        ← Prev
      </button>
      <span className="text-textMuted text-sm px-2">
        {page} / {pages}
      </span>
      <button
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className="px-4 py-1.5 rounded-lg bg-white border border-border text-textSecondary text-sm font-medium disabled:opacity-40 hover:border-primary hover:text-primary transition-colors"
      >
        Next →
      </button>
    </div>
  );
}
