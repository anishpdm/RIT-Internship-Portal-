import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Stat, EmptyState, Pill } from '@/components/ui';
import { Trophy, Medal, Award, Crown, TrendingUp } from 'lucide-react';
import { computeRanks } from '@/lib/utils';
import { LevelScoreBadges } from '@/components/LevelScores';
import InternshipLeaderboard from './InternshipLeaderboard';

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

  // PARALLEL FETCH
  const [leaderboardData, quizData, assignmentsData, myLevelScoresData, allLevelScoresData, levelsData] = await Promise.all([
    supabase.from('v_internship_leaderboard').select('*').in('internship_id', internshipIds).order('total_score', { ascending: false }),
    supabase.from('v_student_quiz_aggregate').select('student_id, internship_id, quiz_score_pct, total_questions, questions_answered, questions_correct').in('internship_id', internshipIds),
    supabase.from('assignments').select('id, title, kind, max_score, internship_id').in('internship_id', internshipIds),
    // MY level scores (for the "My level scores" card)
    supabase.from('v_student_level_scores').select('internship_id, level_number, level_title, level_score, pass_threshold, reached, graded_count, total_count').eq('student_id', me.userId).in('internship_id', internshipIds),
    // ALL students' level scores (for level-based leaderboard tabs)
    supabase.from('v_student_level_scores').select('student_id, internship_id, level_number, level_score, pass_threshold, reached, graded_count, total_count').in('internship_id', internshipIds),
    // Levels list per internship
    supabase.from('levels').select('id, level_number, title, pass_threshold, internship_id').in('internship_id', internshipIds).order('level_number'),
  ]);

  // Build my level scores map: internship_id → sorted level array
  const myLevelsByInternship = new Map<string, any[]>();
  for (const ls of myLevelScoresData.data ?? []) {
    if (!myLevelsByInternship.has(ls.internship_id)) myLevelsByInternship.set(ls.internship_id, []);
    myLevelsByInternship.get(ls.internship_id)!.push(ls);
  }
  for (const [, arr] of myLevelsByInternship) arr.sort((a: any, b: any) => a.level_number - b.level_number);

  // Build ALL students level scores: internship_id → student_id → level_number → score
  const allLevelsByInternship = new Map<string, Map<string, Map<number, any>>>();
  for (const ls of allLevelScoresData.data ?? []) {
    if (!allLevelsByInternship.has(ls.internship_id)) allLevelsByInternship.set(ls.internship_id, new Map());
    const byStudent = allLevelsByInternship.get(ls.internship_id)!;
    if (!byStudent.has(ls.student_id)) byStudent.set(ls.student_id, new Map());
    byStudent.get(ls.student_id)!.set(ls.level_number, ls);
  }

  // Build levels per internship
  const levelsByInternship = new Map<string, any[]>();
  for (const l of levelsData.data ?? []) {
    if (!levelsByInternship.has(l.internship_id)) levelsByInternship.set(l.internship_id, []);
    levelsByInternship.get(l.internship_id)!.push(l);
  }

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
        subtitle="Combined ranking: 95% from assignments + 5% from quizzes. Click a level tab to see level-specific rankings."
      />

      <div className="space-y-10">
        {internships.map((i: any) => {
          const rows = leaderboards[i.id] ?? [];
          const quizMap = quizAggregates[i.id] ?? new Map();

          const rowsWithCombined = rows.map((r) => {
            const quiz = quizMap.get(r.student_id);
            const quizPct = quiz?.score ?? 0;
            const assignmentPct = Number(r.total_score ?? 0);
            const combined = assignmentPct * 0.95 + quizPct * 0.05;
            return { ...r, quiz_score: quizPct, quiz_correct: quiz?.correct ?? 0, quiz_total: quiz?.total ?? 0, combined };
          });
          rowsWithCombined.sort((a, b) => {
            if (b.combined !== a.combined) return b.combined - a.combined;
            if (b.graded_submissions !== a.graded_submissions) return b.graded_submissions - a.graded_submissions;
            return (b.submitted_count ?? 0) - (a.submitted_count ?? 0);
          });
          const rankedRows = computeRanks(rowsWithCombined, ['combined', 'graded_submissions', 'submitted_count']);
          const toppers = assignmentToppers[i.id] ?? [];
          const levels = levelsByInternship.get(i.id) ?? [];
          // All students' level scores for this internship: student_id → level_number → score
          const allLevels = allLevelsByInternship.get(i.id) ?? new Map();
          const myLevels = myLevelsByInternship.get(i.id) ?? [];
          const enrollment = enrollments?.find((e: any) => e.internship_id === i.id);

          return (
            <InternshipLeaderboard
              key={i.id}
              internship={i}
              rankedRows={rankedRows}
              toppers={toppers}
              levels={levels}
              allLevelScores={allLevels}
              myLevels={myLevels}
              myUserId={me.userId}
              myCurrentLevel={enrollment?.current_level ?? 1}
            />
          );
        })}
      </div>
    </>
  );
}
