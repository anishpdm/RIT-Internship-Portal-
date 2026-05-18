'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, UserX, Clock, CircleSlash, Loader2, AlertCircle, Check } from 'lucide-react';

type Status = 'present' | 'partial' | 'absent';

export default function AttendanceRowActions({
  sessionId,
  studentId,
  currentStatus,
}: {
  sessionId: string;
  studentId: string;
  currentStatus: Status | null;
}) {
  const router = useRouter();
  // Local copy of the status — updated optimistically when a write succeeds,
  // so the user sees the change instantly without depending on page refresh
  const [displayedStatus, setDisplayedStatus] = useState<Status | null>(currentStatus);
  const [busy, setBusy] = useState<Status | 'clear' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  async function send(action: Status | 'clear') {
    setBusy(action);
    setErr(null);
    setJustSaved(false);

    // Abort the request if it takes more than 12 seconds — no infinite spinners
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch('/api/attendance/manual-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          student_id: studentId,
          status: action,
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      // Try to parse JSON even on error responses
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        setErr(data?.error ?? `Server returned ${res.status}`);
        setBusy(null);
        return;
      }

      // Optimistically update the visible state
      if (action === 'clear') {
        setDisplayedStatus(null);
      } else {
        setDisplayedStatus(action);
      }
      setJustSaved(true);
      setBusy(null);

      // Also refresh server data in the background so "How marked" column updates
      router.refresh();

      // Fade the "saved" indicator after 2s
      setTimeout(() => setJustSaved(false), 2000);
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e?.name === 'AbortError') {
        setErr('Request timed out — your Supabase free-tier may be sleeping or rate-limited.');
      } else {
        setErr(e?.message ?? 'Network error');
      }
      setBusy(null);
    }
  }

  function btnStyle(s: Status): React.CSSProperties {
    const isActive = displayedStatus === s;
    const palette = {
      present: { bg: 'var(--green-500)', soft: 'var(--green-soft)', text: 'var(--green-700)' },
      partial: { bg: '#eab308', soft: 'rgba(234, 179, 8, 0.12)', text: '#854d0e' },
      absent: { bg: 'var(--red-500)', soft: 'var(--red-soft)', text: 'var(--red-700)' },
    }[s];
    return {
      padding: '0.4rem 0.75rem',
      fontSize: '0.8rem',
      fontWeight: 500,
      background: isActive ? palette.bg : palette.soft,
      color: isActive ? 'white' : palette.text,
      border: 'none',
      borderRadius: 'var(--radius)',
      cursor: busy ? 'wait' : 'pointer',
      opacity: busy && busy !== s ? 0.4 : 1,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      transition: 'all 150ms',
      textTransform: 'capitalize',
    };
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => send('present')}
          disabled={!!busy}
          style={btnStyle('present')}
          aria-pressed={displayedStatus === 'present'}
        >
          {busy === 'present' ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <UserCheck size={11} />
          )}
          Present
        </button>
        <button
          type="button"
          onClick={() => send('partial')}
          disabled={!!busy}
          style={btnStyle('partial')}
          aria-pressed={displayedStatus === 'partial'}
        >
          {busy === 'partial' ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Clock size={11} />
          )}
          Partial
        </button>
        <button
          type="button"
          onClick={() => send('absent')}
          disabled={!!busy}
          style={btnStyle('absent')}
          aria-pressed={displayedStatus === 'absent'}
        >
          {busy === 'absent' ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <UserX size={11} />
          )}
          Absent
        </button>
        {displayedStatus && (
          <button
            type="button"
            onClick={() => send('clear')}
            disabled={!!busy}
            className="btn btn-ghost"
            style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem' }}
            title="Remove this attendance record"
          >
            {busy === 'clear' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <CircleSlash size={11} />
            )}
            Clear
          </button>
        )}
        {justSaved && (
          <span
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: 'var(--green-700)' }}
          >
            <Check size={12} /> Saved
          </span>
        )}
      </div>
      {err && (
        <div
          className="flex items-start gap-1.5 px-2 py-1.5 rounded text-xs"
          style={{
            background: 'var(--red-soft)',
            color: 'var(--red-700)',
            maxWidth: 380,
          }}
        >
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}
    </div>
  );
}
