'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { setToken } from '../../lib/auth';

function EyeOpen() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function EyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}
function ArrowRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

const features = [
  {
    title: 'Real-time Analytics',
    desc: 'Live call dashboards with instant KPI updates and trend insights.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  {
    title: 'Lead Management',
    desc: 'Convert calls to leads instantly, track pipeline and follow-ups.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/>
      </svg>
    ),
  },
  {
    title: 'Team Performance',
    desc: 'Monitor every employee, set daily targets and view leaderboards.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
];

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
    <div className="min-h-screen flex" style={{ background: '#F5F7FF' }}>

      {/* ── Left: brand panel ──────────────────────────── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[44%] flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0C0A1E 0%, #12103A 55%, #1A1060 100%)' }}>

        {/* Decorative orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 animate-float"
          style={{ background: 'radial-gradient(circle, #6366F1 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 -right-24 w-80 h-80 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F472B6 0%, transparent 70%)' }} />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        {/* Content */}
        <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 8px 24px rgba(99,102,241,0.45)' }}>
              <span className="text-white text-[15px] font-black tracking-tight">CT</span>
            </div>
            <div>
              <p className="text-white text-lg font-bold leading-none">CallTrack</p>
              <p className="text-xs mt-0.5 font-medium" style={{ color: '#6B6894' }}>CRM Platform</p>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold text-white leading-tight mb-3">
            Manage your<br />
            <span style={{ background: 'linear-gradient(135deg, #818CF8, #C084FC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              call operations
            </span>
          </h1>
          <p className="text-sm leading-relaxed mb-10" style={{ color: '#8D8BAC' }}>
            The all-in-one dashboard to monitor call activity, drive lead conversions and measure team performance.
          </p>

          {/* Feature list */}
          <div className="space-y-3">
            {features.map((f) => (
              <div key={f.title}
                className="flex items-start gap-3.5 rounded-2xl px-4 py-3.5"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(99,102,241,0.20)', color: '#818CF8' }}>
                  {f.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold leading-none">{f.title}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#7572A8' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom badge */}
          <div className="mt-10 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            <p className="text-xs" style={{ color: '#5A5780' }}>System is online · All services running</p>
          </div>
        </div>
      </div>

      {/* ── Right: form panel ──────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] animate-fade-in-up">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 6px 20px rgba(99,102,241,0.35)' }}>
              <span className="text-white text-xl font-black">CT</span>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>CallTrack CRM</h1>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-8"
            style={{ background: '#ffffff', border: '1px solid #E2E8F4', boxShadow: '0 4px 24px rgba(99,102,241,0.07), 0 1px 4px rgba(0,0,0,0.05)' }}>

            <div className="mb-7">
              <h2 className="text-xl font-bold leading-none" style={{ color: '#0F172A' }}>Welcome back</h2>
              <p className="text-sm mt-1.5" style={{ color: '#94A3B8' }}>Sign in to your workspace to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Email address
                </label>
                <input
                  type="email" required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="you@company.com"
                  className="w-full rounded-xl px-4 py-3 text-sm transition-all input-ring"
                  style={{
                    background: '#F8FAFF',
                    border: '1px solid #E2E8F4',
                    color: '#0F172A',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} required
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full rounded-xl px-4 py-3 pr-11 text-sm transition-all input-ring"
                    style={{
                      background: '#F8FAFF',
                      border: '1px solid #E2E8F4',
                      color: '#0F172A',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                    style={{ color: '#94A3B8' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#6366F1'}
                    onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}>
                    {showPw ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold mt-2 flex items-center justify-center gap-2 transition-all"
                style={{
                  background: loading ? '#818CF8' : 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
                  color: '#fff',
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.35)',
                  opacity: loading ? 0.8 : 1,
                  transform: 'translateY(0)',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.45)'; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 16px rgba(99,102,241,0.35)'; }}>
                {loading ? (
                  <><SpinnerIcon />Signing in…</>
                ) : (
                  <><span>Sign In</span><ArrowRight /></>
                )}
              </button>
            </form>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs mt-5" style={{ color: '#CBD5E1' }}>
            Secure access · Session expires in 7 days
          </p>
        </div>
      </div>
    </div>
  );
}
