'use client';

import { useEffect, useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';

const HEARTBEAT_MS = 15_000;

export default function SelfLearningAttendance({
  sessionId,
  minDwellMinutes,
  initialActiveSeconds,
  initialStatus,
  initialNote,
}: {
  sessionId: string;
  minDwellMinutes: number;
  initialActiveSeconds: number;
  initialStatus: string | null;
  initialNote: string;
}) {
  const [activeSec, setActiveSec] = useState<number>(initialActiveSeconds);
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [note, setNote] = useState(initialNote);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const required = minDwellMinutes * 60;
  const progress = Math.min(100, (activeSec / required) * 100);

  useEffect(() => {
    const id = setInterval(async () => {
      if (status === 'present') return;
      try {
        const res = await fetch('/api/attendance/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            visibility: document.visibilityState,
            self_learning: true,
          }),
        });
        const json = await res.json();
        if (res.ok) {
          setActiveSec(json.active_seconds);
          setStatus(json.status);
        }
      } catch {
        setErr('Network error');
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [sessionId, status]);

  async function saveNote() {
    setSaving(true);
    setSaved(false);
    setErr(null);
    try {
      const res = await fetch('/api/attendance/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          visibility: 'visible',
          self_learning: true,
          reflection_note: note,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setSaved(true);
        setStatus(json.status);
      } else {
        setErr(json.error ?? 'Failed to save');
      }
    } catch {
      setErr('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow">Self-learning</p>
        {status === 'present' && (
          <span className="pill pill-green">
            <Check size={10} className="inline" /> attended
          </span>
        )}
      </div>

      <p className="text-sm mb-4" style={{ color: 'var(--ink-500)' }}>
        Spend at least {minDwellMinutes} minutes on this page with it open and visible,
        then write a short reflection on what you learnt.
      </p>

      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-xs font-mono">
          <span>
            Dwell: {Math.floor(activeSec / 60)}:{String(activeSec % 60).padStart(2, '0')}
          </span>
          <span style={{ color: 'var(--ink-500)' }}>
            need {minDwellMinutes}:00
          </span>
        </div>
        <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${progress}%`, background: 'var(--accent)' }}
          />
        </div>
      </div>

      <div>
        <label className="field-label">Reflection note</label>
        <textarea
          rows={5}
          className="field"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you learn? What questions remain?"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
            {note.length} characters · minimum 50 for credit
          </p>
          <button
            onClick={saveNote}
            disabled={saving || note.length < 50}
            className="btn btn-primary"
          >
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save reflection'}
          </button>
        </div>
      </div>

      {err && (
        <p className="text-sm text-red-700 mt-3 flex items-center gap-1">
          <AlertCircle size={14} /> {err}
        </p>
      )}
    </div>
  );
}
