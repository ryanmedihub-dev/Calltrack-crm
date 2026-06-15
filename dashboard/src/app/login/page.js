'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { setToken } from '../../lib/auth';

export default function LoginPage() {
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', form);
      setToken(res.data.data.token);
      toast.success('Welcome back!');
      window.location.href = '/dashboard';
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left – Branding panel (hidden on small screens) */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/10" />
        <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full bg-blue-400/10" />
        <div className="absolute top-1/2 -right-8 w-32 h-32 rounded-full bg-purple-500/10" />

        <div className="relative z-10 text-center max-w-sm">
          {/* Logo */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-white text-2xl font-black">CT</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">CallTrack CRM</h1>
          <p className="text-sidebarText text-base leading-relaxed">
            Monitor your team's call activity, manage leads, and drive better sales outcomes — all in one place.
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-col gap-3 text-left">
            {[
              { icon: '📊', text: 'Real-time call analytics dashboard' },
              { icon: '🎯', text: 'Lead management & follow-up tracking' },
              { icon: '👥', text: 'Team performance monitoring' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 bg-sidebarBorder/60 rounded-xl px-4 py-3">
                <span className="text-lg">{icon}</span>
                <p className="text-sidebarText text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right – Login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-bg">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center mx-auto mb-3 shadow-md">
              <span className="text-white text-xl font-black">CT</span>
            </div>
            <h1 className="text-2xl font-bold text-textPrimary">CallTrack CRM</h1>
          </div>

          <div className="bg-white rounded-2xl border border-border shadow-card-md p-8">
            <div className="mb-7">
              <h2 className="text-xl font-bold text-textPrimary">Sign in</h2>
              <p className="text-textMuted text-sm mt-1">Welcome back! Please enter your credentials.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-textSecondary text-xs font-semibold mb-1.5 uppercase tracking-wide">Email</label>
                <input
                  type="email" required value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="manager@calltrack.com"
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-textMuted"
                />
              </div>

              <div>
                <label className="block text-textSecondary text-xs font-semibold mb-1.5 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} required value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 pr-11 text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-textMuted"
                  />
                  <button
                    type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textSecondary transition-colors p-1">
                    {showPw ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full bg-primary hover:bg-primaryDk text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm shadow-sm mt-2 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Signing in…
                  </>
                ) : 'Sign In →'}
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}
