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

  // PARALLEL FETCH: leaderboard + quiz aggregate + counts — all in one wave
  const [leaderboardRes, quizAggRes, sessionsCountRes, assignmentsCountRes] = await Promise.all([
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
  ]);
  const baseRows = leaderboardRes.data ?? [];
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
                <th style={{ width: '50px' }}>#</th>
                <th>Student</th>
                <th>Level</th>
                <th>Status</th>
                <th>Assignments</th>
                <th>Quiz</th>
                <th>Combined</th>
                <th>Attendance</th>
                <th>Submissions</th>
                <th>Graded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const score = Number(r.total_score ?? 0);
                const quizScore = Number(r.quiz_score ?? 0);
                const combined = Number(r.combined ?? 0);
                const rank = r.rank;
                const attended = Number(r.attended_sessions ?? 0);
                const submitted = submittedMap.get(r.student_id) ?? 0;
                const graded = Number(r.graded_submissions ?? 0);
                const attendancePct = totalSessions && totalSessions > 0 ? ((attended / totalSessions) * 100).toFixed(0) : '0';
                const submissionPct = totalAssignments && totalAssignments > 0 ? ((submitted / totalAssignments) * 100).toFixed(0) : '0';

                const initials = (r.full_name ?? r.email ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
                const AVATAR_COLORS = ['#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6','#F97316','#6366F1'];
                const avatarColor = AVATAR_COLORS[rank % AVATAR_COLORS.length];
                const scoreColor = combined >= 90 ? '#10B981' : combined >= 75 ? '#3B82F6' : combined >= 50 ? '#F59E0B' : '#EF4444';
                const rankBadge = rank === 1
                  ? { bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: 'white', label: '🥇' }
                  : rank === 2
                  ? { bg: 'linear-gradient(135deg,#94a3b8,#64748b)', color: 'white', label: '🥈' }
                  : rank === 3
                  ? { bg: 'linear-gradient(135deg,#f97316,#ea580c)', color: 'white', label: '🥉' }
                  : { bg: 'var(--ink-100)', color: 'var(--ink-600)', label: String(rank) };

                return (
                  <tr key={r.student_id}>
                    <td style={{ padding: '10px 12px', width: 56 }}>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                        style={{ background: rankBadge.bg, color: rankBadge.color }}
                      >
                        {rank <= 3 ? rankBadge.label : rank}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                          style={{ background: avatarColor, boxShadow: `0 2px 8px ${avatarColor}55` }}
                        >
                          {initials}
                        </div>
                        <div>
                          <Link href={`/admin/students/${r.student_id}`} className="link font-medium">
                            {r.full_name ?? '—'}
                          </Link>
                          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{r.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs">L{r.current_level}</td>
                    <td>
                      <Pill
                        tone={
                          r.status === 'active'
                            ? 'blue'
                            : r.status === 'promoted'
                              ? 'green'
                              : r.status === 'filtered'
                                ? 'red'
                                : 'accent'
                        }
                      >
                        {r.status}
                      </Pill>
                    </td>
                    <td>
                      <span className="font-mono">{score.toFixed(1)}%</span>
                    </td>
                    <td>
                      {r.quiz_answered > 0 ? (
                        <>
                          <span className="font-mono text-sm">{quizScore.toFixed(0)}%</span>
                          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                            {r.quiz_correct}/{r.quiz_answered}
                          </p>
                        </>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
                          —
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold" style={{ color: scoreColor }}>
                          {combined.toFixed(2)}%
                        </span>
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-100)' }}>
                          <div className="h-full" style={{ width: `${Math.min(100, combined)}%`, background: scoreColor }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">{attendancePct}%</span>
                        <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
                          {attended}/{totalSessions ?? 0}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">{submissionPct}%</span>
                        <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
                          {submitted}/{totalAssignments ?? 0}
                        </span>
                      </div>
                    </td>
                    <td className="font-mono text-sm">{graded}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No students enrolled yet"
          hint="Enrol students from the internship detail page to see their performance."
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
