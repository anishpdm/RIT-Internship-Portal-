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
import PerformanceTable from '@/components/PerformanceTable';

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
  // Serialise levelScoreMap to plain object for client component
  const levelScoreObj: Record<string, Record<number, any>> = {};
  for (const [sid, levelMap] of levelScoreMap.entries()) {
    levelScoreObj[sid] = {};
    for (const [ln, ls] of levelMap.entries()) {
      levelScoreObj[sid][ln] = ls;
    }
  }

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
        quiz_total: quiz?.total ?? 0,
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

      {/* Performance table with level tabs */}
      <PerformanceTable
        rows={rows}
        levels={levels}
        levelScoreMap={levelScoreObj}
        totalSessions={sessionsCountRes.count ?? 0}
        totalAssignments={assignmentsCountRes.count ?? 0}
        internshipId={params.id}
      />
    </>
  );
}