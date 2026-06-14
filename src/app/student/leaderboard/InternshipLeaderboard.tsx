'use client';

import { useState, useMemo } from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import { Pill } from '@/components/ui';

interface Row {
  student_id: string;
  full_name: string | null;
  email: string | null;
  current_level: number;
  total_score: number;
  graded_submissions: number;
  submitted_count: number;
  attended_sessions: number;
  quiz_score: number;
  quiz_correct: number;
  quiz_total: number;
  combined: number;
  rank: number;
}

interface LevelRow {
  level_number: number;
  level_score: number;
  pass_threshold: number;
  reached: boolean;
  graded_count: number;
  total_count: number;
}

interface Level {
  id: string;
  level_number: number;
  title: string | null;
  pass_threshold: number;
}

interface Props {
  internship: { id: string; title: string; total_levels: number };
  rankedRows: (Row & { rank: number })[];
  toppers: any[];
  levels: Level[];
  // allLevelScores: internship-scoped map student_id → level_number → score
  allLevelScores: Map<string, Map<number, LevelRow>>;
  myLevels: LevelRow[];
  myUserId: string;
  myCurrentLevel: number;
}

function ini(name: string | null, email: string | null) {
  return (name ?? email ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
function scoreColor(pct: number) {
  return pct >= 90 ? '#10b981' : pct >= 70 ? '#3b82f6' : pct >= 50 ? '#f59e0b' : '#ef4444';
}
const COLORS = ['#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6','#F97316','#6366F1'];

export default function InternshipLeaderboard({
  internship, rankedRows, toppers, levels,
  allLevelScores, myLevels, myUserId, myCurrentLevel,
}: Props) {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null); // null = combined

  // ── Compute display rows based on selected tab ───────────────
  const { displayRows, myRow } = useMemo(() => {
    if (!selectedLevel) {
      // Combined view — use pre-computed ranks
      return {
        displayRows: rankedRows,
        myRow: rankedRows.find(r => r.student_id === myUserId) ?? null,
      };
    }

    // Level view — sort by that level's score, only show students who reached it
    const withLevelScore = rankedRows
      .map(r => {
        const ls = allLevelScores.get(r.student_id)?.get(selectedLevel);
        return { ...r, _levelScore: ls?.level_score ?? 0, _reached: ls?.reached ?? false, _graded: ls?.graded_count ?? 0, _total: ls?.total_count ?? 0 };
      })
      .filter(r => r._reached)
      .sort((a, b) => b._levelScore - a._levelScore);

    // Dense rank by level score
    let rank = 1;
    const ranked = withLevelScore.map((r, i) => {
      if (i > 0 && r._levelScore !== withLevelScore[i-1]._levelScore) rank++;
      return { ...r, rank };
    });

    return {
      displayRows: ranked,
      myRow: ranked.find(r => r.student_id === myUserId) ?? null,
    };
  }, [selectedLevel, rankedRows, allLevelScores, myUserId]);

  const myRank = myRow?.rank ?? 0;
  const top5 = displayRows.slice(0, 5);
  const lv = selectedLevel ? levels.find(l => l.level_number === selectedLevel) : null;
  const threshold = lv?.pass_threshold ?? 60;

  // ── Podium helper ──────────────────────────────────────────────
  function podiumScore(r: any) {
    return selectedLevel ? (r._levelScore ?? 0) : r.combined;
  }
  function getPct(r: any) { return podiumScore(r).toFixed(1); }

  function PodiumSlot({ rows, pos, height, medal, accent, glow }: {
    rows: any[]; pos: number; height: number; medal: string; accent: string; glow: string;
  }) {
    const MAX = 3;
    const visible = rows.slice(0, MAX);
    const extra = rows.length - MAX;
    const size = pos === 1 ? 54 : 42;
    const firstName = (rows[0]?.full_name ?? rows[0]?.email ?? '—').split(' ')[0];
    const isMe = rows.some(r => r.student_id === myUserId);

    return (
      <div style={{ flex: pos === 1 ? 1.2 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {rows.length === 0 ? (
          <div style={{ height: height + 88, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
            <div style={{ height, width: '100%', background: 'var(--ink-100)', borderRadius: '12px 12px 0 0', border: '2px dashed var(--ink-200)' }}/>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex' }}>
                {visible.map((r: any, ri: number) => (
                  <div key={r.student_id} className="rounded-full flex items-center justify-center font-bold text-white"
                    style={{ width: size, height: size, background: r.student_id === myUserId ? 'linear-gradient(135deg,var(--accent),#818cf8)' : `linear-gradient(135deg,${accent},${accent}aa)`, boxShadow: `0 4px 16px ${glow}`, fontSize: pos === 1 ? '1rem' : '.78rem', border: '3px solid white', marginLeft: ri > 0 ? -12 : 0, zIndex: MAX - ri }}>
                    {ini(r.full_name, r.email)}
                  </div>
                ))}
                {extra > 0 && (
                  <div className="rounded-full flex items-center justify-center font-bold text-white"
                    style={{ width: size, height: size, background: 'rgba(100,116,139,.75)', fontSize: pos === 1 ? '.75rem' : '.65rem', border: '3px solid white', marginLeft: -12, zIndex: 0 }}>
                    +{extra}
                  </div>
                )}
              </div>
              <p className="font-semibold truncate text-center" style={{ fontSize: pos === 1 ? '.85rem' : '.75rem', marginTop: 6, maxWidth: 100, color: isMe ? 'var(--accent)' : 'var(--ink-900)' }}>
                {firstName}{isMe ? ' ★' : ''}{rows.length > 1 && <span style={{ color: 'var(--ink-400)', fontWeight: 400, fontSize: '.7rem' }}> & {rows.length - 1}</span>}
              </p>
              <p className="font-bold" style={{ color: accent, fontSize: pos === 1 ? '1.1rem' : '.95rem', marginTop: 2 }}>
                {getPct(rows[0])}%
              </p>
              {rows.length > 1 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold mt-1" style={{ background: `${accent}22`, color: accent }}>
                  {rows.length} tied
                </span>
              )}
            </div>
            <div className="w-full rounded-t-2xl flex flex-col items-center justify-start pt-4"
              style={{ height, background: `linear-gradient(180deg,${accent}30,${accent}18)`, border: `2px solid ${accent}66`, borderBottom: 'none' }}>
              <span style={{ fontSize: pos === 1 ? '2.2rem' : '1.7rem' }}>{medal}</span>
              <span className="font-black mt-1" style={{ color: accent, fontSize: '.75rem' }}>#{pos}</span>
            </div>
          </>
        )}
      </div>
    );
  }

  const byRank = (r: number) => displayRows.filter((x: any) => x.rank === r);

  return (
    <section className="mb-12">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="eyebrow mb-1">Leaderboard</p>
          <h2 className="font-display font-bold text-2xl">{internship.title}</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="pill pill-accent" style={{ fontSize: '.72rem' }}>{rankedRows.length} students</span>
          {myRank > 0 && (
            <span className="pill" style={{ background: 'linear-gradient(135deg,var(--accent),#818cf8)', color: 'white', fontSize: '.72rem', border: 'none' }}>
              {selectedLevel ? `L${selectedLevel} rank` : 'You'} — #{myRank}
            </span>
          )}
        </div>
      </div>

      {/* ── Level tabs ── */}
      <div className="rounded-2xl p-3 mb-5" style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)' }}>
        <p className="text-xs font-semibold mb-2 px-1" style={{ color: 'var(--ink-500)' }}>
          View leaderboard by:
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedLevel(null)}
            className="transition-all rounded-xl px-3.5 py-2 text-sm font-semibold flex items-center gap-1.5"
            style={!selectedLevel
              ? { background: 'linear-gradient(135deg,var(--accent),#818cf8)', color: 'white', boxShadow: '0 4px 12px rgba(99,102,241,.3)' }
              : { background: 'white', color: 'var(--ink-600)', border: '1.5px solid var(--ink-200)' }}
          >
            🏆 Overall
          </button>
          {levels.map(l => {
            const myLS = myLevels.find(ml => ml.level_number === l.level_number);
            const reached = myLS?.reached ?? false;
            const active = selectedLevel === l.level_number;
            const isMyCurrent = l.level_number === myCurrentLevel;
            return (
              <button
                key={l.level_number}
                onClick={() => reached && setSelectedLevel(l.level_number)}
                disabled={!reached}
                className="transition-all rounded-xl px-3.5 py-2 text-sm font-semibold flex items-center gap-1.5"
                style={active
                  ? { background: 'linear-gradient(135deg,var(--accent),#818cf8)', color: 'white', boxShadow: '0 4px 12px rgba(99,102,241,.3)' }
                  : reached
                    ? { background: 'white', color: 'var(--ink-700)', border: `1.5px solid ${isMyCurrent ? 'var(--accent)' : 'var(--ink-200)'}`, cursor: 'pointer' }
                    : { background: 'var(--ink-100)', color: 'var(--ink-400)', border: '1.5px solid var(--ink-200)', cursor: 'not-allowed' }}
                title={reached ? `View Level ${l.level_number} leaderboard` : 'You haven\'t reached this level yet'}
              >
                {reached ? '📊' : '🔒'} Level {l.level_number}
                {isMyCurrent && !active && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--accent)', color: 'white' }}>NOW</span>
                )}
                {myLS && reached && (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded-md"
                    style={{ background: active ? 'rgba(255,255,255,.2)' : 'var(--accent-soft)', color: active ? 'white' : 'var(--accent)' }}>
                    {myLS.level_score.toFixed(0)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Level context banner */}
      {selectedLevel && lv && (
        <div className="rounded-xl px-4 py-2.5 mb-5 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.1),rgba(99,102,241,.04))', border: '1.5px solid rgba(99,102,241,.2)' }}>
          <span className="text-lg">📊</span>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
              Level {selectedLevel}{lv.title ? ` — ${lv.title}` : ''} · {displayRows.length} students reached
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              Sorted by Level {selectedLevel} assignment score · Pass threshold: {threshold}%
            </p>
          </div>
        </div>
      )}

      {/* ── Your rank banner ── */}
      {myRow && (() => {
        const score = selectedLevel ? (myRow as any)._levelScore : myRow.combined;
        const graded = selectedLevel ? (myRow as any)._graded : myRow.graded_submissions;
        const total  = selectedLevel ? (myRow as any)._total  : undefined;
        return (
          <div className="rounded-2xl p-5 mb-6 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,var(--accent) 0%,#818cf8 55%,#06b6d4 100%)', boxShadow: '0 8px 32px rgba(99,102,241,.30)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.15) 1px, transparent 1px)', backgroundSize: '18px 18px' }}/>
            <div className="relative flex items-center gap-5 flex-wrap">
              <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)' }}>
                <span className="font-black text-white leading-none" style={{ fontSize: '1.4rem' }}>#{myRank}</span>
                <span className="text-white/60 font-semibold" style={{ fontSize: '.6rem' }}>{selectedLevel ? `L${selectedLevel}` : 'OVERALL'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-lg leading-tight truncate">{myRow.full_name ?? 'You'}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.55)' }}>
                  L{myRow.current_level} · {graded}{total ? `/${total}` : ''} graded
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-white leading-none" style={{ fontSize: '2.25rem', letterSpacing: '-.04em' }}>
                  {score.toFixed(2)}%
                </p>
                <p className="text-xs font-medium mt-1" style={{ color: 'rgba(255,255,255,.5)' }}>
                  {selectedLevel ? `level ${selectedLevel} score` : 'combined score'}
                </p>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden ml-auto" style={{ width: 128, background: 'rgba(255,255,255,.2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, background: 'rgba(255,255,255,.85)' }}/>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── My level scores card (always show in combined view) ── */}
      {!selectedLevel && myLevels.length > 0 && (() => {
        return (
          <div className="card mb-5">
            <p className="eyebrow mb-3">My level scores</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(myLevels.length, 4)}, 1fr)` }}>
              {myLevels.map(l => {
                const pct = l.level_score;
                const passed = pct >= l.pass_threshold;
                const locked = !l.reached;
                const isCurrent = l.level_number === myCurrentLevel;
                const color = locked ? '#94a3b8' : passed ? '#10b981' : pct >= l.pass_threshold * 0.75 ? '#f59e0b' : '#ef4444';
                return (
                  <button key={l.level_number} onClick={() => setSelectedLevel(l.level_number)}
                    className="rounded-xl p-3 text-center transition-all hover:scale-105"
                    style={{ background: isCurrent ? 'linear-gradient(135deg,rgba(99,102,241,.1),rgba(99,102,241,.04))' : locked ? 'var(--ink-50)' : `${color}0d`, border: `1.5px solid ${isCurrent ? 'var(--accent)' : locked ? 'var(--ink-200)' : `${color}44`}`, opacity: locked ? 0.65 : 1, cursor: l.reached ? 'pointer' : 'default' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: locked ? 'var(--ink-400)' : 'var(--ink-600)' }}>
                      L{l.level_number}{isCurrent && <span className="ml-1" style={{ color: 'var(--accent)' }}>●</span>}
                    </p>
                    <p className="font-black" style={{ fontSize: '1.3rem', color: locked ? 'var(--ink-300)' : color }}>
                      {locked ? '—' : `${pct.toFixed(0)}%`}
                    </p>
                    {!locked && (
                      <p className="text-[10px] mt-1" style={{ color: 'var(--ink-400)' }}>
                        {passed ? '✓ ' : ''}{l.graded_count}/{l.total_count} graded
                      </p>
                    )}
                    {l.reached && <p className="text-[10px] mt-0.5" style={{ color: 'var(--accent)' }}>tap to view →</p>}
                    {locked && <p className="text-[10px] mt-1" style={{ color: 'var(--ink-400)' }}>🔒 locked</p>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Podium ── */}
      {top5.length > 0 && (
        <div className="mb-6 px-2">
          <div className="flex items-end gap-2" style={{ height: 280 }}>
            <PodiumSlot rows={byRank(2)} pos={2} height={120} medal="🥈" accent="#64748b" glow="rgba(100,116,139,.3)"/>
            <PodiumSlot rows={byRank(1)} pos={1} height={165} medal="🥇" accent="#d97706" glow="rgba(217,119,6,.35)"/>
            <PodiumSlot rows={byRank(3)} pos={3} height={90}  medal="🥉" accent="#b45309" glow="rgba(180,83,9,.28)"/>
          </div>
          <div style={{ height: 6, background: 'linear-gradient(90deg,transparent,var(--ink-200),transparent)', borderRadius: 4 }}/>
        </div>
      )}

      {/* ── Full standings table ── */}
      {displayRows.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
            {selectedLevel ? `No students have reached Level ${selectedLevel} yet.` : 'No students enrolled.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden mb-8" style={{ border: '1px solid var(--ink-200)', boxShadow: 'var(--s-sm)' }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#0a0f1e,#1e1b4b)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <Trophy size={14} style={{ color: '#fbbf24' }}/>
            <p className="font-bold text-sm text-white">
              {selectedLevel ? `Level ${selectedLevel} standings` : 'Overall standings'}
            </p>
            <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,.35)' }}>
              {selectedLevel ? `sorted by L${selectedLevel} score` : 'combined = assignments 95% + quiz 5%'}
            </span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 52 }}>#</th>
                <th>Student</th>
                {!selectedLevel && <th style={{ textAlign: 'right' }}>A%</th>}
                {!selectedLevel && <th style={{ textAlign: 'right' }}>Quiz</th>}
                {selectedLevel && <th style={{ textAlign: 'right' }}>Graded</th>}
                <th style={{ textAlign: 'right', minWidth: 130 }}>
                  {selectedLevel ? `L${selectedLevel} Score` : 'Combined'}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayRows.slice(0, 20).map((r: any, idx: number) => {
                const isMe = r.student_id === myUserId;
                const score = selectedLevel ? r._levelScore : r.combined;
                const sc = scoreColor(score);
                const rank = r.rank;
                const rowBg = isMe ? 'linear-gradient(90deg,rgba(99,102,241,.08),rgba(99,102,241,.03))' : idx % 2 === 0 ? 'white' : '#fafbfd';
                const medalBg = rank === 1 ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : rank === 2 ? 'linear-gradient(135deg,#94a3b8,#64748b)' : rank === 3 ? 'linear-gradient(135deg,#f97316,#ea580c)' : null;
                const aColor = isMe ? 'var(--accent)' : COLORS[idx % COLORS.length];
                return (
                  <tr key={r.student_id} style={{ background: rowBg }}>
                    <td style={{ padding: '10px 12px' }}>
                      {medalBg ? (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm" style={{ background: medalBg }}>
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-sm" style={{ background: isMe ? 'var(--accent-soft)' : 'var(--ink-100)', color: isMe ? 'var(--accent)' : 'var(--ink-600)', fontWeight: isMe ? 700 : 400 }}>
                          {rank}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ background: aColor, boxShadow: `0 2px 8px ${aColor}55` }}>
                          {ini(r.full_name, r.email)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: isMe ? 'var(--accent)' : 'var(--ink-900)' }}>
                            {r.full_name ?? '—'}
                            {isMe && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent)', color: 'white' }}>YOU</span>}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--ink-400)' }}>L{r.current_level}</p>
                        </div>
                      </div>
                    </td>
                    {!selectedLevel && (
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-sm">{Number(r.total_score ?? 0).toFixed(1)}%</span>
                      </td>
                    )}
                    {!selectedLevel && (
                      <td style={{ textAlign: 'right' }}>
                        {r.quiz_total > 0 ? (
                          <div>
                            <span className="font-mono text-sm">{r.quiz_score.toFixed(0)}%</span>
                            <p className="text-xs" style={{ color: 'var(--ink-400)' }}>{r.quiz_correct}/{r.quiz_total}</p>
                          </div>
                        ) : <span style={{ color: 'var(--ink-300)', fontSize: '.8rem' }}>—</span>}
                      </td>
                    )}
                    {selectedLevel && (
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-sm">{r._graded}/{r._total}</span>
                      </td>
                    )}
                    <td style={{ textAlign: 'right', padding: '10px 14px' }}>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="font-bold" style={{ color: sc, fontSize: '.95rem' }}>{score.toFixed(2)}%</span>
                        {selectedLevel && r._total > 0 && (
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ width: 80, background: 'var(--ink-100)' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, background: sc }}/>
                          </div>
                        )}
                        {!selectedLevel && (
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ width: 80, background: 'var(--ink-100)' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, background: sc }}/>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Assignment toppers (only in combined view) ── */}
      {!selectedLevel && toppers.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: 'var(--accent)' }}/>
            <h3 className="font-display font-bold text-lg">Top scorer per assignment</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {toppers.map((t: any) => {
              const isMe = t.topper?.student_id === myUserId;
              const pct = t.topper?.score != null && t.max_score > 0 ? Math.round((t.topper.score / t.max_score) * 100) : 0;
              return (
                <div key={t.id} className="card relative overflow-hidden"
                  style={isMe ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="font-display font-semibold text-sm leading-snug flex-1">{t.title}</p>
                    <span className={`pill ${t.kind === 'assessment' ? 'pill-accent' : 'pill-green'}`} style={{ fontSize: '.6rem' }}>{t.kind}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🏆</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{t.topper?.profiles?.full_name ?? '—'}{isMe && <span className="ml-1 text-xs font-bold" style={{ color: 'var(--accent)' }}>★ you</span>}</p>
                      <p className="font-mono text-xs" style={{ color: 'var(--ink-500)' }}>{t.topper?.score} / {t.max_score}</p>
                    </div>
                    <span className="font-bold text-lg" style={{ color: pct >= 80 ? '#10b981' : '#f59e0b' }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-100)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 80 ? '#10b981' : '#f59e0b' }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
