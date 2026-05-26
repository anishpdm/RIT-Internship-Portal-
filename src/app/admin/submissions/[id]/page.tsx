import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Pill } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, ExternalLink, Github } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function gradeSubmission(formData: FormData) {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const id = String(formData.get('id') ?? '');
  const score = parseFloat(String(formData.get('score') ?? '0'));
  const feedback = String(formData.get('feedback') ?? '').trim();
  const action = String(formData.get('action') ?? 'grade');
  const status =
    action === 'return' ? 'returned' : action === 'review' ? 'under_review' : 'graded';

  const updateFields: Record<string, unknown> = {
    status,
    feedback: feedback || null,
    evaluated_by: me.userId,
    evaluated_at: new Date().toISOString(),
  };
  if (status === 'graded') updateFields.score = score;

  const { data: updated, error } = await supabase
    .from('submissions')
    .update(updateFields)
    .eq('id', id)
    .select('*, assignments:assignment_id (internship_id, weight, max_score)')
    .single();

  if (error || !updated) redirect(`/admin/submissions/${id}?error=db`);

  // Recompute weighted score for the enrollment.
  // FIX: denominator = ALL assignments in internship (unsubmitted/ungraded = 0).
  if (status === 'graded') {
    const internship_id = (updated as any).assignments?.internship_id;
    if (internship_id) {
      const { data: allAssignments } = await supabase
        .from('assignments')
        .select('id, weight, max_score')
        .eq('internship_id', internship_id);

      const { data: gradedSubs } = await supabase
        .from('submissions')
        .select('assignment_id, score')
        .eq('student_id', updated.student_id)
        .eq('status', 'graded');

      const gradedMap = new Map<string, number>();
      for (const s of gradedSubs ?? []) {
        if ((s as any).score != null) gradedMap.set(s.assignment_id, Number((s as any).score));
      }

      let totalWeight = 0;
      let earnedWeight = 0;
      for (const a of allAssignments ?? []) {
        const weight = Number((a as any).weight ?? 1);
        const maxScore = Number((a as any).max_score ?? 100);
        totalWeight += weight;
        const studentScore = gradedMap.get(a.id);
        if (studentScore != null && maxScore > 0) {
          earnedWeight += (studentScore / maxScore) * 100 * weight;
        }
      }
      const total = totalWeight > 0 ? earnedWeight / totalWeight : 0;

      await supabase
        .from('enrollments')
        .update({ total_score: total })
        .eq('student_id', updated.student_id)
        .eq('internship_id', internship_id);
    }
  }

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: `submission.${status}`,
    entity_type: 'submission',
    entity_id: id,
    details: { score: status === 'graded' ? score : null },
  });

  revalidatePath(`/admin/submissions/${id}`);
  revalidatePath('/admin/submissions');
}

export default async function AdminEvaluatePage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const { data: sub } = await supabase
    .from('submissions')
    .select(
      '*, profiles:student_id (full_name, email), assignments:assignment_id (title, description, max_score, kind, attachment_url, internships:internship_id (title))',
    )
    .eq('id', params.id)
    .single();

  if (!sub) notFound();

  const a: any = (sub as any).assignments;
  const student: any = (sub as any).profiles;

  // Fetch evaluator name
  let evaluatorName: string | null = null;
  if (sub.evaluated_by) {
    const { data: ev } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', sub.evaluated_by)
      .single();
    evaluatorName = ev?.full_name ?? ev?.email ?? null;
  }

  return (
    <>
      <PageHeader
        eyebrow={`Admin / ${a?.internships?.title ?? '—'}`}
        title={a?.title ?? 'Submission'}
        subtitle={`${student?.full_name ?? student?.email} · submitted ${formatDateTime(sub.submitted_at)}`}
        actions={
          <Link href="/admin/submissions" className="btn btn-ghost">
            <ArrowLeft size={16} /> Submissions
          </Link>
        }
      />

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <p className="eyebrow">Submission</p>
          <div className="mt-3 space-y-2 text-sm">
            {sub.github_url && (
              <a href={sub.github_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 link">
                <Github size={16} /> {sub.github_url}
              </a>
            )}
            {sub.file_url && (
              <a href={sub.file_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 link">
                <ExternalLink size={16} /> Download file
              </a>
            )}
            {sub.notes && (
              <div className="mt-3">
                <p className="eyebrow">Student notes</p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{sub.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <p className="eyebrow">Status</p>
          <div className="mt-2">
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
            <p className="font-display text-3xl font-bold mt-3">
              {sub.score}{' '}
              <span className="text-base font-normal" style={{ color: 'var(--ink-500)' }}>
                / {a?.max_score}
              </span>
            </p>
          )}
          {sub.feedback && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--ink-100)' }}>
              <p className="eyebrow">Existing feedback</p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{sub.feedback}</p>
            </div>
          )}
          {evaluatorName && (
            <p className="mt-3 text-xs" style={{ color: 'var(--ink-500)' }}>
              Evaluated by <strong style={{ color: 'var(--ink-900)' }}>{evaluatorName}</strong>
              {sub.evaluated_at && <> · {formatDateTime(sub.evaluated_at)}</>}
            </p>
          )}
          {a?.attachment_url && (
            <a href={a.attachment_url} target="_blank" rel="noreferrer"
              className="text-sm inline-flex items-center gap-1 mt-3 link">
              <ExternalLink size={14} /> Reference
            </a>
          )}
        </div>
      </div>

      {a?.description && (
        <div className="card mb-8">
          <p className="eyebrow">Brief</p>
          <p className="mt-2 leading-relaxed whitespace-pre-wrap">{a.description}</p>
        </div>
      )}

      <h2 className="font-display text-xl font-semibold mb-4">
        {sub.status === 'graded' ? 'Re-evaluate' : 'Evaluate'}
      </h2>
      <form action={gradeSubmission} className="card max-w-2xl space-y-4">
        <input type="hidden" name="id" value={sub.id} />

        <div>
          <label className="field-label">Score (out of {a?.max_score})</label>
          <input
            type="number"
            name="score"
            min={0}
            max={a?.max_score}
            step="0.5"
            defaultValue={sub.score ?? ''}
            className="field"
          />
        </div>
        <div>
          <label className="field-label">Feedback</label>
          <textarea
            name="feedback"
            rows={5}
            className="field"
            defaultValue={sub.feedback ?? ''}
            placeholder="What worked, what to improve, next steps…"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" name="action" value="grade" className="btn btn-primary">
            {sub.status === 'graded' ? 'Update grade' : 'Grade & finalise'}
          </button>
          <button type="submit" name="action" value="review" className="btn btn-secondary">
            Mark under review
          </button>
          <button type="submit" name="action" value="return" className="btn btn-secondary">
            Return to student
          </button>
        </div>
      </form>
    </>
  );
}
