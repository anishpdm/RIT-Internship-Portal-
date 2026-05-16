'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';

const HEARTBEAT_MS = 15_000;
const THRESHOLD = 0.8; // 80% active watch

export default function RecordedAttendance({
  sessionId,
  recordingUrl,
  videoDurationSec,
  initialActiveSeconds,
  initialStatus,
}: {
  sessionId: string;
  recordingUrl: string | null;
  videoDurationSec: number;
  initialActiveSeconds: number;
  initialStatus: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPositionRef = useRef<number>(0);
  const [activeSec, setActiveSec] = useState<number>(initialActiveSeconds);
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [err, setErr] = useState<string | null>(null);

  const required = Math.floor(videoDurationSec * THRESHOLD);
  const progress = required ? Math.min(100, (activeSec / required) * 100) : 0;

  useEffect(() => {
    if (status === 'present') return;
    const id = setInterval(async () => {
      const video = videoRef.current;
      if (!video) return;
      const position = Math.floor(video.currentTime);
      const visibility = document.visibilityState;

      try {
        const res = await fetch('/api/attendance/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            visibility,
            position,
            playing: !video.paused && !video.ended,
            last_position: lastPositionRef.current,
          }),
        });
        const json = await res.json();
        if (res.ok) {
          setActiveSec(json.active_seconds);
          setStatus(json.status);
          setErr(null);
        } else {
          setErr(json.error ?? null);
        }
      } catch {
        setErr('Network error');
      }
      lastPositionRef.current = position;
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [sessionId, status]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow">Recorded session</p>
        {status === 'present' && (
          <span className="pill pill-green">
            <Check size={10} className="inline" /> attended
          </span>
        )}
      </div>

      {recordingUrl ? (
        <video
          ref={videoRef}
          src={recordingUrl}
          controls
          className="w-full rounded mb-4 bg-black"
          style={{ maxHeight: 480 }}
        />
      ) : (
        <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
          Recording will be available soon.
        </p>
      )}

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-mono">
          <span>
            Active watch: {Math.floor(activeSec / 60)}:{String(activeSec % 60).padStart(2, '0')}
          </span>
          <span style={{ color: 'var(--ink-500)' }}>
            need {Math.floor(required / 60)}:{String(required % 60).padStart(2, '0')} ({Math.round(THRESHOLD * 100)}%)
          </span>
        </div>
        <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{ width: `${progress}%`, background: 'var(--accent)' }}
          />
        </div>
        <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
          The page must be visible and the video must keep playing forward.
          Switching tabs or scrubbing won't count.
        </p>
      </div>

      {err && (
        <p className="text-sm text-red-700 mt-3 flex items-center gap-1">
          <AlertCircle size={14} /> {err}
        </p>
      )}
    </div>
  );
}
