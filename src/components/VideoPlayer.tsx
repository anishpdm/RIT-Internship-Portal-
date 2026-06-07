'use client';

import { useEffect, useRef, useState, useCallback, useId } from 'react';
import { Check, AlertCircle, ExternalLink, Play } from 'lucide-react';

/* ── YouTube URL helpers ──────────────────────────────────── */
export function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function isYouTubeUrl(url: string) {
  return /youtu(be\.com|\.be)/i.test(url);
}

/* ── Declare YT global (loaded from youtube.com/iframe_api) ── */
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const HEARTBEAT_MS = 15_000;
const THRESHOLD = 0.8;

interface Props {
  sessionId: string;
  recordingUrl: string | null;
  videoDurationSec: number;
  initialActiveSeconds: number;
  initialStatus: string | null;
}

export default function VideoPlayer({
  sessionId, recordingUrl, videoDurationSec,
  initialActiveSeconds, initialStatus,
}: Props) {
  const uid = useId().replace(/:/g, '');  // safe HTML id
  const nativeRef = useRef<HTMLVideoElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const lastPositionRef = useRef<number>(0);

  const [activeSec, setActiveSec]     = useState(initialActiveSeconds);
  const [status, setStatus]           = useState<string | null>(initialStatus);
  const [err, setErr]                 = useState<string | null>(null);
  const [ytReady, setYtReady]         = useState(false);

  const isYT    = recordingUrl ? isYouTubeUrl(recordingUrl) : false;
  const ytId    = recordingUrl ? getYouTubeId(recordingUrl) : null;
  const required = Math.floor(videoDurationSec * THRESHOLD);
  const progress  = required > 0 ? Math.min(100, (activeSec / required) * 100) : 0;

  /* ── Load YT IFrame API once ── */
  useEffect(() => {
    if (!isYT || !ytId) return;
    if (window.YT?.Player) { initYTPlayer(); return; }
    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      initYTPlayer();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYT, ytId]);

  function initYTPlayer() {
    const target = document.getElementById(`yt-${uid}`);
    if (!target) return;
    ytPlayerRef.current = new window.YT.Player(`yt-${uid}`, {
      videoId: ytId!,
      playerVars: { rel: 0, modestbranding: 1 },
      events: { onReady: () => setYtReady(true) },
    });
  }

  /* ── Heartbeat ── */
  const sendHeartbeat = useCallback(async () => {
    if (status === 'present') return;
    let position = 0;
    let playing  = false;

    if (isYT && ytPlayerRef.current) {
      try {
        position = Math.floor(ytPlayerRef.current.getCurrentTime?.() ?? 0);
        playing  = ytPlayerRef.current.getPlayerState?.() === 1; // 1 = playing
      } catch {}
    } else if (nativeRef.current) {
      position = Math.floor(nativeRef.current.currentTime);
      playing  = !nativeRef.current.paused && !nativeRef.current.ended;
    }

    try {
      const res = await fetch('/api/attendance/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          visibility: document.visibilityState,
          position,
          playing,
          last_position: lastPositionRef.current,
        }),
      });
      const json = await res.json();
      if (res.ok) { setActiveSec(json.active_seconds); setStatus(json.status); setErr(null); }
      else setErr(json.error ?? 'Heartbeat failed');
    } catch { setErr('Network error'); }

    lastPositionRef.current = position;
  }, [sessionId, status, isYT]);

  useEffect(() => {
    if (status === 'present') return;
    // Wait until YT player is ready (or immediately for native video)
    if (isYT && !ytReady) return;
    const id = setInterval(sendHeartbeat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [sendHeartbeat, status, isYT, ytReady]);

  /* ── No recording ── */
  if (!recordingUrl) {
    return (
      <div className="card flex flex-col items-center py-10 gap-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: 'var(--ink-100)' }}>🎬</div>
        <p className="font-semibold text-sm">Recording not available yet</p>
        <p className="text-xs" style={{ color: 'var(--ink-500)' }}>Check back after the session ends</p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <p className="eyebrow">Recorded session</p>
        {status === 'present' && (
          <span className="pill pill-green flex items-center gap-1">
            <Check size={10}/> Attended ✓
          </span>
        )}
      </div>

      {/* Player */}
      {isYT && ytId ? (
        <div className="relative rounded-xl overflow-hidden bg-black"
          style={{ aspectRatio: '16/9' }}>
          <div id={`yt-${uid}`} className="w-full h-full"/>
          {!ytReady && (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,.7)' }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,.15)' }}>
                  <Play size={22} style={{ color: 'white' }}/>
                </div>
                <p className="text-white text-xs">Loading player…</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <video
          ref={nativeRef}
          src={recordingUrl}
          controls
          className="w-full rounded-xl bg-black"
          style={{ maxHeight: 480 }}
        />
      )}

      {/* External link (always useful) */}
      <a href={recordingUrl} target="_blank" rel="noreferrer"
        className="flex items-center gap-1.5 text-xs link">
        <ExternalLink size={12}/> Open in {isYT ? 'YouTube' : 'new tab'}
      </a>

      {/* Watch progress */}
      {videoDurationSec > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span>Watch time: {fmt(activeSec)}</span>
            <span style={{ color: 'var(--ink-500)' }}>
              Required: {fmt(required)} ({Math.round(THRESHOLD * 100)}% of video)
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ink-100)' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: progress >= 100 ? 'var(--green-500)' : 'var(--accent)' }}/>
          </div>
          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
            Keep this tab visible and the video playing forward — scrubbing and tab-switching don't count.
          </p>
          {status === 'present' && (
            <p className="text-sm font-semibold" style={{ color: 'var(--green-700)' }}>
              ✓ Attendance recorded — you&apos;re all set!
            </p>
          )}
        </div>
      )}

      {err && (
        <p className="text-sm flex items-center gap-1" style={{ color: 'var(--red-700)' }}>
          <AlertCircle size={14}/> {err}
        </p>
      )}
    </div>
  );
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
