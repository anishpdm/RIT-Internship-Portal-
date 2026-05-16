'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    setLoading(false);
    router.push(`/${profile?.role ?? 'student'}`);
    router.refresh();
  }

  return (
    <main className="min-h-screen paper flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="font-display text-2xl font-semibold inline-flex items-center gap-2"
        >
          <span
            className="w-7 h-7 inline-flex items-center justify-center text-white"
            style={{ background: 'var(--ink-900)' }}
          >
            F
          </span>
          ForgeML
        </Link>

        <div className="card mt-8">
          <p className="eyebrow">Sign in</p>
          <h1 className="font-display text-3xl font-semibold mt-2">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-500)' }}>
            One sign-in. Routed to your portal automatically.
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
                placeholder="you@university.edu"
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
              <p
                className="text-sm"
                style={{ color: '#991b1b' }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p
            className="mt-5 text-xs"
            style={{ color: 'var(--ink-500)' }}
          >
            Accounts are created by the program administrator. Lost your password?
            Ask your admin to reset it from Supabase Auth.
          </p>
        </div>
      </div>
    </main>
  );
}
