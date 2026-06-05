import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Stat, Pill, EmptyState } from '@/components/ui';
import PrintButton from '@/components/PrintButton';
import PrintHeader from '@/components/PrintHeader';
import { HorizontalBarChart, DonutChart } from '@/components/Charts';
import { ArrowLeft, Trophy, Users, TrendingUp, Calendar } from 'lucide-react';
import { formatDateTime, computeRanks } from '@/lib/utils';
import { LevelScoreBadges } from '@/components/LevelScores';

export const dynamic = 'force-dynamic';

export default async function InternshipPerformancePage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const { data: internship } = await supabase
    .from('internships')
    .select('id, title, total_levels')
    .eq('id', params.id)
    .single();

  if (!internship) notFound();

  // PARALLEL FETCH: leaderboard + quiz aggregate + counts + level scores
  const [leaderboardRes, quizAggRes, sessionsCountRes, assignmentsCountRes, levelScoresRes, levelsRes] = await Promise.all([
    supabase
      .from('v_internship_leaderboard')
      .select('*')
      .eq('internship_id', params.id)
      .order('total_score', { ascending: false }),
    supabase
      .from('v_student_quiz_aggregate')
      .select('student_id, quiz_score_pct, total_questions, questions_answered, questions_correct')
      .eq('internship_id', params.id),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('internship_id', params.id),
    supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('internship_id', params.id),
    supabase
      .from('v_student_level_scores')
      .select('student_id, level_number, level_title, level_score, pass_threshold, reached, graded_count, total_count')
      .eq('internship_id', params.id),
    supabase
      .from('levels')
      .select('id, level_number, title, pass_threshold')
      .eq('internship_id', params.id)
      .order('level_number'),
  ]);
  const baseRows = leaderboardRes.data ?? [];
  const levels = levelsRes.data ?? [];

  // Build level score map: student_id → level_number → score data
  const levelScoreMap = new Map<string, Map<number, any>>();
  for (const ls of levelScoresRes.data ?? []) {
    if (!levelScoreMap.has(ls.student_id)) levelScoreMap.set(ls.student_id, new Map());
    levelScoreMap.get(ls.student_id)!.set(ls.level_number, ls);
  }
  const totalSessions = sessionsCountRes.count;
  const totalAssignments = assignmentsCountRes.count;

  // Quiz map keyed by student
  const quizMap = new Map<
    string,
    { score: number; correct: number; answered: number; total: number }
  >();
  for (const q of quizAggRes.data ?? []) {
    quizMap.set((q as any).student_id, {
      score: Number((q as any).quiz_score_pct ?? 0),
      correct: Number((q as any).questions_correct ?? 0),
      total: Number((q as any).total_questions ?? 0),
      answered: Number((q as any).questions_answered ?? 0),
    });
  }

  // Enrich every row with quiz score + combined (95% assignments + 5% quiz)
  const unsortedRows = baseRows
    .map((r: any) => {
      const quiz = quizMap.get(r.student_id);
      const quizPct = quiz?.score ?? 0;
      const assignmentPct = Number(r.total_score ?? 0);
      const combined = assignmentPct * 0.95 + quizPct * 0.05;
      return {
        ...r,
        quiz_score: quizPct,
        quiz_correct: quiz?.correct ?? 0,
        quiz_answered: quiz?.answered ?? 0,
        combined,
      };
    })
    // Re-sort by COMBINED instead of just assignment total — true ranking
    .sort((a: any, b: any) => {
      if (b.combined !== a.combined) return b.combined - a.combined;
      if ((b.graded_submissions ?? 0) !== (a.graded_submissions ?? 0))
        return (b.graded_submissions ?? 0) - (a.graded_submissions ?? 0);
      return (b.submitted_count ?? 0) - (a.submitted_count ?? 0);
    });

  // Dense ranks so ties share same position number
  const rows = computeRanks(unsortedRows, ['combined', 'graded_submissions', 'submitted_count']);

  // Per-student submitted (not necessarily graded) count
  const studentIds = (rows ?? []).map((r: any) => r.student_id);
  let submittedMap = new Map<string, number>();
  if (studentIds.length > 0) {
    const { data: subs } = await supabase
      .from('submissions')
      .select('student_id, assignments!inner (internship_id)')
      .in('student_id', studentIds)
      .eq('assignments.internship_id', params.id);
    for (const s of subs ?? []) {
      submittedMap.set(
        (s as any).student_id,
        (submittedMap.get((s as any).student_id) ?? 0) + 1,
      );
    }
  }

  const cohortAvg =
    rows && rows.length > 0
      ? (
          rows.reduce((s: number, r: any) => s + Number(r.combined ?? 0), 0) /
          rows.length
        ).toFixed(1)
      : '0.0';

  const cohortQuizAvg =
    rows && rows.length > 0
      ? (
          rows.reduce((s: number, r: any) => s + Number(r.quiz_score ?? 0), 0) /
          rows.length
        ).toFixed(1)
      : '0.0';

  const cohortAttendanceAvg =
    rows && rows.length > 0 && totalSessions
      ? (
          (rows.reduce(
            (s: number, r: any) => s + Number(r.attended_sessions ?? 0),
            0,
          ) /
            (rows.length * totalSessions)) *
          100
        ).toFixed(1)
      : '0.0';

  return (
    <>
      <PrintHeader
        title={`${internship.title} — Performance Report`}
        subtitle={`Enrolled: ${rows?.length ?? 0} · Sessions: ${totalSessions ?? 0} · Assignments: ${totalAssignments ?? 0}`}
      />

      <PageHeader
        eyebrow={`Performance · ${internship.title}`}
        title="Student performance"
        subtitle="Combined leaderboard: 95% from assignment scores + 5% from quizzes. Sorted by combined score."
        actions={
          <>
            <PrintButton label="Print report" />
            <Link
              href={`/admin/internships/${params.id}`}
              className="btn btn-ghost"
            >
              <ArrowLeft size={16} /> Back
            </Link>
          </>
        }
      />

      {/* Cohort summary */}
      <div className="grid sm:grid-cols-4 gap-5 mb-8">
        <Stat label="Enrolled" value={rows?.length ?? 0} />
        <Stat label="Cohort avg (combined)" value={`${cohortAvg}%`} />
        <Stat label="Cohort quiz avg" value={`${cohortQuizAvg}%`} />
        <Stat label="Cohort attendance" value={`${cohortAttendanceAvg}%`} />
      </div>

      {/* Charts */}
      {rows && rows.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-5 mb-8">
          <div className="card">
            <p className="eyebrow mb-3">Combined score distribution</p>
            <HorizontalBarChart
              data={rows.slice(0, 10).map((r: any) => ({
                label: r.full_name ?? r.email ?? '—',
                value: Number(r.combined ?? 0),
                meta: `L${r.current_level} · ${r.status} · Quiz ${Number(r.quiz_score ?? 0).toFixed(0)}%`,
              }))}
              max={100}
              unit="%"
            />
            {rows.length > 10 && (
              <p
                className="text-xs mt-3 text-center"
                style={{ color: 'var(--ink-500)' }}
              >
                Top 10 of {rows.length} shown — see full table below.
              </p>
            )}
          </div>

          <div className="card">
            <p className="eyebrow mb-3">Status breakdown</p>
            <DonutChart
              data={[
                {
                  label: 'Active',
                  value: rows.filter((r: any) => r.status === 'active').length,
                  color: '#3b82f6',
                },
                {
                  label: 'Promoted',
                  value: rows.filter((r: any) => r.status === 'promoted').length,
                  color: '#10b981',
                },
                {
                  label: 'Filtered',
                  value: rows.filter((r: any) => r.status === 'filtered').length,
                  color: '#ef4444',
                },
                {
                  label: 'Completed',
                  value: rows.filter((r: any) => r.status === 'completed').length,
                  color: '#4f46e5',
                },
                {
                  label: 'Dropped',
                  value: rows.filter((r: any) => r.status === 'dropped').length,
                  color: '#64748b',
                },
              ].filter((d) => d.value > 0)}
            />
          </div>
        </div>
      )}

      {/* Performance table */}
      {rows && rows.length > 0 ? (
        <div className="card p-0 overflow-hidden table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 52 }}>#</th>
                <th>Student</th>
                <th>Level</th>
                <th style={{ textAlign: 'right' }}>Assignments</th>
                <th style={{ textAlign: 'right' }}>Quiz</th>
                <th style={{ textAlign: 'center', minWidth: 180 }}>Per-level scores</th>
                <th style={{ textAlign: 'right', minWidth: 130 }}>Combined ▾</th>
                <th style={{ textAlign: 'right' }}>Attendance</th>
                <th style={{ textAlign: 'right' }}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const score     = Number(r.total_score ?? 0);
                const quizScore = Number(r.quiz_score  ?? 0);
                const combined  = Number(r.combined    ?? 0);
                const rank      = r.rank;
                const attended  = Number(r.attended_sessions ?? 0);
                const submitted = submittedMap.get(r.student_id) ?? 0;
                const attendancePct = totalSessions ? Math.round((attended / totalSessions) * 100) : 0;
                const submissionPct = totalAssignments ? Math.round((submitted / totalAssignments) * 100) : 0;

                const initials   = (r.full_name ?? r.email ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
                const COLORS     = ['#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6','#F97316','#6366F1'];
                const avatarColor = COLORS[rank % COLORS.length];
                const scoreColor  = combined >= 90 ? '#10B981' : combined >= 75 ? '#3B82F6' : combined >= 50 ? '#F59E0B' : '#EF4444';
                const rankBadge   = rank === 1
                  ? { bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: 'white', label: '🥇' }
                  : rank === 2 ? { bg: 'linear-gradient(135deg,#94a3b8,#64748b)', color: 'white', label: '🥈' }
                  : rank === 3 ? { bg: 'linear-gradient(135deg,#f97316,#ea580c)', color: 'white', label: '🥉' }
                  : { bg: 'var(--ink-100)', color: 'var(--ink-600)', label: String(rank) };

                // Get this student's level scores
                const myLevelScores = Array.from(levelScoreMap.get(r.student_id)?.values() ?? [])
                  .sort((a: any, b: any) => a.level_number - b.level_number) as any[];

                return (
                  <tr key={r.student_id}>
                    {/* Rank */}
                    <td style={{ padding: '10px 12px' }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                        style={{ background: rankBadge.bg, color: rankBadge.color }}>
                        {rank <= 3 ? rankBadge.label : rank}
                      </div>
                    </td>

                    {/* Student */}
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                          style={{ background: avatarColor, boxShadow: `0 2px 8px ${avatarColor}55` }}>
                          {initials}
                        </div>
                        <div>
                          <Link href={`/admin/students/${r.student_id}`} className="link font-medium text-sm">
                            {r.full_name ?? '—'}
                          </Link>
                          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{r.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Level + status */}
                    <td>
                      <p className="font-mono text-xs font-bold">L{r.current_level}</p>
                      <Pill tone={r.status === 'active' ? 'blue' : r.status === 'promoted' ? 'green' : r.status === 'filtered' ? 'red' : 'accent'}>
                        {r.status}
                      </Pill>
                    </td>

                    {/* Assignments overall */}
                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono text-sm">{score.toFixed(1)}%</span>
                    </td>

                    {/* Quiz */}
                    <td style={{ textAlign: 'right' }}>
                      {(r.quiz_total ?? 0) > 0 ? (
                        <div>
                          <span className="font-mono text-sm">{quizScore.toFixed(0)}%</span>
                          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                            {r.quiz_correct}/{r.quiz_total}
                          </p>
                        </div>
                      ) : <span style={{ color: 'var(--ink-300)' }}>—</span>}
                    </td>

                    {/* Per-level score pills */}
                    <td style={{ textAlign: 'center' }}>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {myLevelScores.length > 0 ? myLevelScores.map((ls: any) => {
                          const lPct   = ls.level_score ?? 0;
                          const passed = lPct >= (ls.pass_threshold ?? 60);
                          const locked = !ls.reached;
                          const lColor = locked ? '#94a3b8' : passed ? '#10b981' : lPct >= (ls.pass_threshold ?? 60) * 0.75 ? '#f59e0b' : '#ef4444';
                          return (
                            <div key={ls.level_number}
                              title={`L${ls.level_number}: ${lPct.toFixed(1)}% (pass ${ls.pass_threshold}%) · ${ls.graded_count}/${ls.total_count} graded`}
                              className="rounded px-1.5 py-0.5 text-center"
                              style={{
                                background: locked ? 'var(--ink-50)' : `${lColor}18`,
                                border: `1px solid ${locked ? 'var(--ink-200)' : `${lColor}44`}`,
                                minWidth: 46,
                              }}>
                              <p className="text-[9px] font-bold" style={{ color: 'var(--ink-400)' }}>L{ls.level_number}</p>
                              <p className="font-mono font-bold text-xs" style={{ color: locked ? 'var(--ink-300)' : lColor }}>
                                {locked ? '—' : `${lPct.toFixed(0)}%`}
                              </p>
                              {!locked && passed && <p style={{ fontSize: '.55rem', color: lColor }}>✓</p>}
                            </div>
                          );
                        }) : <span style={{ color: 'var(--ink-300)', fontSize: '.8rem' }}>—</span>}
                      </div>
                    </td>

                    {/* Combined with bar */}
                    <td style={{ textAlign: 'right' }}>
                      <p className="font-bold" style={{ color: scoreColor }}>{combined.toFixed(2)}%</p>
                      <div className="h-1.5 rounded-full overflow-hidden mt-1 ml-auto" style={{ width: 72, background: 'var(--ink-100)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, combined)}%`, background: scoreColor }}/>
                      </div>
                    </td>

                    {/* Attendance */}
                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono text-sm">{attendancePct}%</span>
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{attended}/{totalSessions ?? 0}</p>
                    </td>

                    {/* Submitted */}
                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono text-sm">{submissionPct}%</span>
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{submitted}/{totalAssignments ?? 0}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No students enrolled yet"
          hint="Enrol students from the internship detail page."
        />
      )}

      {/* Legend */}
      <div className="mt-6 text-xs flex gap-6 flex-wrap" style={{ color: 'var(--ink-500)' }}>
        <span className="flex items-center gap-1">
          <TrendingUp size={12} /> Score: weighted average of graded submissions
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={12} /> Attendance: sessions marked present or partial
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} /> Click "Back to internship" to manage students
        </span>
      </div>
    </>
  );
}
