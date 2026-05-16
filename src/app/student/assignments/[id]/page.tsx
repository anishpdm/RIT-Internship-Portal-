import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Pill } from '@/components/ui';
import { formatDateTime, relativeTime } from '@/lib/utils';
import { ArrowLeft, ExternalLink, Github } from 'lucide-react';
import SubmissionForm from './SubmissionForm';

export const dynamic = 'force-dynamic';

async function submitAssignment(formData: FormData) {
  'use server';
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  const assignment_id = String(formData.get('assignment_id') ?? '');
  const github_url = String(formData.get('github_url') ?? '').trim();
  const file_url = String(formData.get('file_url') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();

  if (!assignment_id) redirect('/student/assignments');

  if (!github_url && !file_url) {
    redirect(`/student/assignments/${assignment_id}?error=empty`);
  }

  // Upsert (one submission per student per assignment)
  const { data: existing } = await supabase
    .from('submissions')
    .select('id')
    .eq('assignment_id', assignment_id)
    .eq('student_id', me.userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('submissions')
      .update({
        github_url: github_url || null,
        file_url: file_url || null,
        notes: notes || null,
        submitted_at: new Date().toISOString(),
        status: 'submitted',
        score: null,
        feedback: null,
        evaluated_at: null,
        evaluated_by: null,
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('submissions').insert({
      assignment_id,
      student_id: me.userId,
      github_url: github_url || null,
      file_url: file_url || null,
      notes: notes || null,
      status: 'submitted',
    });
  }

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'submission.create',
    entity_type: 'assignment',
    entity_id: assignment_id,
    details: { has_github: !!github_url, has_file: !!file_url },
  });

  revalidatePath(`/student/assignments/${assignment_id}`);
}

export default async function StudentAssignmentDetail({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  const { data: assignment } = await supabase
    .from('assignments')
    .select('*, internships:internship_id (title)')
    .eq('id', params.id)
    .single();
  if (!assignment) notFound();

  const { data: sub } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', params.id)
    .eq('student_id', me.userId)
    .maybeSingle();

  return (
    <>
      <PageHeader
        eyebrow={(assignment as any).internships?.title ?? 'Assignment'}
        title={assignment.title}
        subtitle={`${assignment.kind} · max ${assignment.max_score}${assignment.due_at ? ` · due ${formatDateTime(assignment.due_at)}` : ''}`}
        actions={
          <Link href="/student/assignments" className="btn btn-ghost">
            <ArrowLeft size={16} /> All assignments
          </Link>
        }
      />

      {assignment.description && (
        <div className="card mb-6">
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
              <ExternalLink size={14} /> Reference material
            </a>
          )}
        </div>
      )}

      {assignment.due_at && (
        <div className="card mb-6 flex items-center justify-between">
          <p className="font-display text-lg">Due {formatDateTime(assignment.due_at)}</p>
          <p className="text-sm font-mono" style={{ color: 'var(--ink-500)' }}>
            {relativeTime(assignment.due_at)}
          </p>
        </div>
      )}

      {sub && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow">Your last submission</p>
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
          </div>
          {sub.score != null && (
            <p className="font-display text-3xl mb-3">
              {sub.score}{' '}
              <span className="text-base" style={{ color: 'var(--ink-500)' }}>
                / {assignment.max_score}
              </span>
            </p>
          )}
          <div className="text-sm space-y-2">
            {sub.github_url && (
              <a
                href={sub.github_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2"
                style={{ color: 'var(--accent)' }}
              >
                <Github size={14} /> {sub.github_url}
              </a>
            )}
            {sub.file_url && (
              <a
                href={sub.file_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2"
                style={{ color: 'var(--accent)' }}
              >
                <ExternalLink size={14} /> File attachment
              </a>
            )}
          </div>
          {sub.feedback && (
            <div className="mt-4 pt-4 border-t border-stone-200">
              <p className="eyebrow">Mentor feedback</p>
              <p className="mt-2 leading-relaxed whitespace-pre-wrap">{sub.feedback}</p>
            </div>
          )}
          <p className="text-xs mt-4" style={{ color: 'var(--ink-500)' }}>
            submitted {formatDateTime(sub.submitted_at)}
          </p>
        </div>
      )}

      <h2 className="font-display text-2xl mb-4">
        {sub ? 'Resubmit' : 'Submit your work'}
      </h2>
      <SubmissionForm
        assignmentId={assignment.id}
        allowGithub={assignment.allow_github}
        allowFile={assignment.allow_file_upload}
        action={submitAssignment}
        defaultGithub={sub?.github_url ?? ''}
        defaultNotes={sub?.notes ?? ''}
      />
    </>
  );
}
