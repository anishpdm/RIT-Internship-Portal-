import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, Trash2, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function deleteAssignment(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  await supabase.from('assignments').delete().eq('id', id);
  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'assignment.delete',
    entity_type: 'assignment',
    entity_id: id,
  });
  revalidatePath('/admin/assignments');
  redirect('/admin/assignments');
}

export default async function AssignmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const { data: assignment } = await supabase
    .from('assignments')
    .select(
      '*, internships:internship_id (id, title), levels:level_id (level_number, title)',
    )
    .eq('id', params.id)
    .single();

  if (!assignment) notFound();

  const { data: submissions } = await supabase
    .from('submissions')
    .select(
      '*, profiles:student_id (full_name, email)',
    )
    .eq('assignment_id', params.id)
    .order('submitted_at', { ascending: false });

  return (
    <>
      <PageHeader
        eyebrow={`Admin / ${(assignment as any).internships?.title ?? 'Assignment'}`}
        title={assignment.title}
        subtitle={`${assignment.kind} · max ${assignment.max_score} · weight ${assignment.weight}`}
        actions={
          <Link href="/admin/assignments" className="btn btn-ghost">
            <ArrowLeft size={16} /> Back
          </Link>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <p className="eyebrow">Due</p>
          <p className="font-display text-xl mt-1">
            {formatDateTime(assignment.due_at)}
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Submissions</p>
          <p className="stat-num">{submissions?.length ?? 0}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Methods</p>
          <p className="mt-1 text-sm">
            {assignment.allow_github && <Pill tone="blue">GitHub</Pill>}{' '}
            {assignment.allow_file_upload && <Pill tone="blue">File</Pill>}
          </p>
        </div>
      </div>

      {assignment.description && (
        <div className="card mb-8">
          <p className="eyebrow">Brief</p>
          <p className="mt-2 leading-relaxed whitespace-pre-wrap">
            {assignment.description}
          </p>
          {assignment.attachment_url && (
            <a
              href={assignment.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm inline-flex items-center gap-1 mt-3"
              style={{ color: 'var(--accent)' }}
            >
              <ExternalLink size={14} /> Reference attachment
            </a>
          )}
        </div>
      )}

      <h2 className="font-display text-2xl mb-4">Submissions</h2>

      {submissions && submissions.length > 0 ? (
        <div className="card p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Score</th>
                <th>Link</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s: any) => (
                <tr key={s.id}>
                  <td>
                    <p className="font-medium">{s.profiles?.full_name ?? '—'}</p>
                    <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                      {s.profiles?.email}
                    </p>
                  </td>
                  <td className="text-sm">{formatDateTime(s.submitted_at)}</td>
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
                    {s.score != null ? `${s.score} / ${assignment.max_score}` : '—'}
                  </td>
                  <td className="text-xs">
                    {s.github_url && (
                      <a
                        href={s.github_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)' }}
                      >
                        GitHub ↗
                      </a>
                    )}
                    {s.file_url && (
                      <a
                        href={s.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2"
                        style={{ color: 'var(--accent)' }}
                      >
                        File ↗
                      </a>
                    )}
                  </td>
                  <td>
                    <Link
                      href={`/mentor/evaluate/${s.id}`}
                      className="text-sm"
                      style={{ color: 'var(--accent)' }}
                    >
                      Evaluate →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No submissions yet" />
      )}

      <form action={deleteAssignment} className="mt-10">
        <input type="hidden" name="id" value={assignment.id} />
        <button type="submit" className="btn btn-ghost text-red-700 text-sm">
          <Trash2 size={14} /> Delete assignment
        </button>
      </form>
    </>
  );
}
