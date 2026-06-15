'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Sidebar from '../../components/Sidebar';
import TopBar  from '../../components/TopBar';
import { isAuthenticated } from '../../lib/auth';
import api from '../../lib/api';

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

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white text-sm font-black shadow-md animate-pulse select-none">
            CT
          </div>
          <p className="text-textMuted text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
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

      {/* Main content — no left margin on mobile, offset on desktop */}
      <div className={`
        flex-1 min-w-0 flex flex-col
        transition-[margin] duration-300 ease-in-out
        ${collapsed ? 'lg:ml-[68px]' : 'lg:ml-60'}
      `}>
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
