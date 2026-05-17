'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Play,
  SkipForward,
  Eye,
  StopCircle,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  Trophy,
  Users,
} from 'lucide-react';

interface QuizState {
  quiz: {
    id: string;
    title: string;
    status: 'draft' | 'active' | 'reveal' | 'ended';
    current_question_index: number;
    total_questions: number;
    reveal_answer: boolean;
  };
  question: {
    id: string;
    question_text: string;
    options: string[];
    correct_option: number;
    time_limit_seconds: number;
  } | null;
  responseCounts: number[];
  respondedStudents: number;
}

export default function QuizPresenter({
  quizId,
  sessionId,
  backHref,
}: {
  quizId: string;
  sessionId: string;
  backHref: string;
}) {
  const [state, setState] = useState<QuizState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchState() {
    try {
      const res = await fetch(`/api/quiz/state?session_id=${sessionId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.quiz) setState(data);
    } catch {
      // ignore intermittent errors
    }
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch(`/api/quiz/leaderboard?quiz_id=${quizId}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard ?? []);
      }
    } catch {}
  }

  useEffect(() => {
    fetchState();
    const loop = () => {
      pollTimerRef.current = setTimeout(async () => {
        await fetchState();
        loop();
      }, 1500);
    };
    loop();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (state?.quiz.status === 'ended') {
      fetchLeaderboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.quiz.status]);

  async function control(action: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/quiz/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_id: quizId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      await fetchState();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
        Loading quiz…
      </p>
    );
  }

  const { quiz, question, responseCounts, respondedStudents } = state;
  const totalVotes = responseCounts.reduce((s, n) => s + n, 0);

  // Ended view with leaderboard
  if (quiz.status === 'ended') {
    return (
      <div className="space-y-6">
        <div
          className="card"
          style={{
            background:
              'linear-gradient(135deg, var(--accent-soft) 0%, rgba(79, 70, 229, 0.04) 100%)',
            borderColor: 'var(--accent)',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Trophy size={24} style={{ color: 'var(--accent)' }} />
            <p className="font-display text-2xl font-bold">Quiz complete</p>
          </div>
          <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
            {quiz.total_questions} question{quiz.total_questions === 1 ? '' : 's'} ·{' '}
            {leaderboard?.length ?? 0} student
            {(leaderboard?.length ?? 0) === 1 ? '' : 's'} participated
          </p>
        </div>

        {leaderboard && leaderboard.length > 0 && (
          <div className="card p-0 overflow-hidden table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Score</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r: any, i: number) => (
                  <tr key={r.student_id}>
                    <td>
                      <span
                        className="font-mono font-semibold"
                        style={{ color: i < 3 ? 'var(--accent)' : 'var(--ink-500)' }}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td>{r.full_name ?? r.email}</td>
                    <td className="font-mono">
                      {r.correct} / {r.total}
                    </td>
                    <td className="font-mono font-semibold">
                      {((r.correct / r.total) * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-2">
          <a href={backHref} className="btn btn-ghost">
            <ChevronLeft size={14} /> Back to session
          </a>
          <button
            type="button"
            onClick={() => control('reset')}
            disabled={busy}
            className="btn btn-secondary"
          >
            <RotateCcw size={14} /> Reset quiz
          </button>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="empty">
        No question to display. Add questions in the builder.
      </div>
    );
  }

  const isRevealing = quiz.reveal_answer;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="eyebrow">
            Question {quiz.current_question_index + 1} of {quiz.total_questions}
          </p>
          <p className="font-display font-semibold text-lg">{quiz.title}</p>
        </div>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-500)' }}>
          <Users size={14} /> {respondedStudents} responded
        </div>
      </div>

      {/* Question display */}
      <div className="card card-elevated" style={{ minHeight: 200 }}>
        <p
          className="font-display text-2xl md:text-3xl font-bold leading-tight"
          style={{ letterSpacing: '-0.02em' }}
        >
          {question.question_text}
        </p>
      </div>

      {/* Options + live bars */}
      <div className="space-y-3">
        {question.options.map((opt, i) => {
          const count = responseCounts[i] ?? 0;
          const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
          const isCorrect = isRevealing && i === question.correct_option;
          const isWrong = isRevealing && i !== question.correct_option;
          return (
            <div
              key={i}
              className="card"
              style={{
                padding: '0.5rem 0.75rem',
                position: 'relative',
                overflow: 'hidden',
                borderColor: isCorrect
                  ? 'var(--green-500)'
                  : 'var(--ink-200)',
                background: isCorrect
                  ? 'var(--green-soft)'
                  : 'var(--paper)',
              }}
            >
              {/* Animated bar */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${pct}%`,
                  background: isCorrect
                    ? 'rgba(16, 185, 129, 0.18)'
                    : isWrong
                      ? 'rgba(148, 163, 184, 0.16)'
                      : 'var(--accent-soft)',
                  transition: 'width 700ms cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 0,
                }}
              />
              <div
                className="flex items-center justify-between gap-3 relative"
                style={{ zIndex: 1, padding: '0.6rem 0.5rem' }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center font-mono font-bold text-sm shrink-0"
                    style={{
                      background: isCorrect ? 'var(--green-500)' : 'var(--ink-200)',
                      color: isCorrect ? 'white' : 'var(--ink-700)',
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <p
                    className="font-medium"
                    style={{
                      color: isWrong ? 'var(--ink-500)' : 'var(--ink-900)',
                    }}
                  >
                    {opt}
                  </p>
                  {isCorrect && (
                    <CheckCircle2
                      size={18}
                      style={{ color: 'var(--green-700)' }}
                    />
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono font-bold text-lg">{count}</p>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--ink-500)' }}
                  >
                    {pct.toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="card" style={{ position: 'sticky', bottom: 0 }}>
        {err && (
          <div
            className="px-3 py-2 rounded-md text-sm mb-3"
            style={{ background: 'var(--red-soft)', color: 'var(--red-700)' }}
          >
            {err}
          </div>
        )}
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <a href={backHref} className="btn btn-ghost">
            <ChevronLeft size={14} /> Back to session
          </a>
          <div className="flex gap-2 flex-wrap">
            {!isRevealing ? (
              <button
                type="button"
                onClick={() => control('reveal')}
                disabled={busy}
                className="btn btn-secondary"
              >
                <Eye size={14} /> Reveal answer
              </button>
            ) : (
              <span
                className="pill pill-green"
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                Answer revealed
              </span>
            )}
            <button
              type="button"
              onClick={() => control('next')}
              disabled={busy}
              className="btn btn-primary"
            >
              {quiz.current_question_index + 1 >= quiz.total_questions ? (
                <>
                  <StopCircle size={14} /> Finish quiz
                </>
              ) : (
                <>
                  <SkipForward size={14} /> Next question
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
