'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Pill } from '@/components/ui';

interface Level { id: string; level_number: number; title: string | null; pass_threshold: number; }

interface Props {
  rows: any[];
  levels: Level[];
  levelScoreMap: Record<string, Record<number, any>>; // student_id → level_number → score
  totalSessions: number;
  totalAssignments: number;
  internshipId: string;
}

const COLORS = ['#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6','#F97316','#6366F1'];

function scoreColor(pct: number) {
  return pct >= 90 ? '#10B981' : pct >= 75 ? '#3B82F6' : pct >= 50 ? '#F59E0B' : '#EF4444';
}

function ini(name: string | null, email: string | null) {
  return (name ?? email ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function PerformanceTable({
  rows, levels, levelScoreMap, totalSessions, totalAssignments, internshipId,
}: Props) {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  const displayRows = useMemo(() => {
    if (!selectedLevel) return rows;
    return [...rows]
      .map(r => {
        const ls = levelScoreMap[r.student_id]?.[selectedLevel];
        const levelAssignment = ls?.level_score ?? 0;
        const quizPct = Number(r.quiz_score ?? 0);
        // Combined level score: 95% level assignments + 5% quiz
        const levelCombined = levelAssignment * 0.95 + quizPct * 0.05;
        return {
          ...r,
          _levelAssignment: levelAssignment,
          _levelScore: levelCombined,
          _reached: ls?.reached ?? false,
          _graded: ls?.graded_count ?? 0,
          _total: ls?.total_count ?? 0,
        };
      })
      .filter(r => r._reached)
      .sort((a, b) => b._levelScore - a._levelScore)
      .map((r, i, arr) => {
        let rank = 1;
        for (let j = 0; j < i; j++) if (arr[j]._levelScore !== r._levelScore) rank++;
        return { ...r, _rank: rank };
      });
  }, [selectedLevel, rows, levelScoreMap]);

  const lv = selectedLevel ? levels.find(l => l.level_number === selectedLevel) : null;

  return (
    <>
      {/* Level tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setSelectedLevel(null)}
          className="pill transition-all"
          style={!selectedLevel ? { background: 'var(--accent)', color: 'white', border: 'none' } : {}}>
          🏆 All levels
        </button>
        {levels.map(l => (
          <button key={l.level_number} onClick={() => setSelectedLevel(l.level_number)}
            className="pill transition-all"
            style={selectedLevel === l.level_number
              ? { background: 'linear-gradient(135deg,var(--accent),#818cf8)', color: 'white', border: 'none' }
              : {}}>
            L{l.level_number}{l.title ? ` · ${l.title}` : ''}
            <span className="ml-1 opacity-60 text-[10px]">
              ({rows.filter(r => levelScoreMap[r.student_id]?.[l.level_number]?.reached).length})
            </span>
          </button>
        ))}
      </div>

      {/* Level context */}
      {selectedLevel && lv && (
        <div className="rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2"
          style={{ background: 'rgba(99,102,241,.07)', border: '1px solid rgba(99,102,241,.2)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
            Level {selectedLevel}{lv.title ? ` — ${lv.title}` : ''} · score = 95% Level {selectedLevel} assignments + 5% quiz
          </span>
          <span className="ml-auto text-xs pill pill-accent">{displayRows.length} reached</span>
        </div>
      )}

      {displayRows.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
            {selectedLevel ? `No students have reached Level ${selectedLevel} yet.` : 'No students enrolled.'}
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 52 }}>#</th>
                <th>Student</th>
                <th>Level</th>
                {!selectedLevel && <th style={{ textAlign: 'right' }}>Assignments</th>}
                {!selectedLevel && <th style={{ textAlign: 'right' }}>Quiz</th>}
                {!selectedLevel && levels.length > 0 && <th style={{ textAlign: 'center', minWidth: 180 }}>Per-level</th>}
                {selectedLevel && <th style={{ textAlign: 'right' }}>Quiz (overall)</th>}
                {selectedLevel && <th style={{ textAlign: 'right' }}>Graded</th>}
                <th style={{ textAlign: 'right', minWidth: 130 }}>
                  {selectedLevel ? `L${selectedLevel} Score` : 'Combined ▾'}
                </th>
                <th style={{ textAlign: 'right' }}>Attendance</th>
                <th style={{ textAlign: 'right' }}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r: any, idx: number) => {
                const rank        = selectedLevel ? r._rank : r.rank;
                const score       = selectedLevel ? r._levelScore : r.combined;
                const sc          = scoreColor(score);
                const attended    = Number(r.attended_sessions ?? 0);
                const submitted   = Number(r.submitted_count ?? 0);
                const attPct      = totalSessions ? Math.round((attended / totalSessions) * 100) : 0;
                const subPct      = totalAssignments ? Math.round((submitted / totalAssignments) * 100) : 0;
                const aColor      = COLORS[idx % COLORS.length];
                const medalBg     = rank === 1 ? 'linear-gradient(135deg,#fbbf24,#f59e0b)'
                  : rank === 2 ? 'linear-gradient(135deg,#94a3b8,#64748b)'
                  : rank === 3 ? 'linear-gradient(135deg,#f97316,#ea580c)' : null;

                // Level score tiles
                const myLevelTiles = !selectedLevel ? Object.values(levelScoreMap[r.student_id] ?? {})
                  .sort((a: any, b: any) => a.level_number - b.level_number) : [];

                return (
                  <tr key={r.student_id}>
                    <td style={{ padding: '10px 12px' }}>
                      {medalBg ? (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm" style={{ background: medalBg }}>
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-sm" style={{ background: 'var(--ink-100)', color: 'var(--ink-600)' }}>
                          {rank}
                        </div>
                      )}
                    </td>

                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ background: aColor }}>
                          {ini(r.full_name, r.email)}
                        </div>
                        <div>
                          <Link href={`/admin/students/${r.student_id}`} className="link font-medium text-sm">{r.full_name ?? '—'}</Link>
                          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{r.email}</p>
                        </div>
                      </div>
                    </td>

                    <td>
                      <p className="font-mono text-sm font-bold">L{r.current_level}</p>
                      <Pill tone={r.status === 'active' ? 'blue' : r.status === 'filtered' ? 'red' : 'green'}>{r.status}</Pill>
                    </td>

                    {!selectedLevel && (
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-sm">{Number(r.total_score ?? 0).toFixed(1)}%</span>
                      </td>
                    )}

                    {!selectedLevel && (
                      <td style={{ textAlign: 'right' }}>
                        {(r.quiz_total ?? 0) > 0 ? (
                          <div>
                            <span className="font-mono text-sm">{Number(r.quiz_score ?? 0).toFixed(0)}%</span>
                            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{r.quiz_correct}/{r.quiz_total}</p>
                          </div>
                        ) : <span style={{ color: 'var(--ink-300)' }}>—</span>}
                      </td>
                    )}

                    {!selectedLevel && levels.length > 0 && (
                      <td style={{ textAlign: 'center' }}>
                        <div className="flex flex-wrap gap-1 justify-center">
                          {myLevelTiles.map((ls: any) => {
                            const lPct = ls.level_score ?? 0;
                            const passed = lPct >= (ls.pass_threshold ?? 60);
                            const locked = !ls.reached;
                            const lColor = locked ? '#94a3b8' : passed ? '#10b981' : lPct >= (ls.pass_threshold ?? 60) * 0.75 ? '#f59e0b' : '#ef4444';
                            return (
                              <div key={ls.level_number}
                                title={`L${ls.level_number}: ${lPct.toFixed(1)}% · ${ls.graded_count}/${ls.total_count} graded`}
                                className="rounded px-1.5 py-0.5 text-center"
                                style={{ background: locked ? 'var(--ink-50)' : `${lColor}18`, border: `1px solid ${locked ? 'var(--ink-200)' : `${lColor}44`}`, minWidth: 44 }}>
                                <p className="text-[9px] font-bold" style={{ color: 'var(--ink-400)' }}>L{ls.level_number}</p>
                                <p className="font-mono font-bold text-xs" style={{ color: locked ? 'var(--ink-300)' : lColor }}>
                                  {locked ? '—' : `${lPct.toFixed(0)}%`}
                                </p>
                                {!locked && passed && <p style={{ fontSize: '.55rem', color: lColor }}>✓</p>}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    )}

                    {selectedLevel && (
                      <td style={{ textAlign: 'right' }}>
                        {(r.quiz_total ?? 0) > 0 ? (
                          <div>
                            <span className="font-mono text-sm">{Number(r.quiz_score ?? 0).toFixed(0)}%</span>
                            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{r.quiz_correct}/{r.quiz_total}</p>
                          </div>
                        ) : <span style={{ color: 'var(--ink-300)' }}>—</span>}
                      </td>
                    )}

                    {selectedLevel && (
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-sm">{r._graded}/{r._total}</span>
                      </td>
                    )}

                    <td style={{ textAlign: 'right' }}>
                      <p className="font-bold" style={{ color: sc }}>{score.toFixed(2)}%</p>
                      <div className="h-1.5 rounded-full overflow-hidden mt-1 ml-auto" style={{ width: 72, background: 'var(--ink-100)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, background: sc }}/>
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono text-sm">{attPct}%</span>
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{attended}/{totalSessions}</p>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono text-sm">{subPct}%</span>
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{submitted}/{totalAssignments}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
