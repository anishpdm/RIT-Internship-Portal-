import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Stat, Pill, EmptyState } from '@/components/ui';
import { ArrowLeft, Trophy, Users, TrendingUp, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MentorInternshipPerformancePage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  // Scope check
  if (me.profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments')
      .select('id')
      .eq('mentor_id', me.userId)
      .eq('internship_id', params.id)
      .maybeSingle();
    if (!ma) redirect('/mentor/performance');
  }

  const { data: internship } = await supabase
    .from('internships')
    .select('id, title, total_levels')
    .eq('id', params.id)
    .single();

  if (!internship) notFound();

  const { data: rows } = await supabase
    .from('v_internship_leaderboard')
    .select('*')
    .eq('internship_id', params.id)
    .order('total_score', { ascending: false });

  const { count: totalSessions } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('internship_id', params.id);

  const { count: totalAssignments } = await supabase
    .from('assignments')
    .select('id', { count: 'exact', head: true })
    .eq('internship_id', params.id);

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
          rows.reduce((s: number, r: any) => s + Number(r.total_score ?? 0), 0) /
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
      <PageHeader
        eyebrow={`Performance · ${internship.title}`}
        title="Student performance"
        subtitle="Attendance, submissions and scores for every student in this internship."
        actions={
          <Link href="/mentor/performance" className="btn btn-ghost">
            <ArrowLeft size={16} /> All internships
          </Link>
        }
      />

      <div className="grid sm:grid-cols-4 gap-5 mb-8">
        <Stat label="Enrolled" value={rows?.length ?? 0} />
        <Stat label="Cohort avg score" value={`${cohortAvg}%`} />
        <Stat label="Cohort attendance" value={`${cohortAttendanceAvg}%`} />
        <Stat label="Sessions / Assignments" value={`${totalSessions ?? 0} / ${totalAssignments ?? 0}`} />
      </div>

      {rows && rows.length > 0 ? (
        <div className="card p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th>Student</th>
                <th>Level</th>
                <th>Status</th>
                <th>Score</th>
                <th>Attendance</th>
                <th>Submissions</th>
                <th>Graded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, idx: number) => {
                const score = Number(r.total_score ?? 0);
                const attended = Number(r.attended_sessions ?? 0);
                const submitted = submittedMap.get(r.student_id) ?? 0;
                const graded = Number(r.graded_submissions ?? 0);
                const attendancePct =
                  totalSessions && totalSessions > 0
                    ? ((attended / totalSessions) * 100).toFixed(0)
                    : '0';
                const submissionPct =
                  totalAssignments && totalAssignments > 0
                    ? ((submitted / totalAssignments) * 100).toFixed(0)
                    : '0';
                return (
                  <tr key={r.student_id}>
                    <td className="font-mono text-sm" style={{ color: 'var(--ink-500)' }}>
                      {idx < 3 ? (
                        <span style={{ color: 'var(--accent)' }}>
                          <Trophy size={14} className="inline" /> {idx + 1}
                        </span>
                      ) : (
                        idx + 1
                      )}
                    </td>
                    <td>
                      <p className="font-medium">{r.full_name ?? '—'}</p>
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{r.email}</p>
                    </td>
                    <td className="font-mono text-xs">L{r.current_level}</td>
                    <td>
                      <Pill
                        tone={
                          r.status === 'active' ? 'blue'
                            : r.status === 'promoted' ? 'green'
                              : r.status === 'filtered' ? 'red' : 'accent'
                        }
                      >
                        {r.status}
                      </Pill>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold">{score.toFixed(1)}%</span>
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-100)' }}>
                          <div className="h-full" style={{
                            width: `${Math.min(100, score)}%`,
                            background: score >= 70 ? 'var(--green-500)' : score >= 40 ? 'var(--amber-500)' : 'var(--red-500)',
                          }} />
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
          hint="Once students are enrolled, their performance will appear here."
        />
      )}

      <div className="mt-6 text-xs flex gap-6 flex-wrap" style={{ color: 'var(--ink-500)' }}>
        <span className="flex items-center gap-1">
          <TrendingUp size={12} /> Score: weighted average of graded submissions
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={12} /> Attendance: sessions marked present or partial
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} /> Click a student in the cohort to drill in (coming soon)
        </span>
      </div>
    </>
  );
}
