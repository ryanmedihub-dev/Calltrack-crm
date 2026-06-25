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
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: '#F5F7FF' }}>
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        {/* Animated logo */}
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse-ring"
            style={{
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              boxShadow: '0 8px 24px rgba(99,102,241,0.40)',
            }}>
            <span className="text-white text-lg font-black tracking-tight select-none">CT</span>
          </div>
          {/* Spinning ring */}
          <div className="absolute -inset-1.5 rounded-[18px] border-2 border-transparent border-t-indigo-400 animate-spin"
            style={{ animationDuration: '1s' }} />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>CallTrack CRM</p>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Loading your workspace…</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mt-1">
          {[0, 0.15, 0.30].map((delay, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                background: '#6366F1',
                animationDelay: `${delay}s`,
                opacity: 0.7,
              }} />
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
    <div className="flex min-h-screen" style={{ background: '#F5F7FF' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(12, 10, 30, 0.70)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
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
        collapsed ? 'lg:ml-[66px]' : 'lg:ml-60',
      ].join(' ')}>
        <TopBar
          collapsed={collapsed}
          onToggle={toggleSidebar}
          onMobileToggle={() => setMobileOpen(v => !v)}
          user={user}
        />
        <main className="flex-1 pt-16">
          <div className="p-4 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
