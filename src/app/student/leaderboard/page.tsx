import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Stat, EmptyState, Pill } from '@/components/ui';
import { Trophy, Medal, Award, Crown, TrendingUp } from 'lucide-react';

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
  const leaderboards: Record<string, LeaderRow[]> = {};
  const quizAggregates: Record<string, Map<string, { score: number; correct: number; total: number }>> = {};

  for (const i of internships) {
    const { data: rows } = await supabase
      .from('v_internship_leaderboard')
      .select('*')
      .eq('internship_id', i.id)
      .order('total_score', { ascending: false });
    leaderboards[i.id] = (rows ?? []) as LeaderRow[];

    // Quiz aggregate per student in this internship
    const { data: quizRows } = await supabase
      .from('v_student_quiz_aggregate')
      .select('student_id, quiz_score_pct, questions_answered, questions_correct')
      .eq('internship_id', i.id);
    const m = new Map<string, { score: number; correct: number; total: number }>();
    for (const q of quizRows ?? []) {
      m.set((q as any).student_id, {
        score: Number((q as any).quiz_score_pct ?? 0),
        correct: Number((q as any).questions_correct ?? 0),
        total: Number((q as any).questions_answered ?? 0),
      });
    }
    quizAggregates[i.id] = m;
  }

  // For each internship, find per-assignment top scorer
  const assignmentToppers: Record<string, any[]> = {};
  for (const i of internships) {
    const { data: assignments } = await supabase
      .from('assignments')
      .select('id, title, kind, max_score')
      .eq('internship_id', i.id);

    const toppers: any[] = [];
    for (const a of assignments ?? []) {
      const { data: topSub } = await supabase
        .from('submissions')
        .select(
          'score, student_id, profiles:student_id (full_name, email)',
        )
        .eq('assignment_id', a.id)
        .eq('status', 'graded')
        .order('score', { ascending: false })
        .limit(1);
      if (topSub && topSub.length > 0) {
        toppers.push({
          ...a,
          topper: topSub[0],
        });
      }
    }
    assignmentToppers[i.id] = toppers;
  }

  return (
    <>
      <PageHeader
        eyebrow="Student"
        title="Leaderboard"
        subtitle="Combined ranking: 90% from assignment scores + 10% from live quizzes. Updates after each evaluation."
      />

      <div className="space-y-10">
        {internships.map((i: any) => {
          const rows = leaderboards[i.id] ?? [];
          const quizMap = quizAggregates[i.id] ?? new Map();

          // Compute combined score: 90% assignments + 10% quiz
          const rowsWithCombined = rows.map((r) => {
            const quiz = quizMap.get(r.student_id);
            const quizPct = quiz?.score ?? 0;
            const assignmentPct = Number(r.total_score ?? 0);
            const combined = assignmentPct * 0.9 + quizPct * 0.1;
            return {
              ...r,
              quiz_score: quizPct,
              quiz_correct: quiz?.correct ?? 0,
              quiz_total: quiz?.total ?? 0,
              combined,
            };
          });

          // Re-sort by combined score
          rowsWithCombined.sort((a, b) => b.combined - a.combined);

          const top10 = rowsWithCombined.slice(0, 10);
          const myRank = rowsWithCombined.findIndex((r) => r.student_id === me.userId) + 1;
          const myRow = rowsWithCombined.find((r) => r.student_id === me.userId);
          const toppers = assignmentToppers[i.id] ?? [];

          return (
            <section key={i.id}>
              <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
                <h2 className="font-display text-2xl font-bold">{i.title}</h2>
                <Pill tone="accent">
                  {rows.length} student{rows.length === 1 ? '' : 's'}
                </Pill>
              </div>

              {/* My position card */}
              {myRow && (
                <div
                  className="card mb-5"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--accent-soft) 0%, rgba(79, 70, 229, 0.04) 100%)',
                    borderColor: 'var(--accent)',
                  }}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                        style={{
                          background:
                            'linear-gradient(135deg, var(--accent) 0%, #818cf8 100%)',
                          color: 'white',
                        }}
                      >
                        #{myRank || '—'}
                      </div>
                      <div>
                        <p className="font-display font-semibold">Your rank</p>
                        <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                          Level {myRow.current_level} · {myRow.graded_submissions} graded ·{' '}
                          {myRow.attended_sessions} sessions attended
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="stat-num" style={{ fontSize: '1.75rem' }}>
                        {myRow.combined.toFixed(1)}%
                      </p>
                      <p className="stat-label">combined score</p>
                      <p className="text-xs mt-1 font-mono" style={{ color: 'var(--ink-500)' }}>
                        Assignments {Number(myRow.total_score ?? 0).toFixed(0)}% · Quiz {myRow.quiz_score.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Top 10 */}
              <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
                <Trophy size={16} style={{ color: 'var(--accent)' }} /> Top 10 overall
              </h3>

              {top10.length > 0 ? (
                <div className="card p-0 overflow-hidden table-wrap mb-8">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Rank</th>
                        <th>Student</th>
                        <th>Level</th>
                        <th>Assignments</th>
                        <th>Quiz</th>
                        <th>Combined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top10.map((r, idx) => {
                        const isMe = r.student_id === me.userId;
                        return (
                          <tr
                            key={r.student_id}
                            style={
                              isMe
                                ? { background: 'var(--accent-soft)' }
                                : undefined
                            }
                          >
                            <td>
                              {idx === 0 ? (
                                <span style={{ color: '#eab308' }}>
                                  <Crown size={14} className="inline" /> 1
                                </span>
                              ) : idx === 1 ? (
                                <span style={{ color: '#9ca3af' }}>
                                  <Medal size={14} className="inline" /> 2
                                </span>
                              ) : idx === 2 ? (
                                <span style={{ color: '#cd7f32' }}>
                                  <Award size={14} className="inline" /> 3
                                </span>
                              ) : (
                                <span
                                  className="font-mono text-sm"
                                  style={{ color: 'var(--ink-500)' }}
                                >
                                  {idx + 1}
                                </span>
                              )}
                            </td>
                            <td>
                              <p className="font-medium">
                                {r.full_name ?? '—'}
                                {isMe && (
                                  <span
                                    className="ml-2 text-xs font-normal"
                                    style={{ color: 'var(--accent)' }}
                                  >
                                    (you)
                                  </span>
                                )}
                              </p>
                            </td>
                            <td className="font-mono text-xs">
                              L{r.current_level}
                            </td>
                            <td>
                              <span className="font-mono">
                                {Number(r.total_score ?? 0).toFixed(1)}%
                              </span>
                            </td>
                            <td>
                              <span className="font-mono">
                                {r.quiz_score.toFixed(0)}%
                              </span>
                              {r.quiz_total > 0 && (
                                <span className="text-xs ml-1" style={{ color: 'var(--ink-500)' }}>
                                  ({r.quiz_correct}/{r.quiz_total})
                                </span>
                              )}
                            </td>
                            <td className="font-mono font-semibold">
                              {r.combined.toFixed(1)}%
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
                    <TrendingUp size={16} style={{ color: 'var(--accent)' }} /> Top
                    scorer per assignment
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {toppers.map((t) => {
                      const isMe = t.topper?.student_id === me.userId;
                      return (
                        <div
                          key={t.id}
                          className="card"
                          style={
                            isMe
                              ? {
                                  borderColor: 'var(--accent)',
                                  background: 'var(--accent-soft)',
                                }
                              : undefined
                          }
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-display font-semibold leading-tight">
                              {t.title}
                            </p>
                            <Pill tone={t.kind === 'assessment' ? 'accent' : 'blue'}>
                              {t.kind}
                            </Pill>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <Trophy size={14} style={{ color: '#eab308' }} />
                            <p className="text-sm font-medium">
                              {t.topper?.profiles?.full_name ?? '—'}
                              {isMe && (
                                <span
                                  className="ml-1 text-xs"
                                  style={{ color: 'var(--accent)' }}
                                >
                                  (you)
                                </span>
                              )}
                            </p>
                          </div>
                          <p
                            className="text-xs mt-1 font-mono"
                            style={{ color: 'var(--ink-500)' }}
                          >
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
