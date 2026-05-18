'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Star, Send, CheckCircle2, AlertCircle } from 'lucide-react';

function StarRow({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div>
      <p
        className="text-sm font-medium mb-2"
        style={{ color: 'var(--ink-700)' }}
      >
        {label}
      </p>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= display;
          return (
            <button
              key={n}
              type="button"
              onClick={() => !disabled && onChange(n)}
              onMouseEnter={() => !disabled && setHover(n)}
              disabled={disabled}
              className="p-1 transition-transform"
              style={{
                cursor: disabled ? 'default' : 'pointer',
                transform: active && !disabled ? 'scale(1.05)' : 'scale(1)',
              }}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
            >
              <Star
                size={28}
                fill={active ? '#eab308' : 'transparent'}
                style={{
                  color: active ? '#eab308' : 'var(--ink-300)',
                  transition: 'all 150ms',
                }}
              />
            </button>
          );
        })}
        {value > 0 && (
          <span
            className="text-sm self-center ml-2 font-mono"
            style={{ color: 'var(--ink-500)' }}
          >
            {value}/5
          </span>
        )}
      </div>
    </div>
  );
}

export default function FeedbackForm({
  assignmentId,
  existing,
}: {
  assignmentId: string;
  existing: {
    session_rating: number | null;
    trainer_rating: number | null;
    overall_rating: number | null;
    comment: string | null;
  } | null;
}) {
  const supabase = createClient();
  const [session, setSession] = useState(existing?.session_rating ?? 0);
  const [trainer, setTrainer] = useState(existing?.trainer_rating ?? 0);
  const [overall, setOverall] = useState(existing?.overall_rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(!!existing);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!session || !trainer || !overall) {
      setErr('Please rate all three: Session, Trainer, and Overall.');
      return;
    }
    setBusy(true);
    setErr(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setErr('Not signed in');
      setBusy(false);
      return;
    }

    const payload = {
      assignment_id: assignmentId,
      student_id: userData.user.id,
      session_rating: session || null,
      trainer_rating: trainer || null,
      overall_rating: overall || null,
      comment: comment.trim() || null,
    };

    const { error } = await supabase
      .from('assignment_feedback')
      .upsert(payload, { onConflict: 'assignment_id,student_id' });

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    setSaved(true);
    setBusy(false);
  }

  if (saved) {
    return (
      <div
        className="card"
        style={{
          background:
            'linear-gradient(135deg, var(--green-soft) 0%, rgba(16, 185, 129, 0.04) 100%)',
          borderColor: 'var(--green-500)',
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'var(--green-500)', color: 'white' }}
          >
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="font-display font-semibold">Thanks for your feedback!</p>
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              It helps your mentors improve future sessions.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Session', value: session },
            { label: 'Trainer', value: trainer },
            { label: 'Overall', value: overall },
          ].map(
            (s) =>
              s.value > 0 && (
                <div key={s.label}>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--ink-500)' }}
                  >
                    {s.label}
                  </p>
                  <p
                    className="font-display font-bold text-lg"
                    style={{ color: '#eab308' }}
                  >
                    {'★'.repeat(s.value)}
                    {'☆'.repeat(5 - s.value)}
                  </p>
                </div>
              ),
          )}
        </div>
        <button
          type="button"
          onClick={() => setSaved(false)}
          className="btn btn-ghost text-xs mt-3"
        >
          Edit response
        </button>
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        borderColor: 'var(--accent)',
        borderWidth: 2,
        background:
          'linear-gradient(135deg, var(--accent-soft) 0%, rgba(79, 70, 229, 0.02) 100%)',
      }}
      id="feedback-required"
    >
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <Star size={16} />
          </div>
          <div>
            <p className="font-display font-semibold">Feedback required</p>
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              Please rate today&apos;s session and trainer before leaving this page.
            </p>
          </div>
        </div>
        <span
          className="pill"
          style={{
            background: 'var(--red-soft)',
            color: 'var(--red-700)',
            fontWeight: 600,
          }}
        >
          Required
        </span>
      </div>

      <div className="space-y-5 mt-5">
        <StarRow
          label="How was the session?"
          value={session}
          onChange={setSession}
        />
        <StarRow
          label="How was the trainer?"
          value={trainer}
          onChange={setTrainer}
        />
        <StarRow
          label="Overall experience"
          value={overall}
          onChange={setOverall}
        />

        <div>
          <label
            className="text-sm font-medium mb-2 block"
            style={{ color: 'var(--ink-700)' }}
          >
            Anything else? (optional)
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What worked well, what could be better…"
            className="field"
          />
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

        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="btn btn-primary"
          >
            <Send size={14} /> {busy ? 'Submitting…' : 'Submit feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}
