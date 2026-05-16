'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function LiveCodePanel({ sessionId }: { sessionId: string }) {
  const [code, setCode] = useState<string>('— — — — — —');
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);

  async function fetchCode() {
    try {
      const res = await fetch(`/api/session-code?session_id=${sessionId}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const t = await res.text();
        setErr(t || 'Could not fetch code');
        return;
      }
      const json = await res.json();
      setCode(json.code);
      setExpiresIn(json.expiresInSec);
      setErr(null);
    } catch (e) {
      setErr('Network error');
    }
  }

  useEffect(() => {
    fetchCode();
    const id = setInterval(() => {
      setExpiresIn((v) => {
        if (v <= 1) {
          fetchCode();
          return 90;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow">Live attendance code</p>
        <button
          onClick={fetchCode}
          className="btn btn-ghost text-sm"
          aria-label="Refresh code"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      <p
        className="font-mono tracking-[0.5em] text-5xl text-center py-4"
        style={{ color: 'var(--accent)' }}
      >
        {code}
      </p>
      <p className="text-center text-sm" style={{ color: 'var(--ink-500)' }}>
        Rotates in {expiresIn}s · announce verbally to students
      </p>
      {err && <p className="text-sm text-red-700 mt-2">{err}</p>}
    </div>
  );
}
