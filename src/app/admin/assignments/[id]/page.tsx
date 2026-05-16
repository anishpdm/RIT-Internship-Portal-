import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, Trash2, ExternalLink } from 'lucide-react';
import PrintButton from '@/components/PrintButton';
import PrintHeader from '@/components/PrintHeader';
import ConfirmDeleteButton from '@/components/ConfirmDeleteButton';

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

  // Fetch evaluator names separately (to avoid FK ambiguity in joins)
  const evaluatorIds = Array.from(
    new Set(
      (submissions ?? [])
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

  return (
    <>
      <PrintHeader
        title={`${assignment.title} — Assignment Report`}
        subtitle={`${(assignment as any).internships?.title ?? ''} · ${assignment.kind} · max ${assignment.max_score} · ${submissions?.length ?? 0} submissions`}
      />

      <PageHeader
        eyebrow={`Admin / ${(assignment as any).internships?.title ?? 'Assignment'}`}
        title={assignment.title}
        subtitle={`${assignment.kind} · max ${assignment.max_score} · weight ${assignment.weight}`}
        actions={
          <>
            <PrintButton label="Print" />
            <Link href="/admin/assignments" className="btn btn-ghost">
              <ArrowLeft size={16} /> Back
            </Link>
          </>
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
        <div className="card p-0 overflow-hidden table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Score</th>
                <th>Evaluated by</th>
                <th>Link</th>
                <th className="no-print"></th>
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
                  <td className="text-xs">
                    {s.github_url && (
                      <a
                        href={s.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="link"
                      >
                        GitHub ↗
                      </a>
                    )}
                    {s.file_url && (
                      <a
                        href={s.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 link"
                      >
                        File ↗
                      </a>
                    )}
                  </td>
                  <td className="no-print">
                    <Link
                      href={`/admin/submissions/${s.id}`}
                      className="text-sm link"
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

      <div className="mt-10">
        <ConfirmDeleteButton
          action={deleteAssignment}
          fields={[{ name: 'id', value: assignment.id }]}
          itemName={assignment.title}
          itemType="assignment"
          warning="All submissions, scores, and feedback for this assignment will be permanently deleted."
          buttonLabel=" Delete assignment"
          buttonClass="btn btn-danger text-sm"
        />
      </div>
    </>
  );
}
