import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function StudentAssignmentsPage() {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('internship_id')
    .eq('student_id', me.userId);
  const internshipIds = enrollments?.map((e: any) => e.internship_id) ?? [];

  let assignments: any[] = [];
  if (internshipIds.length) {
    const { data } = await supabase
      .from('assignments')
      .select(
        'id, title, kind, max_score, due_at, internships:internship_id (title)',
      )
      .in('internship_id', internshipIds)
      .order('due_at', { ascending: false, nullsFirst: false });
    assignments = data ?? [];
  }

  const { data: mySubs } = await supabase
    .from('submissions')
    .select('assignment_id, status, score, submitted_at')
    .eq('student_id', me.userId);
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
        <div className="card p-0 overflow-hidden">
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
