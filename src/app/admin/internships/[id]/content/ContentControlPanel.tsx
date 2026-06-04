'use client';

import { useState, useTransition } from 'react';
import {
  Eye, EyeOff, Video, BookOpen, HelpCircle,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight,
  Copy, Check,
} from 'lucide-react';
import { toggleVisibility, bulkToggle } from './actions';

interface Quiz {
  id: string; title: string; session_id: string;
  is_hidden: boolean; cloned_from: string | null;
  status: string; quiz_questions: { id: string }[];
}
interface Session {
  id: string; title: string; session_type: string;
  scheduled_at: string | null; recording_url: string | null;
  is_hidden: boolean; cloned_from: string | null;
  status: string; duration_minutes: number | null;
  quizzes: Quiz[];
}
interface Assignment {
  id: string; title: string; kind: string;
  due_at: string | null; max_score: number; weight: number;
  is_hidden: boolean; cloned_from: string | null;
}

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtTime(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function VisibilityToggle({
  id, table, hidden, label, onToggle,
}: {
  id: string; table: string; hidden: boolean; label?: string; onToggle: (id: string, hidden: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !hidden;
    onToggle(id, next);
    startTransition(async () => {
      await toggleVisibility({ id, table, hidden: next });
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all"
      style={{
        background: hidden ? 'var(--ink-100)' : 'var(--green-soft)',
        color: hidden ? 'var(--ink-500)' : 'var(--green-700)',
        border: `1.5px solid ${hidden ? 'var(--ink-200)' : 'rgba(16,185,129,.3)'}`,
        opacity: pending ? 0.6 : 1,
        minWidth: 90,
      }}
    >
      {hidden ? <EyeOff size={11} /> : <Eye size={11} />}
      {hidden ? 'Hidden' : 'Visible'}
    </button>
  );
}

export default function ContentControlPanel({
  internshipId,
  sessions: initialSessions,
  assignments: initialAssignments,
  isCloned,
}: {
  internshipId: string;
  sessions: Session[];
  assignments: Assignment[];
  isCloned: boolean;
}) {
  const [sessions, setSessions]       = useState<Session[]>(initialSessions);
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();

  // Optimistic toggle helpers
  function toggleSession(id: string, hidden: boolean) {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, is_hidden: hidden } : s));
  }
  function toggleAssignment(id: string, hidden: boolean) {
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, is_hidden: hidden } : a));
  }
  function toggleQuiz(sessionId: string, quizId: string, hidden: boolean) {
    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? { ...s, quizzes: s.quizzes.map(q => q.id === quizId ? { ...q, is_hidden: hidden } : q) }
        : s
    ));
  }

  // Bulk actions
  function handleBulk(type: 'sessions' | 'assignments' | 'quizzes', hidden: boolean) {
    startBulkTransition(async () => {
      const ids = type === 'sessions'
        ? sessions.map(s => s.id)
        : type === 'assignments'
          ? assignments.map(a => a.id)
          : sessions.flatMap(s => s.quizzes.map(q => q.id));
      const table = type === 'sessions' ? 'sessions' : type === 'assignments' ? 'assignments' : 'quizzes';
      if (!ids.length) return;
      await bulkToggle({ ids, table, hidden });
      if (type === 'sessions') setSessions(prev => prev.map(s => ({ ...s, is_hidden: hidden })));
      if (type === 'assignments') setAssignments(prev => prev.map(a => ({ ...a, is_hidden: hidden })));
      if (type === 'quizzes')
        setSessions(prev => prev.map(s => ({ ...s, quizzes: s.quizzes.map(q => ({ ...q, is_hidden: hidden })) })));
    });
  }

  const hiddenSessions    = sessions.filter(s => s.is_hidden).length;
  const hiddenAssignments = assignments.filter(a => a.is_hidden).length;
  const allQuizzes        = sessions.flatMap(s => s.quizzes);
  const hiddenQuizzes     = allQuizzes.filter(q => q.is_hidden).length;

  // Stats bar
  function StatChip({ label, visible, total, color }: { label: string; visible: number; total: number; color: string }) {
    return (
      <div className="card flex-1 p-3" style={{ borderTop: `3px solid ${color}` }}>
        <p className="stat-label">{label}</p>
        <p className="font-bold text-xl mt-1" style={{ color }}>
          {visible}<span className="text-sm font-normal" style={{ color: 'var(--ink-400)' }}>/{total}</span>
        </p>
        <p className="text-xs" style={{ color: 'var(--ink-500)' }}>visible to students</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <StatChip label="Sessions"    visible={sessions.length - hiddenSessions}       total={sessions.length}     color="#6366f1" />
        <StatChip label="Assignments" visible={assignments.length - hiddenAssignments} total={assignments.length}  color="#10b981" />
        <StatChip label="Quizzes"     visible={allQuizzes.length - hiddenQuizzes}       total={allQuizzes.length}  color="#f59e0b" />
      </div>

      {/* ── SESSIONS ────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden mb-5">
        <div className="flex items-center gap-3 px-5 py-3.5"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.07),transparent)', borderBottom: '1px solid var(--ink-100)' }}>
          <Video size={16} style={{ color: 'var(--accent)' }} />
          <p className="font-display font-bold">Sessions ({sessions.length})</p>
          <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
            {hiddenSessions} hidden
          </span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => handleBulk('sessions', false)} disabled={bulkPending}
              className="btn btn-ghost" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}>
              <Eye size={11} /> Show all
            </button>
            <button onClick={() => handleBulk('sessions', true)} disabled={bulkPending}
              className="btn btn-ghost" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}>
              <EyeOff size={11} /> Hide all
            </button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: 'var(--ink-500)' }}>No sessions yet.</p>
        ) : (
          <div>
            {sessions.map((s, idx) => {
              const expanded = expandedSessions.has(s.id);
              const hasQuizzes = s.quizzes.length > 0;
              return (
                <div key={s.id} style={{ borderBottom: idx < sessions.length - 1 ? '1px solid var(--ink-100)' : 'none' }}>
                  <div
                    className="flex items-center gap-3 px-5 py-3"
                    style={{ background: s.is_hidden ? 'rgba(248,250,252,0.8)' : 'white', opacity: s.is_hidden ? 0.75 : 1 }}
                  >
                    {/* Expand for quizzes */}
                    <button
                      onClick={() => {
                        setExpandedSessions(prev => {
                          const n = new Set(prev);
                          expanded ? n.delete(s.id) : n.add(s.id);
                          return n;
                        });
                      }}
                      style={{ color: hasQuizzes ? 'var(--accent)' : 'var(--ink-300)', width: 20 }}
                    >
                      {hasQuizzes
                        ? expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        : <span style={{ display: 'inline-block', width: 14 }} />}
                    </button>

                    {/* Session info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{s.title}</p>
                        <span className="pill" style={{ fontSize: '.6rem' }}>{s.session_type.replace('_', ' ')}</span>
                        {s.recording_url && (
                          <span className="pill pill-green" style={{ fontSize: '.6rem' }}>🎬 Recording</span>
                        )}
                        {isCloned && s.cloned_from && (
                          <span className="pill" style={{ fontSize: '.6rem', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                            <Copy size={8} /> Synced
                          </span>
                        )}
                        {hasQuizzes && (
                          <span className="pill pill-amber" style={{ fontSize: '.6rem' }}>
                            {s.quizzes.length} quiz
                          </span>
                        )}
                      </div>
                      {s.scheduled_at && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>
                          {fmt(s.scheduled_at)} · {fmtTime(s.scheduled_at)}
                          {s.duration_minutes && ` · ${s.duration_minutes} min`}
                        </p>
                      )}
                    </div>

                    {/* Visibility toggle */}
                    <VisibilityToggle
                      id={s.id} table="sessions"
                      hidden={s.is_hidden}
                      onToggle={toggleSession}
                    />
                  </div>

                  {/* Quiz rows under session */}
                  {expanded && s.quizzes.map(q => (
                    <div key={q.id}
                      className="flex items-center gap-3 pl-12 pr-5 py-2.5"
                      style={{
                        background: q.is_hidden ? 'rgba(255,251,235,0.7)' : 'rgba(255,251,235,0.4)',
                        borderTop: '1px solid rgba(245,158,11,.1)',
                        opacity: q.is_hidden ? 0.7 : 1,
                      }}>
                      <HelpCircle size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{q.title}</p>
                        <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                          {q.quiz_questions.length} questions · status: {q.status}
                          {isCloned && q.cloned_from && ' · synced'}
                        </p>
                      </div>
                      <VisibilityToggle
                        id={q.id} table="quizzes"
                        hidden={q.is_hidden}
                        onToggle={(id, hidden) => toggleQuiz(s.id, id, hidden)}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ASSIGNMENTS ──────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5"
          style={{ background: 'linear-gradient(135deg,rgba(16,185,129,.07),transparent)', borderBottom: '1px solid var(--ink-100)' }}>
          <BookOpen size={16} style={{ color: '#10b981' }} />
          <p className="font-display font-bold">Assignments ({assignments.length})</p>
          <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
            {hiddenAssignments} hidden
          </span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => handleBulk('assignments', false)} disabled={bulkPending}
              className="btn btn-ghost" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}>
              <Eye size={11} /> Show all
            </button>
            <button onClick={() => handleBulk('assignments', true)} disabled={bulkPending}
              className="btn btn-ghost" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }}>
              <EyeOff size={11} /> Hide all
            </button>
          </div>
        </div>

        {assignments.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: 'var(--ink-500)' }}>No assignments yet.</p>
        ) : (
          <div>
            {assignments.map((a, idx) => (
              <div key={a.id}
                className="flex items-center gap-3 px-5 py-3"
                style={{
                  background: a.is_hidden ? 'rgba(248,250,252,0.8)' : 'white',
                  borderBottom: idx < assignments.length - 1 ? '1px solid var(--ink-100)' : 'none',
                  opacity: a.is_hidden ? 0.75 : 1,
                }}>
                <div className="w-5" /> {/* spacer matching session expand btn */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">{a.title}</p>
                    <span className="pill pill-green" style={{ fontSize: '.6rem' }}>{a.kind}</span>
                    <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
                      {a.max_score} pts · w{a.weight}
                    </span>
                    {isCloned && a.cloned_from && (
                      <span className="pill" style={{ fontSize: '.6rem', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        <Copy size={8} /> Synced
                      </span>
                    )}
                  </div>
                  {a.due_at && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-400)' }}>
                      Due {fmt(a.due_at)}
                    </p>
                  )}
                </div>
                <VisibilityToggle
                  id={a.id} table="assignments"
                  hidden={a.is_hidden}
                  onToggle={toggleAssignment}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
