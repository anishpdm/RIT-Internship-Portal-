'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, UserX, Clock, CircleSlash, Loader2, AlertCircle } from 'lucide-react';

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
  const [busy, setBusy] = useState<Status | 'clear' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function send(status: Status | 'clear') {
    setBusy(status);
    setErr(null);
    try {
      const res = await fetch('/api/attendance/manual-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          student_id: studentId,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? 'Failed');
        setBusy(null);
        return;
      }
      // Refresh server data to show new state
      startTransition(() => {
        router.refresh();
      });
      // Keep busy state briefly for visual feedback while page refreshes
      setTimeout(() => setBusy(null), 400);
    } catch (e: any) {
      setErr('Network error');
      setBusy(null);
    }
  }

  function btnStyle(s: Status): React.CSSProperties {
    const isActive = currentStatus === s;
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
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => send('present')}
          disabled={!!busy}
          style={btnStyle('present')}
          aria-pressed={currentStatus === 'present'}
        >
          {busy === 'present' ? <Loader2 size={11} className="animate-spin" /> : <UserCheck size={11} />}
          Present
        </button>
        <button
          type="button"
          onClick={() => send('partial')}
          disabled={!!busy}
          style={btnStyle('partial')}
          aria-pressed={currentStatus === 'partial'}
        >
          {busy === 'partial' ? <Loader2 size={11} className="animate-spin" /> : <Clock size={11} />}
          Partial
        </button>
        <button
          type="button"
          onClick={() => send('absent')}
          disabled={!!busy}
          style={btnStyle('absent')}
          aria-pressed={currentStatus === 'absent'}
        >
          {busy === 'absent' ? <Loader2 size={11} className="animate-spin" /> : <UserX size={11} />}
          Absent
        </button>
        {currentStatus && (
          <button
            type="button"
            onClick={() => send('clear')}
            disabled={!!busy}
            className="btn btn-ghost"
            style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem' }}
            title="Remove this attendance record"
          >
            {busy === 'clear' ? <Loader2 size={11} className="animate-spin" /> : <CircleSlash size={11} />}
            Clear
          </button>
        )}
      </div>
      {err && (
        <div
          className="flex items-start gap-1.5 px-2 py-1 rounded text-xs"
          style={{ background: 'var(--red-soft)', color: 'var(--red-700)' }}
        >
          <AlertCircle size={11} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}
    </div>
  );
}
