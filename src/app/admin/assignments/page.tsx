import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams: { internship?: string; kind?: string };
}) {
  const supabase = createClient();
  let query = supabase
    .from('assignments')
    .select(
      'id, title, kind, max_score, due_at, internship_id, level_id, internships:internship_id (title), levels:level_id (level_number)',
    )
    .order('due_at', { ascending: false, nullsFirst: false });
  if (searchParams.internship)
    query = query.eq('internship_id', searchParams.internship);
  if (searchParams.kind) query = query.eq('kind', searchParams.kind);
  const { data: assignments } = await query;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Assignments"
        subtitle="Daily exercises, weekly tasks, monthly projects, and level assessments."
        actions={
          <Link href="/admin/assignments/new" className="btn btn-primary">
            <Plus size={16} /> New assignment
          </Link>
        }
      />

      {assignments && assignments.length > 0 ? (
        <div className="card p-0 overflow-hidden table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Internship</th>
                <th>Level</th>
                <th>Kind</th>
                <th>Max</th>
                <th>Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a: any) => (
                <tr key={a.id}>
                  <td>
                    <p className="font-display text-base font-medium">{a.title}</p>
                  </td>
                  <td className="text-sm" style={{ color: 'var(--ink-500)' }}>
                    {a.internships?.title}
                  </td>
                  <td className="font-mono text-xs">
                    {a.levels?.level_number ? `L${a.levels.level_number}` : '—'}
                  </td>
                  <td>
                    <Pill tone={a.kind === 'assessment' ? 'accent' : 'blue'}>
                      {a.kind}
                    </Pill>
                  </td>
                  <td className="font-mono text-xs">{a.max_score}</td>
                  <td className="text-sm">{formatDateTime(a.due_at)}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/assignments/${a.id}`}
                        className="text-sm link"
                      >
                        Open →
                      </Link>
                      <Link
                        href={`/admin/assignments/${a.id}/edit`}
                        className="text-sm link"
                        style={{ color: 'var(--ink-500)' }}
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No assignments yet"
          hint="Create the first assignment to start tracking submissions and scoring."
        />
      )}
    </>
  );
}
