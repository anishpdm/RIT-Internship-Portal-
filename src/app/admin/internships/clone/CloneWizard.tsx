'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Check, Video, BookOpen,
  HelpCircle, Calendar, Copy, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cloneInternship, type ContentConfig } from './actions';

interface Internship {
  id: string; title: string; status: string;
  start_date: string | null; end_date: string | null; total_levels: number;
}

interface SourceContent {
  sessions: Array<{
    id: string; title: string; session_type: string;
    scheduled_at: string | null; recording_url: string | null;
    day_number: number;
  }>;
  assignments: Array<{
    id: string; title: string; kind: string; due_at: string | null;
    max_score: number; weight: number; day_number: number;
  }>;
  quizzes: Array<{
    id: string; title: string; session_id: string; question_count: number;
    starts_at: string | null;
  }>;
}

function dayNum(date: string | null, startDate: string | null): number {
  if (!date || !startDate) return 0;
  const d = new Date(date).getTime();
  const s = new Date(startDate).getTime();
  return Math.max(1, Math.round((d - s) / 86400000) + 1);
}

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STEPS = ['Choose source', 'Select content', 'Set details', 'Review & create'];

export default function CloneWizard({ internships }: { internships: Internship[] }) {
  const [step, setStep] = useState(0);
  const [sourceId, setSourceId] = useState('');
  const [content, setContent] = useState<SourceContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1, 2, 3]));

  // Selection state
  const [selSessions, setSelSessions] = useState<Set<string>>(new Set());
  const [selAssignments, setSelAssignments] = useState<Set<string>>(new Set());
  const [selQuizzes, setSelQuizzes] = useState<Set<string>>(new Set());

  // New internship details
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newStatus, setNewStatus] = useState('draft');
  const [newLevels, setNewLevels] = useState(3);

  const source = internships.find(i => i.id === sourceId);

  // Fetch source content when selected
  const fetchContent = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/internship-content/${id}`);
      const data: SourceContent = await res.json();
      setContent(data);
      // Select all by default
      setSelSessions(new Set(data.sessions.map((s: any) => s.id)));
      setSelAssignments(new Set(data.assignments.map((a: any) => a.id)));
      setSelQuizzes(new Set(data.quizzes.map((q: any) => q.id)));
    } catch (e) {
      setError('Failed to load content. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sourceId) {
      fetchContent(sourceId);
      const src = internships.find(i => i.id === sourceId);
      if (src) {
        setNewTitle(`${src.title} (Copy)`);
        setNewLevels(src.total_levels);
      }
    }
  }, [sourceId, fetchContent, internships]);

  // Group content by day
  const dayMap = new Map<number, {
    sessions: any[];
    assignments: any[];
    quizzes: any[];
  }>();
  if (content) {
    const allDays = new Set([
      ...content.sessions.map((s: any) => s.day_number),
      ...content.assignments.map((a: any) => a.day_number),
      0,
    ]);
    for (const day of Array.from(allDays).sort((a, b) => a - b)) {
      dayMap.set(day, {
        sessions: content!.sessions.filter((s: any) => s.day_number === day),
        assignments: content!.assignments.filter((a: any) => a.day_number === day),
        quizzes: content!.quizzes.filter((q: any) =>
          content!.sessions.filter((s: any) => s.day_number === day).some((s: any) => s.id === q.session_id)
        ),
      });
    }
  }

  function toggleAll(on: boolean) {
    if (!content) return;
    setSelSessions(on ? new Set(content!.sessions.map((s: any) => s.id)) : new Set());
    setSelAssignments(on ? new Set(content!.assignments.map((a: any) => a.id)) : new Set());
    setSelQuizzes(on ? new Set(content!.quizzes.map((q: any) => q.id)) : new Set());
  }

  function toggleDay(day: number, on: boolean) {
    const d = dayMap.get(day);
    if (!d) return;
    const sIds = d.sessions.map((s: any) => s.id);
    const aIds = d.assignments.map((a: any) => a.id);
    const qIds = d.quizzes.map((q: any) => q.id);
    setSelSessions(prev => {
      const n = new Set(prev);
      sIds.forEach(id => on ? n.add(id) : n.delete(id));
      return n;
    });
    setSelAssignments(prev => {
      const n = new Set(prev);
      aIds.forEach(id => on ? n.add(id) : n.delete(id));
      return n;
    });
    setSelQuizzes(prev => {
      const n = new Set(prev);
      qIds.forEach(id => on ? n.add(id) : n.delete(id));
      return n;
    });
  }

  async function handleCreate() {
    if (!sourceId || !newTitle || !newStart) {
      setError('Title and start date are required.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const config: ContentConfig = {
        sessions: Array.from(selSessions),
        assignments: Array.from(selAssignments),
        quizzes: Array.from(selQuizzes),
      };
      await cloneInternship({
        sourceId, title: newTitle, description: newDesc,
        startDate: newStart, endDate: newEnd, totalLevels: newLevels,
        status: newStatus, config,
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to create internship');
      setCreating(false);
    }
  }

  const canNext = [
    !!sourceId && !loading,
    true,
    !!newTitle && !!newStart,
    true,
  ];

  return (
    <div className="fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/internships" className="btn btn-ghost" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="eyebrow mb-0.5">Admin</p>
          <h1 className="page-title">Clone internship</h1>
          <p className="page-subtitle">
            Copy an existing program's content into a new cohort. Dates shift automatically.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                style={{
                  background: i < step ? 'var(--green-500)' : i === step ? 'var(--accent)' : 'var(--ink-200)',
                  color: i <= step ? 'white' : 'var(--ink-500)',
                }}
              >
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span className="text-xs font-semibold hidden sm:block"
                style={{ color: i === step ? 'var(--accent)' : 'var(--ink-500)' }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-2"
                style={{ background: i < step ? 'var(--green-500)' : 'var(--ink-200)' }} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="card mb-4 text-sm" style={{ background: 'var(--red-soft)', color: 'var(--red-700)', borderColor: 'var(--red-500)' }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Step 0: Choose source ── */}
      {step === 0 && (
        <div className="card space-y-5">
          <div>
            <p className="eyebrow mb-3">Select source internship</p>
            <p className="text-sm mb-4" style={{ color: 'var(--ink-500)' }}>
              Choose the internship whose sessions, assignments, and quizzes you want to copy.
              All dates will be shifted relative to the new start date you set.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {internships.map(i => (
                <button key={i.id} onClick={() => setSourceId(i.id)}
                  className="p-4 rounded-xl text-left transition-all"
                  style={{
                    border: `2px solid ${sourceId === i.id ? 'var(--accent)' : 'var(--ink-200)'}`,
                    background: sourceId === i.id ? 'var(--accent-soft)' : 'white',
                  }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm">{i.title}</p>
                    {sourceId === i.id && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'var(--accent)' }}>
                        <Check size={11} style={{ color: 'white' }} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="pill" style={{ fontSize: '.65rem' }}>{i.status}</span>
                    <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
                      {i.total_levels} levels · {fmt(i.start_date)} → {fmt(i.end_date)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {sourceId && !loading && content && (
            <div className="rounded-xl p-4" style={{ background: 'var(--green-soft)', border: '1px solid rgba(16,185,129,.2)' }}>
              <p className="font-semibold text-sm" style={{ color: 'var(--green-700)' }}>
                ✓ Found {content.sessions.length} sessions · {content.assignments.length} assignments · {content.quizzes.length} quizzes
              </p>
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-500)' }}>
              <Loader2 size={14} className="animate-spin" /> Loading content…
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Select content ── */}
      {step === 1 && content && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="eyebrow">Day-by-day content from "{source?.title}"</p>
            <div className="flex gap-2">
              <button onClick={() => toggleAll(true)} className="btn btn-ghost" style={{ fontSize: '.8rem' }}>Select all</button>
              <button onClick={() => toggleAll(false)} className="btn btn-ghost" style={{ fontSize: '.8rem' }}>Clear all</button>
            </div>
          </div>

          <div className="space-y-3">
            {Array.from(dayMap.entries()).sort(([a], [b]) => a - b).map(([day, items]) => {
              const totalItems = items.sessions.length + items.assignments.length + items.quizzes.length;
              if (totalItems === 0) return null;
              const daySelected = [
                ...items.sessions.map((s: any) => selSessions.has(s.id)),
                ...items.assignments.map(a => selAssignments.has(a.id)),
                ...items.quizzes.map(q => selQuizzes.has(q.id)),
              ].filter(Boolean).length;
              const allDaySelected = daySelected === totalItems;
              const expanded = expandedDays.has(day);

              return (
                <div key={day} className="card p-0 overflow-hidden">
                  {/* Day header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    style={{ background: 'var(--ink-50)', borderBottom: expanded ? '1px solid var(--ink-200)' : 'none' }}
                    onClick={() => {
                      setExpandedDays(prev => {
                        const n = new Set(prev);
                        expanded ? n.delete(day) : n.add(day);
                        return n;
                      });
                    }}
                  >
                    <input type="checkbox" checked={allDaySelected}
                      onChange={e => { e.stopPropagation(); toggleDay(day, e.target.checked); }}
                      onClick={e => e.stopPropagation()}
                      style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                    />
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 text-white"
                      style={{ background: 'linear-gradient(135deg,var(--accent),#818cf8)' }}>
                      {day === 0 ? '—' : day}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        {day === 0 ? 'No date assigned' : `Day ${day}`}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                        {totalItems} item{totalItems !== 1 ? 's' : ''} · {daySelected} selected
                      </p>
                    </div>
                    {expanded ? <ChevronDown size={14} style={{ color: 'var(--ink-400)' }}/> : <ChevronRight size={14} style={{ color: 'var(--ink-400)' }}/>}
                  </div>

                  {/* Day content */}
                  {expanded && (
                    <div className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
                      {items.sessions.map((s: any) => {
                        const checked = selSessions.has(s.id);
                        const qz = items.quizzes.filter(q => q.session_id === s.id);
                        return (
                          <div key={s.id}>
                            <label className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50">
                              <input type="checkbox" checked={checked}
                                onChange={e => {
                                  setSelSessions(prev => {
                                    const n = new Set(prev);
                                    e.target.checked ? n.add(s.id) : n.delete(s.id);
                                    return n;
                                  });
                                }}
                                style={{ marginTop: 2, width: 15, height: 15, accentColor: 'var(--accent)' }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Video size={13} style={{ color: 'var(--accent)', flexShrink: 0 }}/>
                                  <p className="font-medium text-sm">{s.title}</p>
                                  <span className="pill" style={{ fontSize: '.6rem' }}>{s.session_type.replace('_',' ')}</span>
                                  {s.recording_url && (
                                    <span className="pill pill-green" style={{ fontSize: '.6rem' }}>🎬 Recording</span>
                                  )}
                                </div>
                                {s.scheduled_at && (
                                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-500)' }}>
                                    {new Date(s.scheduled_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  </p>
                                )}
                              </div>
                            </label>
                            {/* Quizzes attached to this session */}
                            {qz.map(q => (
                              <label key={q.id} className="flex items-start gap-3 pl-10 pr-4 py-2 cursor-pointer hover:bg-slate-50"
                                style={{ background: 'rgba(99,102,241,.02)' }}>
                                <input type="checkbox" checked={selQuizzes.has(q.id)}
                                  disabled={!selSessions.has(s.id)}
                                  onChange={e => {
                                    setSelQuizzes(prev => {
                                      const n = new Set(prev);
                                      e.target.checked ? n.add(q.id) : n.delete(q.id);
                                      return n;
                                    });
                                  }}
                                  style={{ marginTop: 2, width: 14, height: 14, accentColor: 'var(--accent)' }}
                                />
                                <div className="flex items-center gap-2 flex-wrap">
                                  <HelpCircle size={12} style={{ color: '#f59e0b', flexShrink: 0 }}/>
                                  <p className="text-xs font-medium">{q.title}</p>
                                  <span className="pill pill-amber" style={{ fontSize: '.6rem' }}>{q.question_count} questions</span>
                                  {!selSessions.has(s.id) && (
                                    <span className="text-[10px]" style={{ color: 'var(--ink-400)' }}>requires session above</span>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        );
                      })}

                      {items.assignments.map(a => (
                        <label key={a.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" checked={selAssignments.has(a.id)}
                            onChange={e => {
                              setSelAssignments(prev => {
                                const n = new Set(prev);
                                e.target.checked ? n.add(a.id) : n.delete(a.id);
                                return n;
                              });
                            }}
                            style={{ marginTop: 2, width: 15, height: 15, accentColor: 'var(--accent)' }}
                          />
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                            <BookOpen size={13} style={{ color: '#10b981', flexShrink: 0 }}/>
                            <p className="font-medium text-sm truncate">{a.title}</p>
                            <span className="pill pill-green" style={{ fontSize: '.6rem' }}>{a.kind}</span>
                            <span className="text-xs" style={{ color: 'var(--ink-500)' }}>{a.max_score} pts · w{a.weight}</span>
                            {a.due_at && (
                              <span className="text-xs" style={{ color: 'var(--ink-400)' }}>due {fmt(a.due_at)}</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 rounded-xl text-sm" style={{ background: 'var(--accent-soft)', color: 'var(--ink-700)' }}>
            Selected: <strong>{selSessions.size}</strong> sessions · <strong>{selAssignments.size}</strong> assignments · <strong>{selQuizzes.size}</strong> quizzes
          </div>
        </div>
      )}

      {/* ── Step 2: Set details ── */}
      {step === 2 && (
        <div className="card space-y-5">
          <p className="eyebrow">New internship details</p>
          <div>
            <label className="field-label">Title</label>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
              className="field" placeholder="e.g. AI/ML Batch 2 — June 2026" required />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
              className="field" rows={3} placeholder="Optional — describe this cohort" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Start date <span style={{ color: 'var(--red-500)' }}>*</span></label>
              <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)}
                className="field" required />
              <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
                All session & assignment dates shift from this date
              </p>
            </div>
            <div>
              <label className="field-label">End date</label>
              <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                className="field" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Levels</label>
              <input type="number" min={1} max={10} value={newLevels}
                onChange={e => setNewLevels(Number(e.target.value))}
                className="field font-mono" />
            </div>
            <div>
              <label className="field-label">Status</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="field">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>
          </div>

          {source && newStart && (
            <div className="rounded-xl p-4" style={{ background: 'var(--amber-soft)', border: '1px solid rgba(245,158,11,.2)' }}>
              <p className="font-semibold text-xs mb-1" style={{ color: 'var(--amber-700)' }}>📅 Date shift preview</p>
              <p className="text-xs" style={{ color: 'var(--amber-700)' }}>
                Source started {fmt(source.start_date)} → new starts {fmt(newStart)}.{' '}
                {(() => {
                  const src = source.start_date ? new Date(source.start_date) : null;
                  const dst = new Date(newStart);
                  if (!src) return 'No shift needed.';
                  const days = Math.round((dst.getTime() - src.getTime()) / 86400000);
                  return days === 0
                    ? 'Same dates — no shift.'
                    : `All dates shift ${days > 0 ? '+' : ''}${days} days.`;
                })()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card" style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
            <p className="eyebrow mb-3">Ready to create</p>
            <div className="space-y-2 text-sm">
              <p><strong>Title:</strong> {newTitle}</p>
              <p><strong>Dates:</strong> {fmt(newStart)} → {fmt(newEnd)}</p>
              <p><strong>Levels:</strong> {newLevels} · <strong>Status:</strong> {newStatus}</p>
              <p><strong>Copied from:</strong> {source?.title}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: '🎬', label: 'Sessions', count: selSessions.size, color: '#6366f1' },
              { icon: '📝', label: 'Assignments', count: selAssignments.size, color: '#10b981' },
              { icon: '❓', label: 'Quizzes', count: selQuizzes.size, color: '#f59e0b' },
            ].map(item => (
              <div key={item.label} className="card text-center" style={{ borderTop: `3px solid ${item.color}` }}>
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className="font-bold text-xl" style={{ color: item.color }}>{item.count}</p>
                <p className="stat-label">{item.label}</p>
              </div>
            ))}
          </div>

          {selSessions.size === 0 && selAssignments.size === 0 && (
            <div className="card text-sm" style={{ background: 'var(--amber-soft)', color: 'var(--amber-700)' }}>
              ⚠ No content selected. The new internship will be created empty.
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : undefined}
          className="btn btn-ghost"
          disabled={step === 0}
        >
          <ArrowLeft size={14}/> Back
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="btn btn-primary"
            disabled={!canNext[step]}
          >
            Next <ArrowRight size={14}/>
          </button>
        ) : (
          <button
            onClick={handleCreate}
            className="btn btn-primary"
            disabled={creating}
          >
            {creating ? (
              <><Loader2 size={14} className="animate-spin"/> Creating…</>
            ) : (
              <><Copy size={14}/> Create internship</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
