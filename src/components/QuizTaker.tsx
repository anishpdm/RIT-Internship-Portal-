'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Trophy,
  AlertCircle,
} from 'lucide-react';

interface State {
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
    correct_option?: number;
    time_limit_seconds: number;
  } | null;
  myResponse: {
    selected_option: number;
    is_correct: boolean;
  } | null;
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
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQuestionIdRef = useRef<string | null>(null);

  async function fetchState() {
    try {
      const res = await fetch(`/api/quiz/state?session_id=${sessionId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      setState(data);

      // Reset selection when question changes
      const qid = data.question?.id ?? null;
      if (qid !== lastQuestionIdRef.current) {
        lastQuestionIdRef.current = qid;
        setSelected(null);
        setErr(null);
      }
    } catch {}
  }

  async function fetchMyScore(quizId: string) {
    try {
      const res = await fetch(`/api/quiz/my-score?quiz_id=${quizId}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) setScore({ correct: data.correct, total: data.total });
    } catch {}
  }

  useEffect(() => {
    fetchState();
    const loop = () => {
      pollRef.current = setTimeout(async () => {
        await fetchState();
        loop();
      }, 1500);
    };
    loop();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (state?.quiz?.status === 'ended' && state.quiz.id) {
      fetchMyScore(state.quiz.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.quiz?.status, state?.quiz?.id]);

  // Pick an option (no API call — just visual selection)
  function pickOption(optionIdx: number) {
    if (state?.myResponse) return; // locked
    if (submitting) return;
    setSelected(optionIdx);
    setErr(null);
  }

  // Send the picked option to the server
  async function submitAnswer() {
    if (!state?.question) return;
    if (state.myResponse) return;
    if (selected === null) {
      setErr('Pick an option first.');
      return;
    }
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
      }
      await fetchState();
    } catch {
      setErr('Network error — try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // No quiz exists yet
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

  const { quiz, question, myResponse } = state;

  // Waiting / draft
  if (quiz.status === 'draft') {
    return (
      <div className="space-y-4">
        <Link href={backHref} className="link text-sm">
          <ChevronLeft size={12} className="inline" /> Back
        </Link>
        <div
          className="card text-center"
          style={{
            padding: '3.5rem 2rem',
            background: `radial-gradient(60% 50% at 50% 0%, rgba(79, 70, 229, 0.08), transparent 70%), var(--paper)`,
          }}
        >
          <Sparkles
            size={32}
            style={{ color: 'var(--accent)', margin: '0 auto 1rem' }}
          />
          <p className="font-display text-2xl font-bold">{quiz.title}</p>
          <p className="text-sm mt-2" style={{ color: 'var(--ink-500)' }}>
            Waiting for your mentor to start the quiz…
          </p>
          <div
            className="inline-block mt-4 px-3 py-1 rounded-full text-xs"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 animate-pulse"
              style={{background:'var(--accent)'}} />
            Stand by
          </div>
        </div>
      </div>
    );
  }

  // Ended view
  if (quiz.status === 'ended') {
    const pct = score && score.total > 0
      ? ((score.correct / score.total) * 100).toFixed(0)
      : null;
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
          <p className="font-display text-3xl font-bold">Quiz complete</p>
          {score && (
            <>
              <p className="font-display text-5xl font-bold mt-4" style={{ color: 'var(--accent)' }}>
                {score.correct} / {score.total}
              </p>
              {pct && (
                <p className="text-sm mt-2" style={{ color: 'var(--ink-500)' }}>
                  {pct}% correct
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="empty">
        <p>The quiz is starting…</p>
      </div>
    );
  }

  const reveal = quiz.reveal_answer;
  const myAnswer = myResponse?.selected_option;
  const correctOpt = reveal ? question.correct_option : undefined;

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href={backHref} className="link text-sm">
          <ChevronLeft size={12} className="inline" /> Leave
        </Link>
        <div className="text-xs" style={{ color: 'var(--ink-500)' }}>
          <span className="font-mono font-semibold" style={{ color: 'var(--accent)' }}>
            Q{quiz.current_question_index + 1}
          </span>
          {' '}of {quiz.total_questions} · {internshipTitle}
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
            width: `${((quiz.current_question_index + 1) / quiz.total_questions) * 100}%`,
            background: 'var(--accent)',
          }}
        />
      </div>

      {/* Question card with animation key for re-mount on change */}
      <div
        key={question.id}
        className="card card-elevated quiz-fade-in"
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
          const submittedThis = myAnswer === i;
          const pickedThis = !myResponse && selected === i;
          const isCorrect = reveal && correctOpt === i;
          const isWrongMine = reveal && submittedThis && correctOpt !== i;
          const disabled = !!myResponse || submitting;

          let bg = 'var(--paper)';
          let border = 'var(--ink-200)';
          let color = 'var(--ink-900)';

          if (isCorrect) {
            bg = 'var(--green-soft)';
            border = 'var(--green-500)';
            color = 'var(--green-700)';
          } else if (isWrongMine) {
            bg = 'var(--red-soft)';
            border = 'var(--red-500)';
            color = 'var(--red-700)';
          } else if (submittedThis) {
            // Locked-in answer (waiting for reveal)
            bg = 'var(--accent-soft)';
            border = 'var(--accent)';
            color = 'var(--accent)';
          } else if (pickedThis) {
            // Currently picked but not yet submitted — solid accent fill
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
                border: `1.5px solid ${border}`,
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
                animation: `quizSlideIn 350ms ease-out ${i * 80}ms backwards`,
              }}
            >
              <span
                className="w-9 h-9 rounded-md flex items-center justify-center font-mono font-bold shrink-0"
                style={{
                  background: isCorrect
                    ? 'var(--green-500)'
                    : isWrongMine
                      ? 'var(--red-500)'
                      : pickedThis
                        ? 'white'
                        : submittedThis
                          ? 'var(--accent)'
                          : 'var(--ink-100)',
                  color: pickedThis
                    ? 'var(--accent)'
                    : isCorrect || isWrongMine || submittedThis
                      ? 'white'
                      : 'var(--ink-700)',
                }}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span
                className="font-medium text-base flex-1"
                style={{ color: 'inherit' }}
              >
                {opt}
              </span>
              {isCorrect && <CheckCircle2 size={20} />}
              {isWrongMine && <XCircle size={20} />}
            </button>
          );
        })}
      </div>

      {/* Submit Answer button — visible until the answer is locked in */}
      {!myResponse && !reveal && (
        <div
          className="card"
          style={{ position: 'sticky', bottom: 12, padding: '0.85rem 1rem' }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p
              className="text-sm"
              style={{ color: 'var(--ink-500)' }}
            >
              {selected === null ? (
                <>👆 Pick an option above</>
              ) : (
                <>
                  Selected:{' '}
                  <span
                    className="font-mono font-semibold"
                    style={{ color: 'var(--accent)' }}
                  >
                    {String.fromCharCode(65 + selected)}
                  </span>{' '}
                  — change it any time before submitting.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={submitAnswer}
              disabled={selected === null || submitting}
              className="btn btn-primary"
              style={{
                opacity: selected === null || submitting ? 0.5 : 1,
              }}
            >
              {submitting ? 'Submitting…' : 'Submit answer'}
            </button>
          </div>
        </div>
      )}

      {/* Footer state */}
      {myResponse && !reveal && (
        <div
          className="text-center text-sm flex items-center justify-center gap-2"
          style={{ color: 'var(--accent)' }}
        >
          <Clock size={14} /> Answer submitted. Waiting for the mentor to reveal the answer…
        </div>
      )}
      {reveal && myResponse && (
        <div
          className={`text-center font-display text-lg font-bold ${myResponse.is_correct ? '' : ''}`}
          style={{
            color: myResponse.is_correct
              ? 'var(--green-700)'
              : 'var(--red-700)',
          }}
        >
          {myResponse.is_correct ? '✓ Correct!' : '✗ Not quite'}
        </div>
      )}
      {reveal && !myResponse && (
        <p className="text-center text-sm" style={{ color: 'var(--ink-500)' }}>
          You didn&apos;t answer this one.
        </p>
      )}

      {err && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-md text-sm"
          style={{ background: 'var(--red-soft)', color: 'var(--red-700)' }}
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <style jsx>{`
        @keyframes quizSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .quiz-fade-in {
          animation: quizFadeIn 350ms ease-out;
        }
        @keyframes quizFadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .quiz-option:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </div>
  );
}
