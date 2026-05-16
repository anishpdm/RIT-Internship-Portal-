'use client';

import { useState } from 'react';
import { ExternalLink, Check, AlertCircle } from 'lucide-react';

export default function LiveAttendance({
  sessionId,
  meetingUrl,
  scheduledAt,
  durationMinutes,
  existingStatus,
}: {
  sessionId: string;
  meetingUrl: string | null;
  scheduledAt: string | null;
  durationMinutes: number;
  existingStatus: string | null;
}) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string | null>(existingStatus);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error ?? 'Failed to mark attendance');
      } else {
        setStatus('present');
        setCode('');
      }
    } catch (e) {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="eyebrow">Live attendance</p>
        {status === 'present' && (
          <span className="pill pill-green">
            <Check size={10} className="inline" /> attended
          </span>
        )}
      </div>

      {meetingUrl && (
        <a
          href={meetingUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary mb-4 inline-flex"
        >
          <ExternalLink size={16} /> Join the session
        </a>
      )}

      <p className="text-sm mb-4" style={{ color: 'var(--ink-500)' }}>
        Your mentor will announce a 6-digit code during the session. Enter it below
        to mark yourself present. Codes rotate every 90 seconds.
      </p>

      <form onSubmit={submit} className="flex gap-2 max-w-md">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6-digit code"
          inputMode="numeric"
          className="field font-mono tracking-[0.4em] text-center text-xl"
          required
        />
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="btn btn-primary"
        >
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      {err && (
        <p className="text-sm text-red-700 mt-3 flex items-center gap-1">
          <AlertCircle size={14} /> {err}
        </p>
      )}
    </div>
  );
}
