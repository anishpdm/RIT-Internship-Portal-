'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react';

interface MonitorState {
  quiz: {
    id: string;
    title: string;
    starts_at: string | null;
    ends_at: string | null;
    window_state: 'before' | 'open' | 'closed';
    total: number;
  };
  monitor: {
    responses: Array<{
      student_id: string;
      question_id: string;
      is_correct: boolean;
    }>;
    questions: Array<{ id: string; question_text: string; correct_option: number }>;
  };
}

export default function QuizMonitor({
  sessionId,
  totalEnrolled,
  backHref,
}: {
  sessionId: string;
  totalEnrolled: number;
  backHref: string;
}) {
  const [state, setState] = useState<MonitorState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchState() {
    try {
      const res = await fetch(`/api/quiz/state?session_id=${sessionId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data?.monitor) setState(data);
    } catch {}
  }

  useEffect(() => {
    fetchState();
    const loop = () => {
      // 5-second polling for monitor — light load
      pollRef.current = setTimeout(async () => {
        await fetchState();
        loop();
      }, 5000);
    };
    loop();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function fmtDuration(ms: number): string {
    if (ms <= 0) return '0s';
    const s = Math.floor(ms / 1000);
    const days = Math.floor(s / 86400);
    const hrs = Math.floor((s % 86400) / 3600);
    const min = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (days > 0) return `${days}d ${hrs}h`;
    if (hrs > 0) return `${hrs}h ${min}m`;
    if (min > 0) return `${min}m ${sec}s`;
    return `${sec}s`;
  }

  if (!state) {
    return <div className="empty">Loading monitor…</div>;
  }

  const { quiz, monitor } = state;
  const startMs = quiz.starts_at ? new Date(quiz.starts_at).getTime() : 0;
  const endMs = quiz.ends_at ? new Date(quiz.ends_at).getTime() : 0;

  // Compute per-student progress
  const byStudent = new Map<
    string,
    { answered: number; correct: number }
  >();
  for (const r of monitor.responses) {
    const cur = byStudent.get(r.student_id) ?? { answered: 0, correct: 0 };
    cur.answered++;
    if (r.is_correct) cur.correct++;
    byStudent.set(r.student_id, cur);
  }

  const startedCount = byStudent.size;
  const completedCount = Array.from(byStudent.values()).filter(
    (s) => s.answered >= quiz.total,
  ).length;

  // Per-question correctness rate
  const byQuestion = new Map<string, { right: number; total: number }>();
  for (const q of monitor.questions) {
    byQuestion.set(q.id, { right: 0, total: 0 });
  }
  for (const r of monitor.responses) {
    const cur = byQuestion.get(r.question_id);
    if (!cur) continue;
    cur.total++;
    if (r.is_correct) cur.right++;
  }

  return (
    <div className="space-y-5">
      <Link href={backHref} className="link text-sm">
        <ChevronLeft size={12} className="inline" /> Back
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">Monitor</p>
          <h1 className="font-display text-2xl font-bold">{quiz.title}</h1>
        </div>
        <div
          className="px-4 py-2 rounded-full text-sm font-semibold"
          style={{
            background:
              quiz.window_state === 'open'
                ? 'var(--green-soft)'
                : quiz.window_state === 'closed'
                  ? 'var(--ink-100)'
                  : 'var(--accent-soft)',
            color:
              quiz.window_state === 'open'
                ? 'var(--green-700)'
                : quiz.window_state === 'closed'
                  ? 'var(--ink-700)'
                  : 'var(--accent)',
          }}
        >
          {quiz.window_state === 'before' && (
            <>Opens in {fmtDuration(startMs - now)}</>
          )}
          {quiz.window_state === 'open' && (
            <>● Live · closes in {fmtDuration(endMs - now)}</>
          )}
          {quiz.window_state === 'closed' && <>Closed</>}
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--ink-500)' }}>
            <Users size={14} />
            <p className="eyebrow">Enrolled</p>
          </div>
          <p className="stat-num">{totalEnrolled}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--ink-500)' }}>
            <TrendingUp size={14} />
            <p className="eyebrow">Started</p>
          </div>
          <p className="stat-num">{startedCount}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--ink-500)' }}>
            <CheckCircle2 size={14} />
            <p className="eyebrow">Completed</p>
          </div>
          <p className="stat-num" style={{ color: 'var(--accent)' }}>
            {completedCount}
          </p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--ink-500)' }}>
            <Clock size={14} />
            <p className="eyebrow">Questions</p>
          </div>
          <p className="stat-num">{quiz.total}</p>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow mb-3">Per-question performance</p>
        <div className="space-y-3">
          {monitor.questions.map((q, i) => {
            const stats = byQuestion.get(q.id);
            const pct =
              stats && stats.total > 0
                ? Math.round((stats.right / stats.total) * 100)
                : 0;
            return (
              <div key={q.id}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <p className="text-sm font-medium truncate">
                    <span
                      className="font-mono mr-2"
                      style={{ color: 'var(--ink-500)' }}
                    >
                      Q{i + 1}
                    </span>
                    {q.question_text}
                  </p>
                  <span className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--ink-500)' }}>
                    {stats?.right ?? 0}/{stats?.total ?? 0} right
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: 'var(--ink-100)' }}
                >
                  <div
                    className="h-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background:
                        pct >= 70
                          ? 'var(--green-500)'
                          : pct >= 40
                            ? 'var(--accent)'
                            : 'var(--red-500)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
