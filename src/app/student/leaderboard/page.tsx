import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Stat, EmptyState, Pill } from '@/components/ui';
import { Trophy, Medal, Award, Crown, TrendingUp } from 'lucide-react';
import { computeRanks } from '@/lib/utils';
import { LevelScoreBadges } from '@/components/LevelScores';

export const dynamic = 'force-dynamic';

interface LeaderRow {
  student_id: string;
  full_name: string | null;
  email: string | null;
  current_level: number;
  status: string;
  total_score: number;
  graded_submissions: number;
  submitted_count: number;
  attended_sessions: number;
}

export default async function StudentLeaderboardPage() {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  // Enrolled internships
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('internship_id, current_level, internships:internship_id (id, title, total_levels)')
    .eq('student_id', me.userId);

  const internships = (enrollments ?? [])
    .map((e: any) => e.internships)
    .filter(Boolean);

  if (internships.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Student"
          title="Leaderboard"
          subtitle="See where you stand against your batch."
        />
        <EmptyState
          title="Not enrolled in any internship"
          hint="Leaderboards appear once you're enrolled and evaluations begin."
        />
      </>
    );
  }

  // Get leaderboard rows for each internship
  const internshipIds = internships.map((i: any) => i.id);

  // PARALLEL FETCH: all the heavy data in one round-trip wave instead of N sequential queries.
  const [leaderboardData, quizData, assignmentsData, myLevelScoresData] = await Promise.all([
    // 1. Leaderboard rows for all internships at once
    supabase
      .from('v_internship_leaderboard')
      .select('*')
      .in('internship_id', internshipIds)
      .order('total_score', { ascending: false }),
    // 2. Quiz aggregates for all internships at once
    supabase
      .from('v_student_quiz_aggregate')
      .select('student_id, internship_id, quiz_score_pct, total_questions, questions_answered, questions_correct')
      .in('internship_id', internshipIds),
    // 3. Every assignment in every enrolled internship
    supabase
      .from('assignments')
      .select('id, title, kind, max_score, internship_id')
      .in('internship_id', internshipIds),
    // 4. MY per-level scores
    supabase
      .from('v_student_level_scores')
      .select('internship_id, level_number, level_title, level_score, pass_threshold, reached, graded_count, total_count')
      .eq('student_id', me.userId)
      .in('internship_id', internshipIds),
  ]);

  // Build my level scores map: internship_id → sorted level array
  const myLevelsByInternship = new Map<string, any[]>();
  for (const ls of myLevelScoresData.data ?? []) {
    if (!myLevelsByInternship.has(ls.internship_id)) myLevelsByInternship.set(ls.internship_id, []);
    myLevelsByInternship.get(ls.internship_id)!.push(ls);
  }
  for (const [, arr] of myLevelsByInternship) arr.sort((a, b) => a.level_number - b.level_number);

  const allAssignments = assignmentsData.data ?? [];
  const allAssignmentIds = allAssignments.map((a: any) => a.id);

  // 4. ALL graded submissions across ALL assignments — one query, no loops
  const { data: allSubmissions } = allAssignmentIds.length
    ? await supabase
        .from('submissions')
        .select(
          'assignment_id, score, student_id, profiles:student_id (full_name, email)',
        )
        .in('assignment_id', allAssignmentIds)
        .eq('status', 'graded')
        .order('score', { ascending: false })
    : { data: [] as any[] };

  // Group submissions by assignment_id — first hit per assignment is the topper (since we ordered desc)
  const topperByAssignment = new Map<string, any>();
  for (const sub of allSubmissions ?? []) {
    if (!topperByAssignment.has(sub.assignment_id)) {
      topperByAssignment.set(sub.assignment_id, sub);
    }
  }

  // Group leaderboard rows by internship_id
  const leaderboards: Record<string, LeaderRow[]> = {};
  for (const row of (leaderboardData.data ?? []) as any[]) {
    const list = leaderboards[row.internship_id] ?? [];
    list.push(row);
    leaderboards[row.internship_id] = list;
  }

  // Group quiz aggregates by internship_id
  const quizAggregates: Record<
    string,
    Map<string, { score: number; correct: number; total: number }>
  > = {};
  for (const q of (quizData.data ?? []) as any[]) {
    const m = quizAggregates[q.internship_id] ?? new Map();
    m.set(q.student_id, {
      score: Number(q.quiz_score_pct ?? 0),
      correct: Number(q.questions_correct ?? 0),
      total: Number((q as any).total_questions ?? 0),
    });
    quizAggregates[q.internship_id] = m;
  }

  // Build per-internship topper list from the pre-computed map
  const assignmentToppers: Record<string, any[]> = {};
  for (const i of internships) {
    const list: any[] = [];
    for (const a of allAssignments.filter((x: any) => x.internship_id === i.id)) {
      const top = topperByAssignment.get(a.id);
      if (top) list.push({ ...a, topper: top });
    }
    assignmentToppers[i.id] = list;
  }

  return (
    <>
      <PageHeader
        eyebrow="Student"
        title="Leaderboard"
        subtitle="Combined ranking: 95% from assignment scores + 5% from live quizzes. Updates after each evaluation."
      />

      <div className="space-y-10">
        {internships.map((i: any) => {
          const rows = leaderboards[i.id] ?? [];
          const quizMap = quizAggregates[i.id] ?? new Map();

          // Compute combined score: 95% assignments + 5% quiz
          const rowsWithCombined = rows.map((r) => {
            const quiz = quizMap.get(r.student_id);
            const quizPct = quiz?.score ?? 0;
            const assignmentPct = Number(r.total_score ?? 0);
            const combined = assignmentPct * 0.95 + quizPct * 0.05;
            return {
              ...r,
              quiz_score: quizPct,
              quiz_correct: quiz?.correct ?? 0,
              quiz_total: quiz?.total ?? 0,
              combined,
            };
          });

          // Sort then compute proper dense ranks (ties share same position)
          rowsWithCombined.sort((a, b) => {
            if (b.combined !== a.combined) return b.combined - a.combined;
            if (b.graded_submissions !== a.graded_submissions) return b.graded_submissions - a.graded_submissions;
            return (b.submitted_count ?? 0) - (a.submitted_count ?? 0);
          });
          const rankedRows = computeRanks(rowsWithCombined, ['combined', 'graded_submissions', 'submitted_count']);

          const top10 = rankedRows.slice(0, 10);
          const top5 = rankedRows.slice(0, 5);
          const myRankedRow = rankedRows.find((r) => r.student_id === me.userId);
          const myRank = myRankedRow?.rank ?? 0;
          const myRow = myRankedRow;
          const toppers = assignmentToppers[i.id] ?? [];

          return (
            <section key={i.id} className="mb-12">

              {/* ── Internship title ── */}
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <p className="eyebrow mb-1">Leaderboard</p>
                  <h2 className="font-display font-bold text-2xl">{i.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="pill pill-accent" style={{ fontSize: '.72rem' }}>
                    {rankedRows.length} students
                  </span>
                  {myRank > 0 && (
                    <span className="pill" style={{ background: 'linear-gradient(135deg,var(--accent),#818cf8)', color: 'white', fontSize: '.72rem', border: 'none' }}>
                      You — #{myRank}
                    </span>
                  )}
                </div>
              </div>

              {/* ── YOUR RANK banner ── */}
              {myRow && (
                <div className="rounded-2xl p-5 mb-6 relative overflow-hidden" style={{
                  background: 'linear-gradient(135deg,var(--accent) 0%,#818cf8 55%,#06b6d4 100%)',
                  boxShadow: '0 8px 32px rgba(99,102,241,.30)',
                }}>
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.15) 1px, transparent 1px)', backgroundSize: '18px 18px' }}/>
                  <div className="relative flex items-center gap-5 flex-wrap">
                    <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0"
                      style={{ background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)' }}>
                      <span className="font-black text-white leading-none" style={{ fontSize: '1.4rem' }}>#{myRank}</span>
                      <span className="text-white/60 font-semibold" style={{ fontSize: '.6rem' }}>RANK</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-lg leading-tight truncate">{myRow.full_name ?? 'You'}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.55)' }}>L{myRow.current_level} · {myRow.graded_submissions} graded · {myRow.attended_sessions} sessions</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(255,255,255,.18)', color: 'white' }}>
                          A: {Number(myRow.total_score ?? 0).toFixed(0)}%
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(255,255,255,.18)', color: 'white' }}>
                          Q: {myRow.quiz_score.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-white leading-none" style={{ fontSize: '2.25rem', letterSpacing: '-.04em' }}>
                        {myRow.combined.toFixed(2)}%
                      </p>
                      <p className="text-xs font-medium mt-1" style={{ color: 'rgba(255,255,255,.5)' }}>combined score</p>
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden ml-auto" style={{ width: 128, background: 'rgba(255,255,255,.2)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, myRow.combined)}%`, background: 'rgba(255,255,255,.85)' }}/>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── MY LEVEL BREAKDOWN ── */}
              {(() => {
                const myLevels = myLevelsByInternship.get(i.id) ?? [];
                if (!myLevels.length) return null;
                const myEnrollment = enrollments?.find((e: any) => e.internship_id === i.id);
                return (
                  <div className="card mb-5">
                    <p className="eyebrow mb-3">My level scores</p>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(myLevels.length, 3)}, 1fr)` }}>
                      {myLevels.map((l: any) => {
                        const pct = l.level_score;
                        const passed = pct >= l.pass_threshold;
                        const locked = !l.reached;
                        const isCurrent = l.level_number === myEnrollment?.current_level;
                        const color = locked ? '#94a3b8' : passed ? '#10b981' : pct >= l.pass_threshold * 0.75 ? '#f59e0b' : '#ef4444';
                        return (
                          <div key={l.level_number} className="rounded-xl p-3 text-center"
                            style={{
                              background: isCurrent ? 'linear-gradient(135deg,rgba(99,102,241,.1),rgba(99,102,241,.04))' : locked ? 'var(--ink-50)' : `${color}0d`,
                              border: `1.5px solid ${isCurrent ? 'var(--accent)' : locked ? 'var(--ink-200)' : `${color}44`}`,
                              opacity: locked ? 0.65 : 1,
                            }}>
                            <p className="text-xs font-bold mb-1" style={{ color: locked ? 'var(--ink-400)' : 'var(--ink-600)' }}>
                              Level {l.level_number}
                              {isCurrent && <span className="ml-1" style={{ color: 'var(--accent)' }}>●</span>}
                            </p>
                            <p className="font-black" style={{ fontSize: '1.4rem', color: locked ? 'var(--ink-300)' : color, letterSpacing: '-.02em' }}>
                              {locked ? '—' : `${pct.toFixed(0)}%`}
                            </p>
                            {!locked && (
                              <>
                                <div className="h-1.5 rounded-full overflow-hidden mt-2 mx-auto" style={{ background: 'var(--ink-100)', width: '80%' }}>
                                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }}/>
                                </div>
                                <p className="text-[10px] mt-1.5" style={{ color: 'var(--ink-400)' }}>
                                  {l.graded_count}/{l.total_count} graded · pass {l.pass_threshold}%
                                </p>
                                {passed && <p className="text-[10px] font-bold mt-0.5" style={{ color }}>✓ Passed</p>}
                              </>
                            )}
                            {locked && <p className="text-[10px] mt-1" style={{ color: 'var(--ink-400)' }}>🔒 Not reached</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── PODIUM ── */}
              {top5.length > 0 && (() => {
                const byRank = (r: number) => rankedRows.filter((x: any) => x.rank === r);
                const p1 = byRank(1); const p2 = byRank(2); const p3 = byRank(3);
                const ini = (name?: string | null) => (name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
                const PodiumSlot = ({ rows, pos, height, medal, accent, glow }: {
                  rows: any[]; pos: number; height: number; medal: string; accent: string; glow: string;
                }) => {
                  // Show up to 3 avatars; only cap with +N when 4 or more are tied
                  const MAX_AVATARS = 3;
                  const visibleAvatars = rows.slice(0, MAX_AVATARS);
                  const extraCount = rows.length - MAX_AVATARS;
                  const firstName = (rows[0]?.full_name ?? rows[0]?.email ?? '—').split(' ')[0];
                  const isMe = rows.some((r: any) => r.student_id === me.userId);
                  const avatarSize = pos === 1 ? 54 : 42;

                  return (
                  <div style={{ flex: pos === 1 ? 1.2 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {rows.length === 0 ? (
                      <div style={{ height: height + 88, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                        <div style={{ height, width: '100%', background: 'var(--ink-100)', borderRadius: '12px 12px 0 0', border: '2px dashed var(--ink-200)' }}/>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
                          {/* Max 2 avatar icons */}
                          <div style={{ display: 'flex' }}>
                            {visibleAvatars.map((r: any, ri: number) => (
                              <div key={r.student_id}
                                className="rounded-full flex items-center justify-center font-bold text-white"
                                style={{
                                  width: avatarSize, height: avatarSize,
                                  background: r.student_id === me.userId
                                    ? 'linear-gradient(135deg,var(--accent),#818cf8)'
                                    : `linear-gradient(135deg,${accent},${accent}aa)`,
                                  boxShadow: `0 4px 16px ${glow}`,
                                  fontSize: pos === 1 ? '1rem' : '.78rem',
                                  border: '3px solid white',
                                  marginLeft: ri > 0 ? -12 : 0,
                                  zIndex: 2 - ri,
                                }}>
                                {ini(r.full_name ?? r.email)}
                              </div>
                            ))}
                            {/* +N bubble if more than 2 tied */}
                            {extraCount > 0 && (
                              <div
                                className="rounded-full flex items-center justify-center font-bold text-white"
                                style={{
                                  width: avatarSize, height: avatarSize,
                                  background: 'rgba(100,116,139,.75)',
                                  fontSize: pos === 1 ? '.75rem' : '.65rem',
                                  border: '3px solid white',
                                  marginLeft: -12,
                                  zIndex: 0,
                                }}>
                                +{extraCount}
                              </div>
                            )}
                          </div>

                          {/* Only 1 name */}
                          <p className="font-semibold truncate text-center"
                            style={{ fontSize: pos === 1 ? '.85rem' : '.75rem', marginTop: 6, maxWidth: 100,
                              color: isMe ? 'var(--accent)' : 'var(--ink-900)' }}>
                            {firstName}{isMe ? ' ★' : ''}
                            {rows.length > 1 && (
                              <span style={{ color: 'var(--ink-400)', fontWeight: 400, fontSize: '.7rem' }}>
                                {' '}& {rows.length - 1}
                              </span>
                            )}
                          </p>

                          {/* Score */}
                          <p className="font-bold" style={{ color: accent, fontSize: pos === 1 ? '1.1rem' : '.95rem', marginTop: 2 }}>
                            {rows[0].combined.toFixed(1)}%
                          </p>

                          {/* Tie badge */}
                          {rows.length > 1 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold mt-1"
                              style={{ background: `${accent}22`, color: accent }}>
                              {rows.length} tied
                            </span>
                          )}
                        </div>

                        {/* Platform */}
                        <div className="w-full rounded-t-2xl flex flex-col items-center justify-start pt-4"
                          style={{ height, background: `linear-gradient(180deg,${accent}30,${accent}18)`, border: `2px solid ${accent}66`, borderBottom: 'none' }}>
                          <span style={{ fontSize: pos === 1 ? '2.2rem' : '1.7rem' }}>{medal}</span>
                          <span className="font-black mt-1" style={{ color: accent, fontSize: '.75rem' }}>#{pos}</span>
                        </div>
                      </>
                    )}
                  </div>
                  );
                };
                return (
                  <div className="mb-6 px-2">
                    <div className="flex items-end gap-2" style={{ height: 280 }}>
                      <PodiumSlot rows={p2} pos={2} height={120} medal="🥈" accent="#64748b" glow="rgba(100,116,139,.3)"/>
                      <PodiumSlot rows={p1} pos={1} height={165} medal="🥇" accent="#d97706" glow="rgba(217,119,6,.35)"/>
                      <PodiumSlot rows={p3} pos={3} height={90}  medal="🥉" accent="#b45309" glow="rgba(180,83,9,.28)"/>
                    </div>
                    <div style={{ height: 6, background: 'linear-gradient(90deg,transparent,var(--ink-200),transparent)', borderRadius: 4 }}/>
                  </div>
                );
              })()}

              {/* ── Ranking table ── */}
              <div className="rounded-2xl overflow-hidden mb-8" style={{ border: '1px solid var(--ink-200)', boxShadow: 'var(--s-sm)' }}>
                <div className="px-5 py-4 flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#0a0f1e,#1e1b4b)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                  <Trophy size={14} style={{ color: '#fbbf24' }}/>
                  <p className="font-bold text-sm text-white">Full standings</p>
                  <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,.35)' }}>combined = assignments 95% + quiz 5%</span>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 52 }}>#</th>
                      <th>Student</th>
                      <th style={{ textAlign: 'right' }}>Asgmt</th>
                      <th style={{ textAlign: 'right' }}>Quiz</th>
                      <th style={{ textAlign: 'right', minWidth: 130 }}>Combined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedRows.slice(0, 15).map((r: any, idx: number) => {
                      const isMe = r.student_id === me.userId;
                      const combined = r.combined;
                      const ini = (r.full_name ?? r.email ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
                      const COLORS = ['#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6','#F97316','#6366F1','#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444'];
                      const aColor = isMe ? 'var(--accent)' : COLORS[idx % COLORS.length];
                      const scoreColor = combined >= 90 ? '#10b981' : combined >= 70 ? '#3b82f6' : combined >= 50 ? '#f59e0b' : '#ef4444';
                      const rank = r.rank;
                      const rowBg = isMe ? 'linear-gradient(90deg,rgba(99,102,241,.08),rgba(99,102,241,.03))' : idx % 2 === 0 ? 'white' : '#fafbfd';
                      const medalBg = rank === 1 ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : rank === 2 ? 'linear-gradient(135deg,#94a3b8,#64748b)' : rank === 3 ? 'linear-gradient(135deg,#f97316,#ea580c)' : null;
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
                                {ini}
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
                          <td style={{ textAlign: 'right', padding: '10px 14px' }}>
                            <span className="font-mono text-sm">{Number(r.total_score ?? 0).toFixed(1)}%</span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 14px' }}>
                            {r.quiz_total > 0 ? (
                              <div><span className="font-mono text-sm">{r.quiz_score.toFixed(0)}%</span><p className="text-xs" style={{ color: 'var(--ink-400)' }}>{r.quiz_correct}/{r.quiz_total} correct</p></div>
                            ) : <span style={{ color: 'var(--ink-300)', fontSize: '.8rem' }}>—</span>}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 14px' }}>
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-bold" style={{ color: scoreColor, fontSize: '.95rem' }}>{combined.toFixed(2)}%</span>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ width: 80, background: 'var(--ink-100)' }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, combined)}%`, background: scoreColor }}/>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Assignment toppers ── */}
              {toppers.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} style={{ color: 'var(--accent)' }}/>
                    <h3 className="font-display font-bold text-lg">Top scorer per assignment</h3>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {toppers.map((t) => {
                      const isMe = t.topper?.student_id === me.userId;
                      const pct = t.topper?.score != null && t.max_score > 0 ? Math.round((t.topper.score / t.max_score) * 100) : 0;
                      return (
                        <div key={t.id} className="card relative overflow-hidden"
                          style={isMe ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <p className="font-display font-semibold text-sm leading-snug flex-1">{t.title}</p>
                            <Pill tone={t.kind === 'assessment' ? 'accent' : 'blue'}>{t.kind}</Pill>
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
        })}
      </div>
    </>
  );
}
