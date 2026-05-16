'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, KeyRound, ShieldCheck, LogOut } from 'lucide-react';

export default function ForceChangePasswordForm({
  email,
  name,
  role,
}: {
  email: string;
  name: string;
  role: string;
}) {
  const supabase = createClient();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (next !== confirm) {
      setErr('Passwords do not match.');
      return;
    }
    if (next.length < 8) {
      setErr('Use at least 8 characters.');
      return;
    }
    if (next.toLowerCase() === 'rit12345') {
      setErr('Please choose a password different from the default.');
      return;
    }

    setBusy(true);

    const { error: updateErr } = await supabase.auth.updateUser({
      password: next,
    });
    if (updateErr) {
      setErr(updateErr.message);
      setBusy(false);
      return;
    }

    // Clear the must_change_password flag using the RPC
    await supabase.rpc('clear_must_change_password');

    // Hard redirect so middleware re-reads the flag
    window.location.href = `/${role}`;
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <ShieldCheck size={16} />
        </div>
        <div>
          <p className="font-display font-bold">Set a new password</p>
          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
            For security, you must change the default password before continuing.
          </p>
        </div>
      </div>

      <div
        className="text-xs px-3 py-2 rounded-md mb-4"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        Signed in as <strong>{name || email}</strong>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="field-label">New password</label>
          <input
            type="password"
            required
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className="field"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label className="field-label">Confirm new password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="field"
          />
        </div>

        {err && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-md text-sm"
            style={{ background: 'var(--red-soft)', color: 'var(--red-700)' }}
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          <KeyRound size={14} /> {busy ? 'Setting password…' : 'Set password & continue'}
        </button>
      </form>

      <button
        type="button"
        onClick={signOut}
        className="btn btn-ghost text-xs w-full mt-3"
      >
        <LogOut size={12} /> Sign out
      </button>
    </div>
  );
}
