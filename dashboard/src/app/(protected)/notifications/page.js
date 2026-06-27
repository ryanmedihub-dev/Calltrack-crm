'use client';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../../lib/api';

const READ_KEY  = 'calltrack_notif_read';
const PREF_KEY  = 'ct_notif_prefs';
const DEFAULT_PREFS = {
  newLead: true, followUp: true, callSync: false, weeklyReport: true, missed: true,
};

function loadRead()  { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY))||[]); } catch { return new Set(); } }
function saveRead(s) { localStorage.setItem(READ_KEY, JSON.stringify([...s])); }
function loadPrefs() { try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY)) }; } catch { return DEFAULT_PREFS; } }
function savePrefs(p){ localStorage.setItem(PREF_KEY, JSON.stringify(p)); }

function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={()=>onChange(!checked)}
      className="relative flex-shrink-0 transition-colors duration-200 focus:outline-none"
      style={{ width:40, height:24, borderRadius:9999, background:checked?'#2563EB':'#E2E8F0' }}>
      <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
        style={{ transform:checked?'translateX(18px)':'translateX(4px)' }}/>
    </button>
  );
}

function buildNotifications(calls, leads) {
  const now  = Date.now();
  const list = [];

  leads
    .filter(l=>l.followUpDate && new Date(l.followUpDate)<=new Date(now+86400000))
    .forEach(l=>{
      const overdue = new Date(l.followUpDate) < new Date();
      list.push({
        id:`fu_${l._id}`, type:'followUp',
        color:overdue?'#EF4444':'#D97706', bg:overdue?'rgba(220,38,38,0.08)':'rgba(217,119,6,0.08)',
        title:`Follow-up ${overdue?'overdue':'today'}: ${l.name}`,
        body:`${l.phone}${l.lastCallNote?` · "${l.lastCallNote}"` : ''}`,
        time:new Date(l.followUpDate).toISOString(),
        icon:overdue?'🔴':'📅',
      });
    });

  calls
    .filter(c=>c.callType==='missed' && (now-new Date(c.timestamp))<86400000)
    .slice(0,5)
    .forEach(c=>{
      list.push({
        id:`missed_${c._id}`, type:'missed',
        color:'#EF4444', bg:'rgba(220,38,38,0.08)', icon:'📵',
        title:`Missed call from ${c.contactName||c.contactNumber}`,
        body:`${c.employeeName} · ${new Date(c.timestamp).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`,
        time:c.timestamp,
      });
    });

  const recentSync = calls.filter(c=>(now-new Date(c.timestamp))<3600000);
  if (recentSync.length > 0) {
    list.push({
      id:`sync_${Date.now()}`, type:'callSync',
      color:'#2563EB', bg:'rgba(37,99,235,0.08)', icon:'🔄',
      title:`${recentSync.length} call${recentSync.length!==1?'s':''} synced in the last hour`,
      body:'Call logs are up to date.',
      time:new Date().toISOString(),
    });
  }

  return list.sort((a,b)=>new Date(b.time)-new Date(a.time));
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now()-new Date(ts))/1000);
  if (diff<0)     return 'Just now';
  if (diff<60)    return `${diff}s ago`;
  if (diff<3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff<86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [readSet,  setReadSet]  = useState(new Set());
  const [prefs,    setPrefs]    = useState(DEFAULT_PREFS);
  const [tab,      setTab]      = useState('all');
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setReadSet(loadRead());
    setPrefs(loadPrefs());
    (async () => {
      try {
        const [callsRes, leadsRes] = await Promise.all([
          api.get('/api/calls/realtime'),
          api.get('/api/leads?limit=200'),
        ]);
        const calls = callsRes.data.data||[];
        const leads = leadsRes.data.data?.leads||leadsRes.data.data||[];
        setNotifications(buildNotifications(calls, leads));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const markRead = useCallback((id)=>{
    setReadSet(prev=>{ const next=new Set(prev).add(id); saveRead(next); return next; });
  }, []);

  const markAllRead = () => {
    const next = new Set(notifications.map(n=>n.id));
    saveRead(next); setReadSet(next);
    toast.success('All notifications marked as read');
  };

  const updatePref = (key, val) => {
    const updated = { ...prefs, [key]:val };
    setPrefs(updated); savePrefs(updated);
    toast.success(`${val?'Enabled':'Disabled'} ${key} notifications`);
  };

  const visible = tab==='all'
    ? notifications.filter(n=>prefs[n.type]!==false)
    : notifications.filter(n=>prefs[n.type]!==false && !readSet.has(n.id));

  const unreadCount = notifications.filter(n=>!readSet.has(n.id) && prefs[n.type]!==false).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2.5" style={{ color:'#0F172A', letterSpacing:'-0.02em' }}>
            Notifications
            {unreadCount > 0 && (
              <span className="text-xs text-white rounded-full px-2 py-0.5 font-semibold" style={{ background:'#2563EB' }}>{unreadCount}</span>
            )}
          </h2>
          <p className="text-sm mt-0.5" style={{ color:'#94A3B8' }}>Follow-up reminders, missed calls, and sync events</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
            style={{ color:'#2563EB', background:'#EFF6FF', border:'1px solid #BFDBFE' }}
            onMouseEnter={e=>{ e.currentTarget.style.background='#DBEAFE'; }}
            onMouseLeave={e=>{ e.currentTarget.style.background='#EFF6FF'; }}>
            Mark all read
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        {/* Left: notifications */}
        <div className="xl:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="tab-nav">
            <button onClick={()=>setTab('all')} className={`tab-item${tab==='all'?' active':''}`}>All</button>
            <button onClick={()=>setTab('unread')} className={`tab-item${tab==='unread'?' active':''}`}>
              Unread{unreadCount>0?` (${unreadCount})`:''}
            </button>
          </div>

          <div className="page-card overflow-hidden">
            {loading ? (
              <div>
                {[1,2,3].map(i=>(
                  <div key={i} className="flex items-start gap-4 px-5 py-4" style={{ borderBottom:'1px solid #F1F5F9' }}>
                    <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0"/>
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="skeleton h-3 w-3/4 rounded"/>
                      <div className="skeleton h-3 w-1/2 rounded"/>
                    </div>
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background:'#EFF6FF', color:'#2563EB' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color:'#0F172A' }}>{tab==='unread'?'All caught up!':'No notifications'}</p>
                <p className="text-xs" style={{ color:'#94A3B8' }}>Check back later or adjust your preferences</p>
              </div>
            ) : visible.map(n=>{
              const isRead = readSet.has(n.id);
              return (
                <div key={n.id}
                  onClick={()=>markRead(n.id)}
                  className="flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors"
                  style={{ borderBottom:'1px solid #F1F5F9', background:isRead?'':'rgba(37,99,235,0.02)' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#F8FAFC'}
                  onMouseLeave={e=>e.currentTarget.style.background=isRead?'':'rgba(37,99,235,0.02)'}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background:n.bg, color:n.color }}>
                    {n.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{ color:'#0F172A', fontWeight:isRead?400:600 }}>{n.title}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color:'#94A3B8' }}>{n.body}</p>
                    <p className="text-xs mt-1" style={{ color:'#94A3B8' }}>{timeAgo(n.time)}</p>
                  </div>
                  {!isRead && <span className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background:'#2563EB' }}/>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: preferences */}
        <div className="page-card overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom:'1px solid #E2E8F0' }}>
            <h3 className="font-bold text-sm" style={{ color:'#0F172A' }}>Notification Preferences</h3>
            <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>Toggle which alerts you receive</p>
          </div>
          <div style={{ borderBottom:'1px solid #E2E8F0' }}>
            {[
              { key:'newLead',      label:'New Lead Assigned',   desc:'When a lead is assigned to you', icon:'🎯' },
              { key:'followUp',     label:'Follow-up Reminders', desc:'Upcoming or overdue follow-ups',  icon:'📅' },
              { key:'missed',       label:'Missed Call Alerts',  desc:'Missed calls in the last 24h',   icon:'📵' },
              { key:'callSync',     label:'Call Sync Events',    desc:'When call logs sync from mobile', icon:'🔄' },
              { key:'weeklyReport', label:'Weekly Report',       desc:'Performance summary every week',  icon:'📊' },
            ].map(({ key, label, desc, icon }) => (
              <div key={key} className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom:'1px solid #F1F5F9' }}>
                <div className="flex items-start gap-3 mr-3 min-w-0">
                  <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none" style={{ color:'#0F172A' }}>{label}</p>
                    <p className="text-xs mt-0.5" style={{ color:'#94A3B8' }}>{desc}</p>
                  </div>
                </div>
                <Toggle checked={!!prefs[key]} onChange={v=>updatePref(key, v)}/>
              </div>
            ))}
          </div>
          <div className="px-5 py-3">
            <p className="text-xs" style={{ color:'#94A3B8' }}>Changes are saved automatically to this browser.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
