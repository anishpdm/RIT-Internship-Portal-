'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Plus,
  Trash2,
  GripVertical,
  Play,
  AlertCircle,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface Question {
  id: string;
  order_index: number;
  question_text: string;
  options: string[];
  correct_option: number;
  time_limit_seconds: number;
  isNew?: boolean;
  isDirty?: boolean;
}

export default function QuizBuilder({
  quizId,
  initialQuestions,
  runHref,
}: {
  quizId: string;
  initialQuestions: Question[];
  runHref: string;
}) {
  const supabase = createClient();
  const [questions, setQuestions] = useState<Question[]>(
    initialQuestions.length > 0 ? initialQuestions : [],
  );
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function newQuestion(): Question {
    return {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      order_index: questions.length,
      question_text: '',
      options: ['', '', '', ''],
      correct_option: 0,
      time_limit_seconds: 30,
      isNew: true,
      isDirty: true,
    };
  }

  function patch(idx: number, p: Partial<Question>) {
    setQuestions((qs) =>
      qs.map((q, i) => (i === idx ? { ...q, ...p, isDirty: true } : q)),
    );
  }

  function setOption(qIdx: number, oIdx: number, value: string) {
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = [...q.options];
        opts[oIdx] = value;
        return { ...q, options: opts, isDirty: true };
      }),
    );
  }

  function move(idx: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= qs.length) return qs;
      const next = [...qs];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next.map((q, i) => ({ ...q, order_index: i, isDirty: true }));
    });
  }

  function remove(idx: number) {
    setQuestions((qs) =>
      qs.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order_index: i })),
    );
  }

  async function saveAll() {
    setBusy(true);
    setMsg(null);
    try {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const payload = {
          quiz_id: quizId,
          order_index: i,
          question_text: q.question_text.trim(),
          options: q.options.map((o) => o.trim()),
          correct_option: q.correct_option,
          time_limit_seconds: q.time_limit_seconds,
        };

        if (!payload.question_text) {
          throw new Error(`Question ${i + 1} is empty`);
        }
        if (payload.options.some((o) => !o)) {
          throw new Error(`Question ${i + 1} has empty option(s)`);
        }

        if (q.isNew) {
          const { error } = await supabase.from('quiz_questions').insert(payload);
          if (error) throw error;
        } else if (q.isDirty) {
          const { error } = await supabase
            .from('quiz_questions')
            .update(payload)
            .eq('id', q.id);
          if (error) throw error;
        }
      }

      // Delete questions that were in initialQuestions but no longer in state
      const currentIds = new Set(questions.filter((q) => !q.isNew).map((q) => q.id));
      const toDelete = initialQuestions
        .map((q) => q.id)
        .filter((id) => !currentIds.has(id));

      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('quiz_questions')
          .delete()
          .in('id', toDelete);
        if (error) throw error;
      }

      setMsg({ type: 'ok', text: 'Saved.' });
      // Reload to refresh server-side state
      window.location.reload();
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message ?? 'Save failed' });
    } finally {
      setBusy(false);
    }
  }

  async function startQuiz() {
    if (questions.length === 0) {
      setMsg({ type: 'err', text: 'Add at least one question first.' });
      return;
    }
    if (questions.some((q) => q.isDirty || q.isNew)) {
      setMsg({ type: 'err', text: 'Save changes before starting.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/quiz/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_id: quizId, action: 'start' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to start');
      }
      window.location.href = runHref;
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.message ?? 'Failed' });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => (
        <div key={q.id} className="card">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex flex-col items-center gap-1 pt-1">
              <GripVertical
                size={16}
                style={{ color: 'var(--ink-300)' }}
              />
              <span
                className="text-xs font-mono font-semibold"
                style={{ color: 'var(--ink-500)' }}
              >
                Q{idx + 1}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <label className="field-label">Question</label>
              <textarea
                value={q.question_text}
                onChange={(e) => patch(idx, { question_text: e.target.value })}
                className="field"
                rows={2}
                placeholder="What is the time complexity of binary search?"
              />
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => move(idx, -1)}
                className="btn btn-ghost p-1"
                disabled={idx === 0}
                title="Move up"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                className="btn btn-ghost p-1"
                disabled={idx === questions.length - 1}
                title="Move down"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="btn btn-ghost p-1"
                style={{ color: 'var(--red-700)' }}
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <p className="field-label">Options · select the correct one</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {q.options.map((opt, oIdx) => (
              <label
                key={oIdx}
                className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer"
                style={{
                  background:
                    q.correct_option === oIdx ? 'var(--green-soft)' : 'transparent',
                  border: `1px solid ${q.correct_option === oIdx ? 'var(--green-500)' : 'var(--ink-200)'}`,
                }}
              >
                <input
                  type="radio"
                  name={`correct-${q.id}`}
                  checked={q.correct_option === oIdx}
                  onChange={() => patch(idx, { correct_option: oIdx })}
                />
                <span
                  className="font-mono text-xs"
                  style={{ color: 'var(--ink-500)' }}
                >
                  {String.fromCharCode(65 + oIdx)}
                </span>
                <input
                  value={opt}
                  onChange={(e) => setOption(idx, oIdx, e.target.value)}
                  className="field flex-1"
                  style={{ background: 'white' }}
                  placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                />
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-3">
            <label className="text-xs flex items-center gap-2" style={{ color: 'var(--ink-500)' }}>
              Time limit (sec):
              <input
                type="number"
                value={q.time_limit_seconds}
                onChange={(e) =>
                  patch(idx, {
                    time_limit_seconds: parseInt(e.target.value || '30', 10),
                  })
                }
                min={5}
                max={300}
                className="field font-mono"
                style={{ width: 80 }}
              />
            </label>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setQuestions((qs) => [...qs, newQuestion()])}
        className="btn btn-secondary w-full"
      >
        <Plus size={14} /> Add question
      </button>

      {msg && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-md text-sm"
          style={{
            background: msg.type === 'ok' ? 'var(--green-soft)' : 'var(--red-soft)',
            color: msg.type === 'ok' ? 'var(--green-700)' : 'var(--red-700)',
          }}
        >
          {msg.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={saveAll}
          disabled={busy}
          className="btn btn-secondary"
        >
          {busy ? 'Saving…' : 'Save questions'}
        </button>
        <button
          type="button"
          onClick={startQuiz}
          disabled={busy}
          className="btn btn-primary"
        >
          <Play size={14} /> Start live quiz
        </button>
      </div>
    </div>
  );
}
