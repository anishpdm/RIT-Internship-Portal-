'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trophy,
  AlertCircle,
  Send,
  Clock,
  Lock,
} from 'lucide-react';

interface State {
  quiz: {
    id: string;
    title: string;
    mode: 'live' | 'self_paced';
    starts_at: string | null;
    ends_at: string | null;
    window_state: 'before' | 'open' | 'closed';
    answered: number;
    total: number;
  } | null;
  question: {
    id: string;
    order_index: number;
    question_text: string;
    options: string[];
    correct_option?: number;
  } | null;
  myResponseForCurrent: {
    selected_option: number;
    is_correct: boolean;
  } | null;
  done: boolean;
  myScore: { correct: number; total: number } | null;
}

export default function QuizTaker({
  sessionId,
  sessionTitle,
  internshipTitle,
  backHref,
}: {
  sessionId: string;
  sessionTitle: string;
  internshipTitle: string;
  backHref: string;
}) {
  const [state, setState] = useState<State | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastQuestionIdRef = useRef<string | null>(null);

  async function fetchState() {
    try {
      const res = await fetch(`/api/quiz/state?session_id=${sessionId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      setState(data);
      const qid = data.question?.id ?? null;
      if (qid !== lastQuestionIdRef.current) {
        lastQuestionIdRef.current = qid;
        setSelected(null);
        setConfirming(false);
        setErr(null);
      }
    } catch {}
  }

  // Initial fetch + tick for countdown
  useEffect(() => {
    fetchState();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function pickOption(idx: number) {
    if (state?.myResponseForCurrent) return;
    if (submitting || confirming) return;
    setSelected(idx);
    setErr(null);
  }

  function openConfirm() {
    if (selected === null) {
      setErr('Tap one of the options first.');
      return;
    }
    setConfirming(true);
    setErr(null);
  }

  function cancelConfirm() {
    setConfirming(false);
  }

  async function confirmSubmit() {
    if (!state?.question || selected === null) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch('/api/quiz/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: state.question.id,
          selected_option: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? 'Failed to submit');
        setSubmitting(false);
        return;
      }
      setConfirming(false);
      // Refresh — server will return next unanswered question
      await fetchState();
    } catch {
      setErr('Network error — try again.');
    } finally {
      setSubmitting(false);
    }
  }

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

  // ───────── No quiz ─────────
  if (!state || !state.quiz) {
    return (
      <div className="empty">
        <p>No quiz is set up for this session yet.</p>
        <Link href={backHref} className="link text-sm mt-3 inline-block">
          ← Back to session
        </Link>
      </div>
    );
  }

  const { quiz, question, myResponseForCurrent, done, myScore } = state;

  // ───────── Before window ─────────
  if (quiz.window_state === 'before') {
    const opens = quiz.starts_at ? new Date(quiz.starts_at).getTime() : 0;
    const closes = quiz.ends_at ? new Date(quiz.ends_at).getTime() : 0;
    return (
      <div className="space-y-4">
        <Link href={backHref} className="link text-sm">
          <ChevronLeft size={12} className="inline" /> Back
        </Link>
        <div
          className="card text-center"
          style={{
            padding: '3.5rem 2rem',
            background:
              'radial-gradient(60% 50% at 50% 0%, rgba(79, 70, 229, 0.08), transparent 70%), var(--paper)',
          }}
        >
          <Clock size={32} style={{ color: 'var(--accent)', margin: '0 auto 1rem' }} />
          <p className="font-display text-2xl font-bold">{quiz.title}</p>
          <p className="text-sm mt-2" style={{ color: 'var(--ink-500)' }}>
            This quiz hasn&apos;t opened yet.
          </p>
          <p
            className="font-display text-3xl font-bold mt-6"
            style={{ color: 'var(--accent)' }}
          >
            Opens in {fmtDuration(opens - now)}
          </p>
          <div className="text-xs mt-4" style={{ color: 'var(--ink-500)' }}>
            <p>
              <strong>Opens:</strong> {new Date(opens).toLocaleString()}
            </p>
            <p>
              <strong>Closes:</strong> {new Date(closes).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ───────── After window ─────────
  if (quiz.window_state === 'closed') {
    return (
      <div className="space-y-4">
        <Link href={backHref} className="link text-sm">
          <ChevronLeft size={12} className="inline" /> Back
        </Link>
        <div
          className="card text-center"
          style={{
            padding: '3rem 2rem',
            background: 'var(--ink-100)',
            borderColor: 'var(--ink-300)',
          }}
        >
          <Lock size={32} style={{ color: 'var(--ink-500)', margin: '0 auto 1rem' }} />
          <p className="font-display text-2xl font-bold">Quiz closed</p>
          <p className="text-sm mt-2" style={{ color: 'var(--ink-500)' }}>
            The window for this quiz has ended.
          </p>
          {myScore && (
            <p
              className="font-display text-4xl font-bold mt-6"
              style={{ color: 'var(--accent)' }}
            >
              {myScore.correct} / {myScore.total}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ───────── Done (within window, all answered) ─────────
  if (done) {
    const pct =
      myScore && myScore.total > 0
        ? ((myScore.correct / myScore.total) * 100).toFixed(0)
        : null;
    const closes = quiz.ends_at ? new Date(quiz.ends_at).getTime() : 0;
    return (
      <div className="space-y-4">
        <Link href={backHref} className="link text-sm">
          <ChevronLeft size={12} className="inline" /> Back to session
        </Link>
        <div
          className="card text-center"
          style={{
            padding: '3rem 2rem',
            background:
              'linear-gradient(135deg, var(--accent-soft) 0%, rgba(79, 70, 229, 0.04) 100%)',
            borderColor: 'var(--accent)',
          }}
        >
          <Trophy
            size={40}
            style={{ color: 'var(--accent)', margin: '0 auto 1rem' }}
          />
          <p className="font-display text-3xl font-bold">All done!</p>
          {myScore && (
            <>
              <p
                className="font-display text-5xl font-bold mt-4"
                style={{ color: 'var(--accent)' }}
              >
                {myScore.correct} / {myScore.total}
              </p>
              {pct && (
                <p className="text-sm mt-2" style={{ color: 'var(--ink-500)' }}>
                  {pct}% correct
                </p>
              )}
            </>
          )}
          <p className="text-xs mt-6" style={{ color: 'var(--ink-500)' }}>
            Quiz closes in {fmtDuration(closes - now)}
          </p>
        </div>
      </div>
    );
  }

  if (!question) {
    return <div className="empty"><p>Loading question…</p></div>;
  }

  const closes = quiz.ends_at ? new Date(quiz.ends_at).getTime() : 0;
  const timeLeft = closes - now;
  const progressPct = ((quiz.answered + (myResponseForCurrent ? 1 : 0)) / quiz.total) * 100;

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href={backHref} className="link text-sm">
          <ChevronLeft size={12} className="inline" /> Leave (resume later)
        </Link>
        <div className="text-xs" style={{ color: 'var(--ink-500)' }}>
          <span
            className="font-mono font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            Q{quiz.answered + 1}
          </span>{' '}
          of {quiz.total} · closes in{' '}
          <span
            className="font-mono font-semibold"
            style={{ color: timeLeft < 3600 * 1000 ? 'var(--red-500)' : 'var(--ink-700)' }}
          >
            {fmtDuration(timeLeft)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--ink-100)' }}
      >
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${progressPct}%`,
            background: 'var(--accent)',
          }}
        />
      </div>

      {/* Question card */}
      <div
        key={question.id}
        className="card card-elevated"
        style={{ padding: '2rem 1.5rem' }}
      >
        <p className="eyebrow mb-3">{quiz.title}</p>
        <p
          className="font-display text-2xl md:text-3xl font-bold leading-tight"
          style={{ letterSpacing: '-0.02em' }}
        >
          {question.question_text}
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3" key={`opts-${question.id}`}>
        {question.options.map((opt, i) => {
          const submittedThis = myResponseForCurrent?.selected_option === i;
          const pickedThis = !myResponseForCurrent && selected === i;
          const disabled = !!myResponseForCurrent || submitting || confirming;

          let bg = 'var(--paper)';
          let border = 'var(--ink-200)';
          let color = 'var(--ink-900)';

          if (submittedThis) {
            bg = 'var(--accent-soft)';
            border = 'var(--accent)';
            color = 'var(--accent)';
          } else if (pickedThis) {
            bg = 'var(--accent)';
            border = 'var(--accent)';
            color = 'white';
          }

          return (
            <button
              type="button"
              key={i}
              onClick={() => pickOption(i)}
              disabled={disabled}
              className="quiz-option"
              style={{
                background: bg,
                border: `2px solid ${border}`,
                color,
                width: '100%',
                textAlign: 'left',
                padding: '1rem 1.1rem',
                borderRadius: 'var(--radius)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              <span
                className="w-9 h-9 rounded-md flex items-center justify-center font-mono font-bold shrink-0"
                style={{
                  background: pickedThis
                    ? 'white'
                    : submittedThis
                      ? 'var(--accent)'
                      : 'var(--ink-100)',
                  color: pickedThis
                    ? 'var(--accent)'
                    : submittedThis
                      ? 'white'
                      : 'var(--ink-700)',
                }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="font-medium text-base flex-1" style={{ color: 'inherit' }}>
                {opt}
              </span>
              {pickedThis && (
                <span className="text-xs font-semibold uppercase" style={{ letterSpacing: '0.05em' }}>
                  Picked
                </span>
              )}
              {submittedThis && <CheckCircle2 size={18} />}
            </button>
          );
        })}
      </div>

      {err && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-md text-sm"
          style={{ background: 'var(--red-soft)', color: 'var(--red-700)' }}
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {/* Submit panel */}
      {!myResponseForCurrent && (
        <div
          className="card"
          style={{
            padding: '1.25rem',
            background:
              selected !== null
                ? 'linear-gradient(135deg, var(--accent-soft) 0%, rgba(79, 70, 229, 0.04) 100%)'
                : 'var(--paper)',
            borderColor: selected !== null ? 'var(--accent)' : 'var(--ink-200)',
            borderWidth: 2,
          }}
        >
          {selected === null ? (
            <div className="text-center">
              <p
                className="font-display font-semibold text-lg mb-1"
                style={{ color: 'var(--ink-700)' }}
              >
                Tap one of the options above
              </p>
              <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
                You can change your pick before submitting.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p
                className="text-center text-sm"
                style={{ color: 'var(--ink-700)' }}
              >
                You picked{' '}
                <span
                  className="font-mono font-bold text-base"
                  style={{ color: 'var(--accent)' }}
                >
                  {String.fromCharCode(65 + selected)}
                </span>{' '}
                — tap{' '}
                <strong style={{ color: 'var(--accent)' }}>Submit answer</strong>{' '}
                to lock it in.
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  disabled={submitting}
                  className="btn btn-ghost"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={openConfirm}
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ fontSize: '1rem', padding: '0.65rem 1.5rem' }}
                >
                  <Send size={16} /> Submit answer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Answered already (shouldn't usually be reachable since server returns next unanswered, but just in case) */}
      {myResponseForCurrent && (
        <div
          className="card text-center"
          style={{
            background: 'var(--accent-soft)',
            borderColor: 'var(--accent)',
            color: 'var(--accent)',
          }}
        >
          <Sparkles size={18} className="inline mr-2" />
          <span className="font-medium">
            Answer locked in. Loading next question…
          </span>
        </div>
      )}

      {/* Confirm overlay */}
      {confirming && selected !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: 'rgba(15, 23, 42, 0.6)' }}
        >
          <div className="card max-w-md w-full" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                <span className="font-mono font-bold text-xl">
                  {String.fromCharCode(65 + selected)}
                </span>
              </div>
              <div>
                <p className="font-display font-bold text-lg">Submit this answer?</p>
                <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                  Once submitted, you cannot change it for this question.
                </p>
              </div>
            </div>
            <p
              className="text-sm p-3 rounded-md mb-4"
              style={{ background: 'var(--accent-soft)', color: 'var(--ink-900)' }}
            >
              <span className="eyebrow block mb-1">Your answer</span>
              <strong>{question.options[selected]}</strong>
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={cancelConfirm}
                disabled={submitting}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSubmit}
                disabled={submitting}
                className="btn btn-primary"
              >
                <Send size={14} /> {submitting ? 'Submitting…' : 'Yes, submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
