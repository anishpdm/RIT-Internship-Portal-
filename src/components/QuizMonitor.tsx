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

interface EnrolledStudent {
  id: string;
  name: string;
  email: string;
}

export default function QuizMonitor({
  sessionId,
  enrolledStudents,
  backHref,
}: {
  sessionId: string;
  enrolledStudents: EnrolledStudent[];
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

  // Per-student stats — only count responses to THIS quiz's questions
  const questionIdSet = new Set(monitor.questions.map((q) => q.id));
  const byStudent = new Map<string, { answered: number; correct: number }>();
  for (const r of monitor.responses) {
    if (!questionIdSet.has(r.question_id)) continue;
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

  // Per-student rows for the table, sorted by score desc, then by name
  const studentRows = enrolledStudents
    .map((s) => {
      const stats = byStudent.get(s.id);
      const answered = stats?.answered ?? 0;
      const correct = stats?.correct ?? 0;
      const pct = quiz.total > 0 ? Math.round((correct / quiz.total) * 100) : 0;
      const status: 'not_started' | 'in_progress' | 'completed' =
        answered === 0
          ? 'not_started'
          : answered >= quiz.total
            ? 'completed'
            : 'in_progress';
      return { ...s, answered, correct, pct, status };
    })
    .sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

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
          <p className="stat-num">{enrolledStudents.length}</p>
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

      {/* Per-student results table */}
      <div className="card p-0 overflow-hidden table-wrap">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--ink-200)' }}>
          <p className="font-display font-semibold">Per-student results</p>
          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
            Sorted by correct answers · ranking refreshes every 5 seconds
          </p>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Answered</th>
              <th style={{ textAlign: 'right' }}>Correct</th>
              <th style={{ textAlign: 'right' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {studentRows.map((s) => (
              <tr key={s.id}>
                <td>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                    {s.email}
                  </p>
                </td>
                <td>
                  {s.status === 'completed' && (
                    <span
                      className="pill"
                      style={{
                        background: 'var(--green-soft)',
                        color: 'var(--green-700)',
                      }}
                    >
                      Completed
                    </span>
                  )}
                  {s.status === 'in_progress' && (
                    <span
                      className="pill"
                      style={{
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                      }}
                    >
                      In progress
                    </span>
                  )}
                  {s.status === 'not_started' && (
                    <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
                      Not started
                    </span>
                  )}
                </td>
                <td className="font-mono text-sm" style={{ textAlign: 'right' }}>
                  {s.answered} / {quiz.total}
                </td>
                <td className="font-mono text-sm" style={{ textAlign: 'right' }}>
                  {s.correct}
                </td>
                <td
                  className="font-mono font-bold"
                  style={{
                    textAlign: 'right',
                    color:
                      s.pct >= 70
                        ? 'var(--green-700)'
                        : s.pct >= 40
                          ? 'var(--accent)'
                          : s.status === 'not_started'
                            ? 'var(--ink-500)'
                            : 'var(--red-700)',
                  }}
                >
                  {s.status === 'not_started' ? '—' : `${s.pct}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-question performance */}
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
                  <span
                    className="font-mono text-xs whitespace-nowrap"
                    style={{ color: 'var(--ink-500)' }}
                  >
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

      <div
        className="card text-xs"
        style={{ background: 'var(--accent-soft)', color: 'var(--ink-700)' }}
      >
        <p>
          <strong>Where does this score go?</strong> Each correct answer contributes
          to the student&apos;s quiz score (% correct of total questions). The quiz
          score is then weighted at <strong>5%</strong> in the combined leaderboard
          (assignments contribute 95%). View the full leaderboard from the internship
          performance page.
        </p>
      </div>
    </div>
  );
}
