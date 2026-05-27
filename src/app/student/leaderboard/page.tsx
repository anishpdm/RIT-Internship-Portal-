import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Stat, EmptyState, Pill } from '@/components/ui';
import { Trophy, Medal, Award, Crown, TrendingUp } from 'lucide-react';
import { computeRanks } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface LeaderRow {
  student_id: string;
  full_name: string | null;
  email: string | null;
  current_level: number;
  status: string;
  total_score: number;
  graded_submissions: number;
  attended_sessions: number;
}

export default async function StudentLeaderboardPage() {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  // Enrolled internships
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('internship_id, internships:internship_id (id, title, total_levels)')
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
  const [leaderboardData, quizData, assignmentsData] = await Promise.all([
    // 1. Leaderboard rows for all internships at once
    supabase
      .from('v_internship_leaderboard')
      .select('*')
      .in('internship_id', internshipIds)
      .order('total_score', { ascending: false }),
    // 2. Quiz aggregates for all internships at once
    supabase
      .from('v_student_quiz_aggregate')
      .select(
        'student_id, internship_id, quiz_score_pct, questions_answered, questions_correct',
      )
      .in('internship_id', internshipIds),
    // 3. Every assignment in every enrolled internship
    supabase
      .from('assignments')
      .select('id, title, kind, max_score, internship_id')
      .in('internship_id', internshipIds),
  ]);

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
      total: Number(q.questions_answered ?? 0),
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
          rowsWithCombined.sort((a, b) => b.combined - a.combined);
          const rankedRows = computeRanks(rowsWithCombined, 'combined');

          const top10 = rankedRows.slice(0, 10);
          const top5 = rankedRows.slice(0, 5);
          const myRankedRow = rankedRows.find((r) => r.student_id === me.userId);
          const myRank = myRankedRow?.rank ?? 0;
          const myRow = myRankedRow;
          const toppers = assignmentToppers[i.id] ?? [];

          return (
            <section key={i.id}>
              {/* ── Section header ──────────────────────────────── */}
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 className="font-display text-2xl font-bold">{i.title}</h2>
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  {rows.length} students
                </span>
              </div>

              {/* ── PODIUM — top 3 ──────────────────────────────── */}
              {top5.length > 0 && (() => {
                const first = top5.find(r => r.rank === 1);
                const second = top5.find(r => r.rank === 2);
                const third = top5.find(r => r.rank === 3);
                const fourth = top5.find(r => r.rank === 4);
                const fifth = top5.find(r => r.rank === 5);

                const initials = (name?: string | null) => {
                  if (!name) return '?';
                  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                };

                const PodiumCard = ({
                  row, pos, height, accentBg, accentText, border, crownColor, label,
                }: {
                  row?: typeof top5[0]; pos: number; height: number;
                  accentBg: string; accentText: string; border: string;
                  crownColor: string; label: string;
                }) => {
                  if (!row) return (
                    <div style={{ flex: 1 }}>
                      <div
                        className="rounded-xl flex items-center justify-center"
                        style={{ height, background: 'var(--ink-100)', border: '2px dashed var(--ink-200)' }}
                      >
                        <span className="text-xs" style={{ color: 'var(--ink-400)' }}>—</span>
                      </div>
                    </div>
                  );
                  const isMe = row.student_id === me.userId;
                  return (
                    <div style={{ flex: pos === 1 ? 1.15 : 1, display: 'flex', flexDirection: 'column' }}>
                      {/* Avatar + name float above podium */}
                      <div className="flex flex-col items-center mb-2 px-1">
                        <div
                          className="rounded-full flex items-center justify-center font-bold mb-1.5"
                          style={{
                            width: pos === 1 ? 56 : 44,
                            height: pos === 1 ? 56 : 44,
                            background: isMe
                              ? 'linear-gradient(135deg, var(--accent), #818cf8)'
                              : accentBg,
                            color: accentText,
                            fontSize: pos === 1 ? '1.1rem' : '0.85rem',
                            boxShadow: `0 4px 14px ${border}66`,
                          }}
                        >
                          {initials(row.full_name ?? row.email)}
                        </div>
                        <p
                          className="font-display font-bold text-center truncate w-full px-1"
                          style={{
                            fontSize: pos === 1 ? '0.875rem' : '0.78rem',
                            color: isMe ? 'var(--accent)' : 'var(--ink-900)',
                          }}
                        >
                          {(row.full_name ?? row.email ?? '—').split(' ')[0]}
                          {isMe && <span style={{ color: 'var(--accent)', fontSize:'0.65rem' }}> ★</span>}
                        </p>
                        <p className="font-display font-bold" style={{ color: crownColor, fontSize: pos === 1 ? '1.1rem' : '0.95rem' }}>
                          {row.combined.toFixed(2)}%
                        </p>
                      </div>
                      {/* Podium block */}
                      <div
                        className="rounded-t-xl flex flex-col items-center justify-start pt-3 relative"
                        style={{
                          height,
                          background: isMe
                            ? 'linear-gradient(180deg, var(--accent-soft), rgba(79,70,229,0.06))'
                            : accentBg.replace('linear-gradient', 'linear-gradient').replace('135deg', '180deg'),
                          border: `2px solid ${isMe ? 'var(--accent)' : border}`,
                          borderBottom: 'none',
                        }}
                      >
                        <span style={{ fontSize: pos === 1 ? '2rem' : '1.6rem' }}>{label}</span>
                        <span
                          className="font-mono font-bold"
                          style={{ color: isMe ? 'var(--accent)' : accentText, fontSize: '0.75rem', marginTop: 2 }}
                        >
                          #{pos}
                        </span>
                        <p className="text-xs mt-1 text-center px-1" style={{ color: isMe ? 'var(--accent)' : accentText, opacity: 0.75 }}>
                          A:{Number(row.total_score ?? 0).toFixed(0)}% Q:{row.quiz_score.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="mb-5">
                    {/* 3-step podium */}
                    <div className="flex items-end gap-2 mb-3" style={{ height: 260 }}>
                      <PodiumCard row={second} pos={2} height={130}
                        accentBg="linear-gradient(180deg,#f1f5f9,#e2e8f0)" accentText="#475569"
                        border="#94a3b8" crownColor="#64748b" label="🥈" />
                      <PodiumCard row={first} pos={1} height={165}
                        accentBg="linear-gradient(180deg,#fef9c3,#fef08a)" accentText="#92400e"
                        border="#fbbf24" crownColor="#d97706" label="🥇" />
                      <PodiumCard row={third} pos={3} height={105}
                        accentBg="linear-gradient(180deg,#fff7ed,#fed7aa)" accentText="#7c2d12"
                        border="#f97316" crownColor="#ea580c" label="🥉" />
                    </div>

                    {/* 4th and 5th — horizontal */}
                    {(fourth || fifth) && (
                      <div className="grid grid-cols-2 gap-2">
                        {[fourth, fifth].filter(Boolean).map((r) => r && (
                          <div
                            key={r.student_id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                            style={{
                              background: r.student_id === me.userId ? 'var(--accent-soft)' : 'var(--ink-50, #f8fafc)',
                              border: `1.5px solid ${r.student_id === me.userId ? 'var(--accent)' : 'var(--ink-200)'}`,
                            }}
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                              style={{
                                background: r.student_id === me.userId ? 'var(--accent)' : 'var(--ink-200)',
                                color: r.student_id === me.userId ? 'white' : 'var(--ink-600)',
                              }}
                            >
                              #{r.rank}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">
                                {(r.full_name ?? r.email ?? '—').split(' ')[0]}
                                {r.student_id === me.userId && <span className="text-xs ml-1" style={{ color: 'var(--accent)' }}>★</span>}
                              </p>
                            </div>
                            <span className="font-display font-bold text-sm">{r.combined.toFixed(2)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── YOUR RANK card ───────────────────────────────── */}
              {myRow && (
                <div
                  className="rounded-2xl mb-5 p-4"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent) 0%, #818cf8 60%, #06b6d4 100%)',
                    color: 'white',
                    boxShadow: '0 8px 32px rgba(79,70,229,0.25)',
                  }}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl"
                        style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}
                      >
                        #{myRank || '—'}
                      </div>
                      <div>
                        <p className="font-display font-bold text-lg opacity-95">Your rank</p>
                        <p className="text-xs opacity-70">
                          Level {myRow.current_level} · {myRow.graded_submissions} graded · {myRow.attended_sessions} sessions
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold" style={{ fontSize: '2rem', lineHeight: 1 }}>
                        {myRow.combined.toFixed(2)}%
                      </p>
                      <p className="text-xs opacity-70 mt-1">combined score</p>
                      <div className="flex gap-3 justify-end mt-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: 'rgba(255,255,255,0.2)' }}
                        >
                          A: {Number(myRow.total_score ?? 0).toFixed(0)}%
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: 'rgba(255,255,255,0.2)' }}
                        >
                          Q: {myRow.quiz_score.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Mini score bar */}
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, myRow.combined)}%`,
                          background: 'rgba(255,255,255,0.85)',
                          transition: 'width 1s ease',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── FULL TABLE ───────────────────────────────────── */}
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
                <h3 className="font-display text-lg font-semibold">Full ranking</h3>
              </div>
              {top10.length > 0 ? (
                <div
                  className="rounded-2xl overflow-hidden mb-8"
                  style={{ border: '1.5px solid var(--ink-200)', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
                >
                  <table className="table" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr style={{ background: 'var(--ink-900)' }}>
                        {['#', 'Student', 'Assignments', 'Quiz', 'Combined'].map((h, hi) => (
                          <th
                            key={h}
                            style={{
                              color: 'rgba(255,255,255,0.7)',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              padding: hi === 0 ? '10px 12px' : '10px 16px',
                              textAlign: hi >= 2 ? 'right' : 'left',
                              border: 'none',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {top10.map((r, idx) => {
                        const isMe = r.student_id === me.userId;
                        const rank = r.rank;
                        const combined = r.combined;
                        const initials = (r.full_name ?? r.email ?? '?')
                          .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
                        const AVATAR_COLORS = [
                          '#8B5CF6','#06B6D4','#10B981','#F59E0B',
                          '#EF4444','#3B82F6','#EC4899','#14B8A6',
                          '#F97316','#6366F1',
                        ];
                        const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                        const rowBg = isMe
                          ? 'linear-gradient(90deg, rgba(79,70,229,0.08), rgba(79,70,229,0.04))'
                          : rank === 1
                          ? 'linear-gradient(90deg, rgba(234,179,8,0.06), transparent)'
                          : rank === 2
                          ? 'linear-gradient(90deg, rgba(148,163,184,0.08), transparent)'
                          : rank === 3
                          ? 'linear-gradient(90deg, rgba(249,115,22,0.06), transparent)'
                          : idx % 2 === 0 ? 'var(--paper)' : 'rgba(248,250,252,0.8)';

                        const rankBadge = rank === 1
                          ? { bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: 'white', label: '🥇' }
                          : rank === 2
                          ? { bg: 'linear-gradient(135deg,#94a3b8,#64748b)', color: 'white', label: '🥈' }
                          : rank === 3
                          ? { bg: 'linear-gradient(135deg,#f97316,#ea580c)', color: 'white', label: '🥉' }
                          : { bg: 'var(--ink-100)', color: 'var(--ink-600)', label: String(rank) };

                        const scoreColor = combined >= 90
                          ? '#10B981'
                          : combined >= 75
                          ? '#3B82F6'
                          : combined >= 50
                          ? '#F59E0B'
                          : '#EF4444';

                        return (
                          <tr
                            key={r.student_id}
                            style={{
                              background: rowBg,
                              borderTop: '1px solid var(--ink-100)',
                            }}
                          >
                            {/* Rank */}
                            <td style={{ padding: '10px 12px', width: 56 }}>
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                                style={{ background: rankBadge.bg, color: rankBadge.color }}
                              >
                                {rank <= 3 ? rankBadge.label : rank}
                              </div>
                            </td>

                            {/* Student */}
                            <td style={{ padding: '10px 16px' }}>
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                                  style={{
                                    background: isMe
                                      ? 'linear-gradient(135deg, var(--accent), #818cf8)'
                                      : avatarColor,
                                    boxShadow: `0 2px 8px ${isMe ? 'rgba(79,70,229,0.4)' : avatarColor + '55'}`,
                                  }}
                                >
                                  {initials}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm" style={{ color: isMe ? 'var(--accent)' : 'var(--ink-900)' }}>
                                    {r.full_name ?? '—'}
                                    {isMe && <span className="ml-1 text-xs" style={{ color: 'var(--accent)' }}>★ you</span>}
                                  </p>
                                  <p className="text-xs" style={{ color: 'var(--ink-500)' }}>L{r.current_level}</p>
                                </div>
                              </div>
                            </td>

                            {/* Assignments */}
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                              <span className="font-mono text-sm">{Number(r.total_score ?? 0).toFixed(1)}%</span>
                            </td>

                            {/* Quiz */}
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                              {r.quiz_total > 0 ? (
                                <div>
                                  <span className="font-mono text-sm">{r.quiz_score.toFixed(0)}%</span>
                                  <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{r.quiz_correct}/{r.quiz_total}</p>
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: 'var(--ink-400)' }}>—</span>
                              )}
                            </td>

                            {/* Combined — with bar */}
                            <td style={{ padding: '10px 16px', textAlign: 'right', minWidth: 120 }}>
                              <p className="font-display font-bold text-sm" style={{ color: scoreColor }}>
                                {combined.toFixed(2)}%
                              </p>
                              <div
                                className="h-1 rounded-full mt-1 ml-auto"
                                style={{ width: 72, background: 'var(--ink-100)' }}
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${Math.min(100, combined)}%`, background: scoreColor }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No graded submissions yet"
                  hint="The leaderboard fills in as mentors evaluate work."
                />
              )}

              {/* Per-assignment toppers */}
              {toppers.length > 0 && (
                <>
                  <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp size={16} style={{ color: 'var(--accent)' }} /> Top scorer per assignment
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {toppers.map((t) => {
                      const isMe = t.topper?.student_id === me.userId;
                      return (
                        <div
                          key={t.id}
                          className="card"
                          style={isMe ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-display font-semibold leading-tight">{t.title}</p>
                            <Pill tone={t.kind === 'assessment' ? 'accent' : 'blue'}>{t.kind}</Pill>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <Trophy size={14} style={{ color: '#eab308' }} />
                            <p className="text-sm font-medium">
                              {t.topper?.profiles?.full_name ?? '—'}
                              {isMe && <span className="ml-1 text-xs" style={{ color: 'var(--accent)' }}>(you)</span>}
                            </p>
                          </div>
                          <p className="text-xs mt-1 font-mono" style={{ color: 'var(--ink-500)' }}>
                            Score: {t.topper?.score} / {t.max_score}
                          </p>
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
