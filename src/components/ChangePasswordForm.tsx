'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

export default function ChangePasswordForm() {
  const supabase = createClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(false);

    if (next !== confirm) {
      setErr('New passwords do not match.');
      return;
    }
    if (next.length < 8) {
      setErr('New password must be at least 8 characters.');
      return;
    }
    if (next === current) {
      setErr('New password must differ from the current one.');
      return;
    }

    setBusy(true);

    // Re-authenticate to verify the current password
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setErr('Could not verify your session. Sign in again.');
      setBusy(false);
      return;
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (signInErr) {
      setErr('Current password is incorrect.');
      setBusy(false);
      return;
    }

    // Update password
    const { error: updateErr } = await supabase.auth.updateUser({
      password: next,
    });
    if (updateErr) {
      setErr(updateErr.message);
      setBusy(false);
      return;
    }

    setSuccess(true);
    setCurrent('');
    setNext('');
    setConfirm('');
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="card max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <KeyRound size={16} />
        </div>
        <div>
          <p className="font-display font-semibold">Change password</p>
          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
            You&apos;ll need your current password to confirm.
          </p>
        </div>
      </div>

      <div>
        <label className="field-label">Current password</label>
        <input
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          className="field"
        />
      </div>

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

      {success && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-md text-sm"
          style={{ background: 'var(--green-soft)', color: 'var(--green-700)' }}
        >
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>Password updated successfully.</span>
        </div>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}
