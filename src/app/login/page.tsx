'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Fetch profile to determine target portal
    let targetRole = 'student';
    if (data?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();
      if (profile?.role) targetRole = profile.role;
    }

    // Log the login event (best-effort, don't block redirect on failure)
    try {
      await fetch('/api/auth/log-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'login' }),
      });
    } catch {
      // ignore
    }

    setLoading(false);
    // Hard reload so the server-side middleware reads the new cookie reliably
    window.location.href = `/${targetRole}`;
  }

  return (
    <main className="min-h-screen surface-gradient flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 mb-10 justify-center">
          <span className="brand-mark">RIT</span>
          <div>
            <p className="font-display text-lg font-semibold leading-tight">
              Internship Portal
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              Rajiv Gandhi Institute of Technology
            </p>
          </div>
        </Link>

        <div className="card card-elevated p-8" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <h1 className="font-display text-2xl font-bold">Welcome back</h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-500)' }}>
            Sign in to continue to your portal.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                placeholder="you@rit.ac.in"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-md text-sm"
                style={{ background: 'var(--red-soft)', color: 'var(--red-700)' }}>
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
              style={{ padding: '0.7rem 1rem' }}
            >
              {loading ? 'Signing in…' : <>Sign in <ArrowRight size={14} /></>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--ink-500)' }}>
          © Rajiv Gandhi Institute of Technology
        </p>
      </div>
    </main>
  );
}
