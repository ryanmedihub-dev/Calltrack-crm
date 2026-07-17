'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const COMMANDS = [
  { label: 'Dashboard',          href: '/dashboard',             section: 'Overview',      keywords: 'home overview stats' },
  { label: 'Analytics',          href: '/analytics',             section: 'Overview',      keywords: 'charts graphs metrics' },
  { label: 'Advanced Analytics', href: '/analytics/advanced',    section: 'Overview',      keywords: 'deep trends patterns comparison efficiency' },
  { label: 'Call Logs',          href: '/reports/calllogs',      section: 'Calls',         keywords: 'call history log records' },
  { label: 'Live Monitor',       href: '/calls/live',            section: 'Calls',         keywords: 'realtime live feed stream' },
  { label: 'Daily Targets',      href: '/calls/targets',         section: 'Calls',         keywords: 'goals quota targets progress' },
  { label: 'Employees',          href: '/reports/Employess',     section: 'Management',    keywords: 'team staff users agents' },
  { label: 'Leaderboard',        href: '/employees/leaderboard', section: 'Management',    keywords: 'rankings top performers scores' },
  { label: 'Leads',              href: '/reports/lead',          section: 'Management',    keywords: 'contacts crm prospects customers' },
  { label: 'Pipeline',           href: '/leads/pipeline',        section: 'Management',    keywords: 'kanban funnel stages board' },
  { label: 'Periodic Reports',   href: '/reports',               section: 'Reports',       keywords: 'weekly monthly daily summary' },
  { label: 'Client Reports',     href: '/reports/client',        section: 'Reports',       keywords: 'client contact history account' },
  { label: 'Export Center',      href: '/reports/export',        section: 'Reports',       keywords: 'download csv data export backup' },
  { label: 'Notifications',      href: '/notifications',         section: 'Communication', keywords: 'alerts updates bell inbox' },
  { label: 'Call Scripts',       href: '/scripts',               section: 'Communication', keywords: 'scripts templates dialog pitch' },
  { label: 'Activity Log',       href: '/activity',              section: 'System',        keywords: 'timeline audit log history events' },
  { label: 'Settings',           href: '/settings',              section: 'System',        keywords: 'profile password team preferences about' },
];

function matches(cmd, query) {
  const q = query.toLowerCase();
  return `${cmd.label} ${cmd.keywords} ${cmd.section}`.toLowerCase().includes(q);
}

function groupBySection(list) {
  const map = {};
  list.forEach(cmd => {
    if (!map[cmd.section]) map[cmd.section] = [];
    map[cmd.section].push(cmd);
  });
  return map;
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-textMuted flex-shrink-0">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);
  const router = useRouter();

  const filtered = query.trim() ? COMMANDS.filter(c => matches(c, query)) : COMMANDS;
  const groups   = query.trim() ? null : groupBySection(COMMANDS);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlighted(0);
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => { setHighlighted(0); }, [query]);

  const go = useCallback((href) => { router.push(href); onClose(); }, [router, onClose]);

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && filtered[highlighted]) go(filtered[highlighted].href);
    if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search pages and actions…"
            className="flex-1 text-sm text-textPrimary placeholder:text-textMuted outline-none bg-transparent"
          />
          <kbd className="text-[10px] text-textMuted border border-border rounded px-1.5 py-0.5 font-mono flex-shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[22rem] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="text-sm text-textMuted text-center py-10">No results for &quot;{query}&quot;</p>
          )}

          {/* Filtered flat list */}
          {query.trim() && filtered.map((cmd, i) => (
            <button key={cmd.href} onClick={() => go(cmd.href)}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${i === highlighted ? 'bg-primary/10 text-primary' : 'text-textPrimary hover:bg-bg'}`}>
              <span className="font-medium truncate">{cmd.label}</span>
              <span className="ml-auto text-xs text-textMuted font-mono truncate shrink-0">{cmd.href}</span>
            </button>
          ))}

          {/* Grouped list (no query) */}
          {!query.trim() && groups && Object.entries(groups).map(([section, items]) => (
            <div key={section}>
              <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-textMuted">{section}</p>
              {items.map((cmd, i) => {
                const globalIdx = COMMANDS.indexOf(cmd);
                return (
                  <button key={cmd.href} onClick={() => go(cmd.href)}
                    onMouseEnter={() => setHighlighted(globalIdx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${globalIdx === highlighted ? 'bg-primary/10 text-primary' : 'text-textPrimary hover:bg-bg'}`}>
                    <span className="font-medium truncate">{cmd.label}</span>
                    <span className="ml-auto text-xs text-textMuted font-mono truncate shrink-0">{cmd.href}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2.5 flex items-center gap-5 text-[11px] text-textMuted">
          <span><kbd className="font-mono border border-border rounded px-1 mr-1">↑↓</kbd>navigate</span>
          <span><kbd className="font-mono border border-border rounded px-1 mr-1">↵</kbd>open</span>
          <span><kbd className="font-mono border border-border rounded px-1 mr-1">Esc</kbd>close</span>
        </div>
      </div>
    </div>
  );
}
