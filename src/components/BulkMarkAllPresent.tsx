'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function BulkMarkAllPresent({
  sessionId,
  studentIds,
}: {
  sessionId: string;
  studentIds: string[];   // only the level-filtered students
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [, startTransition] = useTransition();

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/attendance/manual-mark-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, student_ids: studentIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error ?? 'Failed' });
        setBusy(false);
        return;
      }
      setMsg({ kind: 'ok', text: `Marked ${data.count} student(s) present.` });
      setConfirming(false);
      startTransition(() => router.refresh());
      setTimeout(() => setBusy(false), 400);
    } catch (e: any) {
      setMsg({ kind: 'err', text: 'Network error' });
      setBusy(false);
    }
  }

  return (
    <div className="mb-4">
      {!confirming ? (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className="btn btn-secondary text-sm"
          >
            <UserCheck size={14} /> Mark all enrolled students Present
          </button>
          <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
            Use after a live session — then change individual exceptions below.
          </span>
        </div>
      ) : (
        <div
          className="card flex items-center gap-3 flex-wrap"
          style={{
            background: 'var(--accent-soft)',
            borderColor: 'var(--accent)',
            padding: '0.85rem 1rem',
          }}
        >
          <p className="text-sm font-medium flex-1">
            Mark every enrolled student as Present? You can still change individuals afterwards.
          </p>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="btn btn-ghost text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="btn btn-primary text-sm"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
            {busy ? 'Marking…' : 'Yes, mark all Present'}
          </button>
        </div>
      )}

      {msg && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-md text-sm mt-2"
          style={{
            background: msg.kind === 'ok' ? 'var(--green-soft)' : 'var(--red-soft)',
            color: msg.kind === 'ok' ? 'var(--green-700)' : 'var(--red-700)',
          }}
        >
          {msg.kind === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}
