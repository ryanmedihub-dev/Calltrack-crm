'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Sidebar from '../../components/Sidebar';
import TopBar  from '../../components/TopBar';
import { isAuthenticated } from '../../lib/auth';
import api from '../../lib/api';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F1F5F9' }}>
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: '#2563EB', boxShadow: '0 8px 24px rgba(37,99,235,0.30)' }}>
            <span className="text-white text-sm font-black tracking-tight select-none">CT</span>
          </div>
          <div className="absolute -inset-1.5 rounded-[14px] border-2 border-transparent border-t-blue-400 animate-spin"
            style={{ animationDuration: '0.9s' }} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>CallTrack CRM</p>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Loading your workspace…</p>
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 0.15, 0.30].map((delay, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#2563EB', animationDelay: `${delay}s`, opacity: 0.6 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProtectedLayout({ children }) {
  const router = useRouter();
  const [ready,      setReady]      = useState(false);
  const [user,       setUser]       = useState(null);
  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') setCollapsed(true);
    api.get('/api/auth/me').then(r => setUser(r.data.data)).catch(() => {});
    setReady(true);
  }, [router]);

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    Cookies.remove('token');
    router.push('/login');
  };

  if (!ready) return <LoadingScreen />;

  return (
    <div className="flex min-h-screen" style={{ background: '#F1F5F9' }}>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => setMobileOpen(false)} />
      )}

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        user={user}
        onLogout={handleLogout}
      />

      <div className={[
        'flex-1 min-w-0 flex flex-col',
        'transition-[margin] duration-300 ease-in-out',
        collapsed ? 'lg:ml-[64px]' : 'lg:ml-56',
      ].join(' ')}>
        <TopBar
          collapsed={collapsed}
          onToggle={toggleSidebar}
          onMobileToggle={() => setMobileOpen(v => !v)}
          user={user}
        />
        <main className="flex-1 pt-14">
          <div className="p-4 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
