import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MentorAssignmentsPage() {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  const { data: assignments } = await supabase
    .from('mentor_assignments')
    .select('internship_id')
    .eq('mentor_id', me.userId);
  const internshipIds = assignments?.map((a: any) => a.internship_id) ?? [];

  let rows: any[] = [];
  if (internshipIds.length) {
    const { data } = await supabase
      .from('assignments')
      .select(
        'id, title, kind, max_score, due_at, internships:internship_id (title), levels:level_id (level_number)',
      )
      .in('internship_id', internshipIds)
      .order('due_at', { ascending: false, nullsFirst: false });
    rows = data ?? [];
  }

  return (
    <>
      <PageHeader
        eyebrow="Mentor"
        title="Assignments"
        subtitle="Tasks across the internships you mentor."
        actions={
          <Link href="/mentor/assignments/new" className="btn btn-primary">
            <Plus size={16} /> New assignment
          </Link>
        }
      />

      {rows.length > 0 ? (
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
              {rows.map((a) => (
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
                    <Link
                      href={`/mentor/assignments/${a.id}`}
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
        <EmptyState title="No assignments" />
      )}
    </>
  );
}
