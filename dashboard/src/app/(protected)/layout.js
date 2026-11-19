'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import { MotionConfig } from 'framer-motion';
import Sidebar from '../../components/Sidebar';
import TopBar  from '../../components/TopBar';
import { isAuthenticated, isAdminUser, isAdminOnlyPath } from '../../lib/auth';
import api from '../../lib/api';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="flex items-center gap-3 animate-fade-in">
        <span className="w-8 h-8 rounded-lg bg-[var(--blue)] text-white flex items-center justify-center text-xs font-bold">CT</span>
        <span className="text-sm text-ink-3">Loading CallTrack…</span>
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

  // Employees have no dashboard (the API refuses them); managers/TLs can't open org-wide pages.
  const pathname = usePathname();
  useEffect(() => {
    if (!user) return;
    if (user.role === 'employee') {
      toast.error('The dashboard is for managers and admins only');
      Cookies.remove('token');
      router.push('/login');
    } else if (!isAdminUser(user) && isAdminOnlyPath(pathname)) {
      router.replace('/team');
    }
  }, [user, pathname, router]);

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
    // One motion default for every framer-motion element that doesn't set its own: strong ease-out at
    // 200ms (Emil Kowalski's UI curve), and reduced-motion users get fades instead of movement.
    <MotionConfig transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} reducedMotion="user">
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Mobile drawer backdrop — fades with the drawer, tap to close */}
      <div aria-hidden onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-30 lg:hidden bg-[rgba(26,23,38,0.45)] transition-opacity duration-200 ease-out ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        user={user}
        onLogout={handleLogout}
      />

      <div className={[
        'flex-1 min-w-0 flex flex-col',
        'transition-[margin] duration-200 ease-out motion-reduce:transition-none',
        collapsed ? 'lg:ml-[var(--sidebar-w-collapsed)]' : 'lg:ml-[var(--sidebar-w)]',
      ].join(' ')}>
        <TopBar
          collapsed={collapsed}
          onToggle={toggleSidebar}
          onMobileToggle={() => setMobileOpen(v => !v)}
        />
        <main className="flex-1 pt-[var(--topbar-h)]">
          <div className="px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-6 max-w-[1480px] w-full mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
    </MotionConfig>
  );
}
