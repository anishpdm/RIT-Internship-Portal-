import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createClient();
  let query = supabase
    .from('submissions')
    .select(
      '*, profiles:student_id (full_name, email), assignments:assignment_id (title, max_score, internship_id, internships:internship_id (title))',
    )
    .order('submitted_at', { ascending: false })
    .limit(200);

  if (searchParams.status) query = query.eq('status', searchParams.status);
  const { data: subs } = await query;

  // Fetch evaluator names separately
  const evaluatorIds = Array.from(
    new Set(
      (subs ?? [])
        .map((s: any) => s.evaluated_by)
        .filter(Boolean),
    ),
  );
  let evaluatorMap = new Map<string, string>();
  if (evaluatorIds.length > 0) {
    const { data: evaluators } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', evaluatorIds);
    for (const e of evaluators ?? []) {
      evaluatorMap.set(e.id, e.full_name ?? e.email ?? '—');
    }
  }

  const tabs = ['submitted', 'under_review', 'graded', 'returned'];

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Submissions"
        subtitle="Every submission across every internship — latest first."
      />

      <div className="flex gap-2 mb-6">
        <Link
          href="/admin/submissions"
          className={`pill ${!searchParams.status ? 'pill-accent' : ''}`}
        >
          All
        </Link>
        {tabs.map((t) => (
          <Link
            key={t}
            href={`/admin/submissions?status=${t}`}
            className={`pill ${searchParams.status === t ? 'pill-accent' : ''}`}
          >
            {t.replace('_', ' ')}
          </Link>
        ))}
      </div>

      {subs && subs.length > 0 ? (
        <div className="card p-0 overflow-hidden table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Assignment</th>
                <th>Internship</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Score</th>
                <th>Evaluated by</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s: any) => (
                <tr key={s.id}>
                  <td>
                    <p className="font-medium">{s.profiles?.full_name ?? '—'}</p>
                    <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                      {s.profiles?.email}
                    </p>
                  </td>
                  <td className="text-sm">{s.assignments?.title}</td>
                  <td className="text-sm" style={{ color: 'var(--ink-500)' }}>
                    {s.assignments?.internships?.title}
                  </td>
                  <td className="text-xs">{formatDateTime(s.submitted_at)}</td>
                  <td>
                    <Pill
                      tone={
                        s.status === 'graded'
                          ? 'green'
                          : s.status === 'returned'
                            ? 'red'
                            : 'blue'
                      }
                    >
                      {s.status}
                    </Pill>
                  </td>
                  <td className="font-mono text-sm">
                    {s.score != null
                      ? `${s.score} / ${s.assignments?.max_score ?? '—'}`
                      : '—'}
                  </td>
                  <td className="text-sm">
                    {s.evaluated_by ? (
                      <>
                        <p>{evaluatorMap.get(s.evaluated_by) ?? '—'}</p>
                        {s.evaluated_at && (
                          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                            {formatDateTime(s.evaluated_at)}
                          </p>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--ink-500)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <Link
                      href={`/admin/submissions/${s.id}`}
                      className="text-sm link"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No submissions match" />
      )}
    </>
  );
}
