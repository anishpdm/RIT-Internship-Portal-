'use client';

import { useState } from 'react';
import { KeyRound, X, CheckCircle2, AlertCircle, Copy } from 'lucide-react';

export default function ResetPasswordButton({
  userId,
  userName,
  action,
}: {
  userId: string;
  userName: string;
  action: (formData: FormData) => Promise<{ ok: boolean; password?: string; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [generated, setGenerated] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function genRandom() {
    const charset = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 12; i++) {
      out += charset[Math.floor(Math.random() * charset.length)];
    }
    setPassword(out);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErr('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('user_id', userId);
      fd.append('password', password);
      const res = await action(fd);
      if (res.ok) {
        setGenerated(password);
      } else {
        setErr(res.error ?? 'Failed to reset password');
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to reset password');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    setPassword('');
    setGenerated(null);
    setErr(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost text-xs"
        title={`Reset password for ${userName}`}
      >
        <KeyRound size={12} /> Reset
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(15, 23, 42, 0.4)' }}
          onClick={close}
        >
          <div
            className="card max-w-md w-full"
            style={{ boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-semibold">Reset password</p>
              <button onClick={close} className="btn btn-ghost p-1"><X size={16} /></button>
            </div>

            <p className="text-sm mb-4" style={{ color: 'var(--ink-500)' }}>
              Setting a new password for <strong>{userName}</strong>. Share this with them through a secure channel.
            </p>

            {generated ? (
              <div className="space-y-3">
                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-md text-sm"
                  style={{ background: 'var(--green-soft)', color: 'var(--green-700)' }}
                >
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                  <span>Password updated. Copy it now — it won&apos;t be shown again.</span>
                </div>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={generated}
                    className="field font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generated);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="btn btn-secondary"
                  >
                    <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={close} className="btn btn-primary">Done</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="field-label">New password</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      required
                      className="field font-mono"
                      placeholder="At least 8 characters"
                    />
                    <button type="button" onClick={genRandom} className="btn btn-secondary text-xs">
                      Generate
                    </button>
                  </div>
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

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={close} className="btn btn-ghost">Cancel</button>
                  <button type="submit" disabled={busy} className="btn btn-primary">
                    {busy ? 'Resetting…' : 'Reset password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
