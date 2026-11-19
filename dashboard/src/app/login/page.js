'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { setToken } from '../../lib/auth';

const Eye = ({ off }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {off ? (
      <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
    ) : (
      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
    )}
  </svg>
);

// The product's own picture: calls climbing toward a dashed target line through the shift.
function ChaseMark() {
  return (
    <svg viewBox="0 0 420 220" className="w-full max-w-[440px]" aria-hidden>
      {[40, 90, 140, 190].map((y) => <line key={y} x1="0" x2="420" y1={y} y2={y} stroke="rgba(255,255,255,0.10)" />)}
      <line x1="10" y1="200" x2="410" y2="30" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeDasharray="7 6" />
      <path d="M10 200 L60 188 L110 160 L160 150 L210 118 L260 102 L300 84" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="300" cy="84" r="6" fill="#fff" />
      <circle cx="300" cy="84" r="12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      <line x1="300" y1="20" x2="300" y2="210" stroke="rgba(255,255,255,0.25)" strokeDasharray="2 4" />
    </svg>
  );
}

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/auth/login', form);
      setToken(res.data.data.token);
      toast.success('Signed in');
      window.location.href = '/dashboard';
    } catch (err) {
      const fallback = err.response?.status === 429
        ? 'Too many sign-in attempts. Wait a few minutes and try again.'
        : 'Couldn’t sign in. Check your email and password.';
      setError(err.response?.data?.error || fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] bg-[var(--bg)]">
      {/* Brand panel */}
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-[var(--blue)] text-white">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-white text-[var(--blue)] flex items-center justify-center text-xs font-bold">CT</span>
          <span className="text-[15px] font-semibold tracking-tight">CallTrack CRM</span>
        </div>
        <div>
          <ChaseMark />
          <h1 className="mt-10 text-[28px] leading-[1.2] font-semibold tracking-tight max-w-md">Know who’s on pace before the shift ends.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/75 max-w-md">
            Every agent’s calls sync from their own phone, so the team’s day reads as a chase against target — done, needed, and who is falling behind.
          </p>
        </div>
        <p className="text-xs text-white/60">For admins, managers and team leads. Agents use the CallTrack app.</p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <span className="w-9 h-9 rounded-lg bg-[var(--blue)] text-white flex items-center justify-center text-xs font-bold">CT</span>
            <span className="text-[15px] font-semibold text-ink tracking-tight">CallTrack CRM</span>
          </div>

          <h2 className="text-2xl font-semibold text-ink tracking-tight">Sign in</h2>
          <p className="text-[14px] text-ink-3 mt-1.5">Use the email and password your admin set up.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate={false}>
            {error && (
              <p role="alert" className="text-[13px] text-behind bg-[var(--behind-50)] rounded-lg px-3 py-2.5">{error}</p>
            )}
            <label className="block">
              <span className="form-label">Email</span>
              <input type="email" required autoComplete="email" autoFocus
                className="form-input h-10" placeholder="you@company.com"
                aria-invalid={!!error}
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="block">
              <span className="form-label">Password</span>
              <span className="relative block">
                <input type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                  className="form-input h-10 pr-11" aria-invalid={!!error}
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-ink-3 hover:text-ink hover:bg-gray-100 transition-colors">
                  <Eye off={showPw} />
                </button>
              </span>
            </label>
            <button type="submit" disabled={loading} className="btn-primary w-full h-10 text-[14px]">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-[13px] text-ink-3">Forgot your password? Ask your admin to reset it from Users.</p>
        </div>
      </main>
    </div>
  );
}
