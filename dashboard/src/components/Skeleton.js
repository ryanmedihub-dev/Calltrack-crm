'use client';

const W_MAP = {
  'full': '100%', '3/4': '75%', '2/3': '66.67%',
  '1/2': '50%',  '1/3': '33.33%', '1/4': '25%',
};

export function SkeletonLine({ w = 'full', h = 4 }) {
  return (
    <div
      className="bg-border rounded animate-pulse"
      style={{ width: W_MAP[w] || w, height: `${h * 4}px` }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-border rounded-2xl p-5 space-y-3">
      <SkeletonLine h={4} w="3/4" />
      <SkeletonLine h={3} w="full" />
      <SkeletonLine h={3} w="2/3" />
      <div className="pt-2">
        <div className="h-8 w-24 bg-border rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden">
      <div className="border-b border-border px-5 py-3 flex gap-4">
        {[40, 20, 20, 20].map((w, i) => (
          <div key={i} className="h-3 bg-border rounded animate-pulse" style={{ width: `${w}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-border last:border-0 px-5 py-3.5 flex gap-4 items-center">
          <div className="h-3 bg-border rounded animate-pulse" style={{ width: '40%' }} />
          <div className="h-3 bg-border rounded animate-pulse" style={{ width: '20%' }} />
          <div className="h-3 bg-border rounded animate-pulse" style={{ width: '20%' }} />
          <div className="h-3 bg-border rounded animate-pulse" style={{ width: '20%' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonKpi({ count = 4 }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <SkeletonLine h={3} w="1/2" />
            <div className="w-9 h-9 bg-border rounded-xl animate-pulse" />
          </div>
          <div className="h-8 bg-border rounded animate-pulse" style={{ width: '7rem' }} />
          <SkeletonLine h={3} w="3/4" />
        </div>
      ))}
    </div>
  );
}
