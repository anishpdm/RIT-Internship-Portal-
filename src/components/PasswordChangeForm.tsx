'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react';

export default function PasswordChangeForm() {
  const supabase = createClient();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);

    if (newPassword.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setErr('Passwords do not match.');
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setOk(true);
    setNewPassword('');
    setConfirm('');
  }

  return (
    <form onSubmit={submit} className="card max-w-xl space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="font-display text-lg font-semibold">Change password</h2>
      </div>
      <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
        Set a new password. Minimum 8 characters. You stay signed in after the change.
      </p>

      <div>
        <label className="field-label">New password</label>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="field"
            required
            minLength={8}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-stone-100"
            style={{ color: 'var(--ink-500)' }}
            aria-label="Toggle password visibility"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div>
        <label className="field-label">Confirm new password</label>
        <input
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="field"
          required
          minLength={8}
          placeholder="Type the same password again"
          autoComplete="new-password"
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
      {ok && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-md text-sm"
          style={{ background: 'var(--green-soft)', color: 'var(--green-700)' }}
        >
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>Password updated.</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || newPassword.length < 8 || newPassword !== confirm}
          className="btn btn-primary"
        >
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}
