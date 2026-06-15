'use client';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';

const READ_KEY  = 'calltrack_notif_read';
const PREF_KEY  = 'ct_notif_prefs';

const DEFAULT_PREFS = {
  newLead:      true,
  followUp:     true,
  callSync:     false,
  weeklyReport: true,
  missed:       true,
};

function loadRead()  { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY))  || []); } catch { return new Set(); } }
function saveRead(s) { localStorage.setItem(READ_KEY, JSON.stringify([...s])); }
function loadPrefs() { try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY)) }; } catch { return DEFAULT_PREFS; } }
function savePrefs(p){ localStorage.setItem(PREF_KEY, JSON.stringify(p)); }

function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-primary' : 'bg-gray-200'}`}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

function buildNotifications(calls, leads) {
  const now  = Date.now();
  const list = [];

  // Follow-up reminders from leads
  leads
    .filter(l => l.followUpDate && new Date(l.followUpDate) <= new Date(now + 86400000))
    .forEach(l => {
      const overdue = new Date(l.followUpDate) < new Date();
      list.push({
        id:   `fu_${l._id}`,
        type: 'followUp',
        icon: '📅',
        color: overdue ? '#EF4444' : '#F59E0B',
        bg:   overdue ? '#FEF2F2' : '#FFFBEB',
        title: `Follow-up ${overdue ? 'overdue' : 'today'}: ${l.name}`,
        body:  `${l.phone}${l.lastCallNote ? ` · "${l.lastCallNote}"` : ''}`,
        time:  new Date(l.followUpDate).toISOString(),
      });
    });

  // Recent missed calls from last 24h
  calls
    .filter(c => c.callType === 'missed' && (now - new Date(c.timestamp)) < 86400000)
    .slice(0, 5)
    .forEach(c => {
      list.push({
        id:    `missed_${c._id}`,
        type:  'missed',
        icon:  '📵',
        color: '#EF4444',
        bg:    '#FEF2F2',
        title: `Missed call from ${c.contactName || c.contactNumber}`,
        body:  `${c.employeeName} · ${new Date(c.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
        time:  c.timestamp,
      });
    });

  // Recent syncs — outgoing calls in last hour
  const recentSync = calls.filter(c => (now - new Date(c.timestamp)) < 3600000);
  if (recentSync.length > 0) {
    list.push({
      id:    `sync_${Date.now()}`,
      type:  'callSync',
      icon:  '🔄',
      color: '#1A6BFF',
      bg:    '#EFF6FF',
      title: `${recentSync.length} call${recentSync.length !== 1 ? 's' : ''} synced in the last hour`,
      body:  'Call logs are up to date.',
      time:  new Date().toISOString(),
    });
  }

  // Sort newest first
  return list.sort((a, b) => new Date(b.time) - new Date(a.time));
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [readSet,   setReadSet]   = useState(new Set());
  const [prefs,     setPrefs]     = useState(DEFAULT_PREFS);
  const [tab,       setTab]       = useState('all');
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setReadSet(loadRead());
    setPrefs(loadPrefs());
    (async () => {
      try {
        const [callsRes, leadsRes] = await Promise.all([
          api.get('/api/calls/realtime'),
          api.get('/api/leads?limit=200'),
        ]);
        const calls = callsRes.data.data || [];
        const leads = leadsRes.data.data?.leads || leadsRes.data.data || [];
        setNotifications(buildNotifications(calls, leads));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const markRead = useCallback((id) => {
    setReadSet(prev => {
      const next = new Set(prev).add(id);
      saveRead(next);
      return next;
    });
  }, []);

  const markAllRead = () => {
    const next = new Set(notifications.map(n => n.id));
    saveRead(next);
    setReadSet(next);
    toast.success('All notifications marked as read');
  };

  const updatePref = (key, val) => {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
    savePrefs(updated);
    toast.success(`${key} notifications ${val ? 'enabled' : 'disabled'}`);
  };

  const visible = tab === 'all'
    ? notifications.filter(n => prefs[n.type] !== false)
    : notifications.filter(n => prefs[n.type] !== false && !readSet.has(n.id));

  const unreadCount = notifications.filter(n => !readSet.has(n.id) && prefs[n.type] !== false).length;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-textPrimary flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <span className="text-xs bg-primary text-white rounded-full px-2 py-0.5 font-semibold">{unreadCount}</span>
            )}
          </h2>
          <p className="text-textMuted text-sm mt-0.5">Follow-up reminders, missed calls, and sync events</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="text-xs text-primary hover:text-primaryDk font-semibold transition-colors">
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-border rounded-xl p-1 w-fit shadow-card">
        {[
          { key: 'all',    label: 'All' },
          { key: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-primary text-white shadow-sm' : 'text-textMuted hover:text-textSecondary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <div className="space-y-0 divide-y divide-border">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-4 px-5 py-4">
                <div className="w-10 h-10 bg-border rounded-xl animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 bg-border rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-border rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-textMuted gap-2">
            <span className="text-4xl">🔔</span>
            <p className="text-sm font-medium">{tab === 'unread' ? 'All caught up!' : 'No notifications'}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map(n => {
              const isRead = readSet.has(n.id);
              return (
                <div key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors ${isRead ? 'hover:bg-bg' : 'bg-blue-50/30 hover:bg-blue-50/50'}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: n.bg }}>
                    {n.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${isRead ? 'text-textSecondary font-normal' : 'text-textPrimary font-semibold'}`}>{n.title}</p>
                    <p className="text-xs text-textMuted mt-0.5 truncate">{n.body}</p>
                    <p className="text-xs text-textMuted mt-1">{timeAgo(n.time)}</p>
                  </div>
                  {!isRead && <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preferences */}
      <div className="bg-white border border-border rounded-2xl shadow-card">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-bold text-textPrimary">Notification Preferences</h3>
          <p className="text-xs text-textMuted mt-0.5">Choose which notifications to receive</p>
        </div>
        <div className="divide-y divide-border">
          {[
            { key: 'newLead',      label: 'New Lead Assigned',   desc: 'When a lead is assigned to you' },
            { key: 'followUp',     label: 'Follow-up Reminders', desc: 'Leads with upcoming or overdue follow-ups' },
            { key: 'missed',       label: 'Missed Call Alerts',  desc: 'Missed outgoing calls in the last 24 hours' },
            { key: 'callSync',     label: 'Call Sync Events',    desc: 'When call logs are synced from mobile' },
            { key: 'weeklyReport', label: 'Weekly Report',       desc: 'Weekly performance summary' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between px-5 py-4">
              <div className="min-w-0 mr-4">
                <p className="text-sm font-medium text-textPrimary">{label}</p>
                <p className="text-xs text-textMuted mt-0.5">{desc}</p>
              </div>
              <Toggle checked={!!prefs[key]} onChange={v => updatePref(key, v)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
