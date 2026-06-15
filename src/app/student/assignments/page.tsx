import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime, relativeTime } from '@/lib/utils';
import SubmissionBadges from '@/components/SubmissionBadges';
import { getAccessibleLevelIds, levelOrFilter } from '@/lib/level-access';

export const dynamic = 'force-dynamic';

export default async function StudentAssignmentsPage() {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  const access = await getAccessibleLevelIds(me.userId);
  const internshipIds = access?.enrollments.map((e) => e.internship_id) ?? [];

  let assignments: any[] = [];
  if (internshipIds.length && access) {
    const accessibleLevelIds = access.levelIds ?? [];
    const { data } = await supabase
      .from('assignments')
      .select('id, title, kind, max_score, due_at, level_id, is_hidden, internships:internship_id (title)')
      .in('internship_id', internshipIds)
      .order('due_at', { ascending: false, nullsFirst: false });

    assignments = (data ?? []).filter((a: any) =>
      a.is_hidden !== true &&
      (!a.level_id || accessibleLevelIds.includes(a.level_id))
    );
  }

  // Parallel: submissions + feedback
  const [mySubsRes, myFeedbackRes] = await Promise.all([
    supabase
      .from('submissions')
      .select('assignment_id, status, score, submitted_at, first_submitted_at, resubmission_count')
      .eq('student_id', me.userId),
    supabase
      .from('assignment_feedback')
      .select('assignment_id')
      .eq('student_id', me.userId),
  ]);
  const mySubs = mySubsRes.data;
  const feedbackGivenSet = new Set(
    (myFeedbackRes.data ?? []).map((r: any) => r.assignment_id),
  );
  const subMap = new Map<string, any>(
    (mySubs ?? []).map((s: any) => [s.assignment_id, s]),
  );

  return (
    <>
      <PageHeader
        eyebrow="Student"
        title="Assignments"
        subtitle="Tasks across your enrolled internships — submit your work and see your scores."
      />

      {assignments.length > 0 ? (
        <div className="card p-0 overflow-hidden table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Internship</th>
                <th>Kind</th>
                <th>Due</th>
                <th>Status</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a: any) => {
                const sub = subMap.get(a.id);
                return (
                  <tr key={a.id}>
                    <td>
                      <p className="font-display text-base font-medium">{a.title}</p>
                    </td>
                    <td className="text-sm" style={{ color: 'var(--ink-500)' }}>
                      {a.internships?.title}
                    </td>
                    <td>
                      <Pill tone={a.kind === 'assessment' ? 'accent' : 'blue'}>
                        {a.kind}
                      </Pill>
                    </td>
                    <td className="text-sm">
                      {a.due_at ? (
                        <>
                          <p>{formatDateTime(a.due_at)}</p>
                          <p
                            className="text-xs"
                            style={{ color: 'var(--ink-500)' }}
                          >
                            {relativeTime(a.due_at)}
                          </p>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {sub ? (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Pill
                              tone={
                                sub.status === 'graded'
                                  ? 'green'
                                  : sub.status === 'returned'
                                    ? 'red'
                                    : 'blue'
                              }
                            >
                              {sub.status}
                            </Pill>
                            {!feedbackGivenSet.has(a.id) && (
                              <span
                                className="pill"
                                style={{
                                  background: 'var(--red-soft)',
                                  color: 'var(--red-700)',
                                  fontWeight: 600,
                                  fontSize: '0.65rem',
                                }}
                              >
                                ⚠ feedback pending
                              </span>
                            )}
                          </div>
                          <SubmissionBadges
                            submittedAt={sub.submitted_at}
                            firstSubmittedAt={sub.first_submitted_at}
                            dueAt={a.due_at}
                            resubmissionCount={sub.resubmission_count}
                            size="sm"
                          />
                        </div>
                      ) : (
                        <Pill tone="accent">pending</Pill>
                      )}
                    </td>
                    <td className="font-mono text-sm">
                      {sub?.score != null
                        ? `${sub.score} / ${a.max_score}`
                        : '—'}
                    </td>
                    <td>
                      <Link
                        href={`/student/assignments/${a.id}`}
                        className="text-sm"
                        style={{ color: 'var(--accent)' }}
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No assignments yet" />
      )}
    </>
  );
}
