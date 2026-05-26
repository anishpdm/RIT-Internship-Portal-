import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Pill } from '@/components/ui';
import { formatDateTime, relativeTime } from '@/lib/utils';
import { ArrowLeft, ExternalLink, Github, AlertCircle } from 'lucide-react';
import SubmissionForm from './SubmissionForm';
import FeedbackForm from '@/components/FeedbackForm';
import SubmissionBadges from '@/components/SubmissionBadges';

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

  const now = new Date().toISOString();

  // Fetch existing submission to track resubmissions
  const { data: existing } = await supabase
    .from('submissions')
    .select('id, resubmission_count, first_submitted_at')
    .eq('assignment_id', assignment_id)
    .eq('student_id', me.userId)
    .maybeSingle();

  if (existing) {
    // Resubmission — increment count, keep first_submitted_at
    await supabase
      .from('submissions')
      .update({
        github_url: github_url || null,
        file_url: file_url || null,
        notes: notes || null,
        submitted_at: now,
        status: 'submitted',
        score: null,
        feedback: null,
        evaluated_at: null,
        evaluated_by: null,
        resubmission_count: ((existing.resubmission_count ?? 0) + 1),
        first_submitted_at: existing.first_submitted_at ?? now,
      })
      .eq('id', existing.id);
  } else {
    // First submission
    await supabase.from('submissions').insert({
      assignment_id,
      student_id: me.userId,
      github_url: github_url || null,
      file_url: file_url || null,
      notes: notes || null,
      status: 'submitted',
      first_submitted_at: now,
      resubmission_count: 0,
    });
  }

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: existing ? 'submission.resubmit' : 'submission.create',
    entity_type: 'assignment',
    entity_id: assignment_id,
    details: {
      has_github: !!github_url,
      has_file: !!file_url,
      resubmission: !!existing,
    },
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

  const [subRes, feedbackRes] = await Promise.all([
    supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', params.id)
      .eq('student_id', me.userId)
      .maybeSingle(),
    supabase
      .from('assignment_feedback')
      .select('session_rating, trainer_rating, overall_rating, comment')
      .eq('assignment_id', params.id)
      .eq('student_id', me.userId)
      .maybeSingle(),
  ]);
  const sub = subRes.data;
  const existingFeedback = feedbackRes.data;
  const feedbackRequired = !!sub && !existingFeedback;

  // MANDATORY FEEDBACK GATE: if student has submitted but not given feedback,
  // show ONLY the feedback form. They can leave via the sidebar but cannot view
  // their submission, the brief, or resubmit until feedback is given.
  if (feedbackRequired) {
    return (
      <>
        <PageHeader
          eyebrow={(assignment as any).internships?.title ?? 'Assignment'}
          title={assignment.title}
          subtitle="One quick step before you continue."
          actions={
            <Link href="/student/assignments" className="btn btn-ghost">
              <ArrowLeft size={16} /> All assignments
            </Link>
          }
        />

        <div
          className="card mb-6 fade-in"
          style={{
            background:
              'linear-gradient(135deg, var(--accent-soft) 0%, rgba(79, 70, 229, 0.04) 100%)',
            borderColor: 'var(--accent)',
            borderWidth: 2,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <AlertCircle size={18} />
            </div>
            <div>
              <p className="font-display font-semibold">
                Your work is submitted — please rate this session
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--ink-700)' }}>
                Your feedback helps mentors improve. It takes 10 seconds. After you
                submit feedback, you&apos;ll see your submission status here.
              </p>
            </div>
          </div>
        </div>

        <FeedbackForm
          assignmentId={assignment.id}
          existing={existingFeedback}
        />
      </>
    );
  }

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

      {sub && !existingFeedback && (
        <a
          href="#feedback-required"
          className="card mb-6 block fade-in"
          style={{
            background:
              'linear-gradient(135deg, var(--red-soft) 0%, rgba(239, 68, 68, 0.04) 100%)',
            borderColor: 'var(--red-500)',
            borderWidth: 2,
          }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--red-500)', color: 'white' }}
              >
                <AlertCircle size={18} />
              </div>
              <div>
                <p className="font-display font-semibold">
                  Feedback pending
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--ink-700)' }}
                >
                  You&apos;ve submitted this assignment but haven&apos;t given feedback yet. Please share your thoughts below — it&apos;s required.
                </p>
              </div>
            </div>
            <span className="btn btn-primary text-sm">
              Give feedback ↓
            </span>
          </div>
        </a>
      )}

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
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="eyebrow">Your last submission</p>
            <div className="flex items-center gap-2 flex-wrap">
              <SubmissionBadges
                submittedAt={sub.submitted_at}
                firstSubmittedAt={sub.first_submitted_at}
                dueAt={assignment.due_at}
                resubmissionCount={sub.resubmission_count}
              />
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
            {sub.resubmission_count > 0 && sub.first_submitted_at && (
              <>first submitted {formatDateTime(sub.first_submitted_at)} · </>
            )}
            last submitted {formatDateTime(sub.submitted_at)}
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

      {sub && (
        <div className="mt-10" id="feedback-required">
          <FeedbackForm
            assignmentId={assignment.id}
            existing={existingFeedback}
          />
        </div>
      )}
    </>
  );
}
