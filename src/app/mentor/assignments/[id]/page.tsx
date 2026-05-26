import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, Trash2, ExternalLink, Pencil } from 'lucide-react';
import SubmissionBadges from '@/components/SubmissionBadges';
import PrintButton from '@/components/PrintButton';
import PrintHeader from '@/components/PrintHeader';
import ConfirmDeleteButton from '@/components/ConfirmDeleteButton';

export const dynamic = 'force-dynamic';

async function deleteAssignment(formData: FormData) {
  'use server';
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');

  if (me.profile.role === 'mentor') {
    const { data: a } = await supabase
      .from('assignments').select('internship_id').eq('id', id).single();
    if (a) {
      const { data: ma } = await supabase
        .from('mentor_assignments').select('id')
        .eq('mentor_id', me.userId).eq('internship_id', a.internship_id).maybeSingle();
      if (!ma) redirect('/mentor/assignments');
    }
  }

  await supabase.from('assignments').delete().eq('id', id);
  await logAudit({
    actor_id: me.userId, actor_role: me.profile.role,
    action: 'assignment.delete', entity_type: 'assignment', entity_id: id,
  });
  revalidatePath('/mentor/assignments');
  redirect('/mentor/assignments');
}

export default async function MentorAssignmentDetailPage({ params }: { params: { id: string } }) {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  const { data: assignment } = await supabase
    .from('assignments')
    .select('*, internships:internship_id (id, title), levels:level_id (level_number, title)')
    .eq('id', params.id)
    .single();

  if (!assignment) notFound();

  if (me.profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments').select('id')
      .eq('mentor_id', me.userId).eq('internship_id', assignment.internship_id).maybeSingle();
    if (!ma) redirect('/mentor/assignments');
  }

  const { data: submissions } = await supabase
    .from('submissions')
    .select('*, profiles:student_id (full_name, email)')
    .eq('assignment_id', params.id)
    .order('submitted_at', { ascending: false });

  // Evaluator names
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

  // Fetch feedback for this assignment — gated by internship visibility flag
  const { data: internship } = await supabase
    .from('internships')
    .select('feedback_visible_to_mentors')
    .eq('id', (assignment as any).internship_id)
    .single();

  const canSeeFeedback = !!internship?.feedback_visible_to_mentors;

  const { data: feedbackRows } = canSeeFeedback
    ? await supabase
        .from('assignment_feedback')
        .select(
          'session_rating, trainer_rating, overall_rating, comment, created_at, student_id, profiles:student_id (full_name, email)',
        )
        .eq('assignment_id', params.id)
        .order('created_at', { ascending: false })
    : { data: [] as any[] };

  const fbCount = feedbackRows?.length ?? 0;
  const avg = (key: 'session_rating' | 'trainer_rating' | 'overall_rating') => {
    if (!feedbackRows || feedbackRows.length === 0) return null;
    const vals = feedbackRows.map((r: any) => r[key]).filter((v) => v != null);
    if (vals.length === 0) return null;
    return (vals.reduce((s: number, v: number) => s + v, 0) / vals.length).toFixed(1);
  };
  const avgSession = avg('session_rating');
  const avgTrainer = avg('trainer_rating');
  const avgOverall = avg('overall_rating');

  return (
    <>
      <PrintHeader
        title={`${assignment.title} — Assignment Report`}
        subtitle={`${(assignment as any).internships?.title ?? ''} · ${assignment.kind} · max ${assignment.max_score} · ${submissions?.length ?? 0} submissions`}
      />

      <PageHeader
        eyebrow={`Mentor / ${(assignment as any).internships?.title ?? 'Assignment'}`}
        title={assignment.title}
        subtitle={`${assignment.kind} · max ${assignment.max_score} · weight ${assignment.weight}`}
        actions={
          <>
            <Link
              href={`/mentor/assignments/${params.id}/edit`}
              className="btn btn-secondary"
            >
              <Pencil size={14} /> Edit
            </Link>
            <PrintButton label="Print" />
            <Link href="/mentor/assignments" className="btn btn-ghost">
              <ArrowLeft size={16} /> Back
            </Link>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5 mb-8">
        <div className="card">
          <p className="eyebrow">Due</p>
          <p className="font-display text-lg font-semibold mt-2">{formatDateTime(assignment.due_at)}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Submissions</p>
          <p className="stat-num mt-2">{submissions?.length ?? 0}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Methods</p>
          <p className="mt-2 flex gap-1 flex-wrap">
            {assignment.allow_github && <Pill tone="blue">GitHub</Pill>}
            {assignment.allow_file_upload && <Pill tone="blue">File</Pill>}
          </p>
        </div>
      </div>

      {assignment.description && (
        <div className="card mb-8">
          <p className="eyebrow">Brief</p>
          <p className="mt-2 leading-relaxed whitespace-pre-wrap">{assignment.description}</p>
          {assignment.attachment_url && (
            <a href={assignment.attachment_url} target="_blank" rel="noreferrer"
              className="text-sm inline-flex items-center gap-1 mt-3 link">
              <ExternalLink size={14} /> Reference attachment
            </a>
          )}
        </div>
      )}

      <h2 className="font-display text-xl font-semibold mb-4">Student feedback</h2>

      {!canSeeFeedback ? (
        <div className="card mb-10" style={{ color: 'var(--ink-500)' }}>
          <p className="text-sm">
            Student feedback for this internship is currently visible to admins only.
          </p>
        </div>
      ) : fbCount === 0 ? (
        <div className="card mb-10" style={{ color: 'var(--ink-500)' }}>
          <p className="text-sm">No feedback submitted yet.</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-4 gap-4 mb-5">
            <div className="card">
              <p className="eyebrow">Responses</p>
              <p className="stat-num mt-1" style={{ fontSize: '1.5rem' }}>{fbCount}</p>
            </div>
            {[
              { label: 'Session', val: avgSession },
              { label: 'Trainer', val: avgTrainer },
              { label: 'Overall', val: avgOverall },
            ].map((s) => (
              <div key={s.label} className="card">
                <p className="eyebrow">{s.label}</p>
                <p className="stat-num mt-1" style={{ fontSize: '1.5rem', color: s.val ? '#eab308' : 'var(--ink-500)' }}>
                  {s.val ?? '—'}{s.val && <span className="text-base" style={{ color: '#eab308' }}> ★</span>}
                </p>
              </div>
            ))}
          </div>
          {feedbackRows?.some((r: any) => r.comment) && (
            <div className="card mb-10">
              <p className="eyebrow mb-3">Comments</p>
              <div className="space-y-3">
                {feedbackRows.filter((r: any) => r.comment).map((r: any, i: number) => (
                  <div key={i} className="pl-3" style={{ borderLeft: '3px solid var(--accent)' }}>
                    <p className="text-sm leading-relaxed">{r.comment}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>— {r.profiles?.full_name ?? 'Anonymous'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <h2 className="font-display text-xl font-semibold mb-4">Submissions</h2>

      {submissions && submissions.length > 0 ? (
        <div className="card p-0 overflow-hidden table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th><th>Submitted</th><th>Status</th><th>Score</th>
                <th>Evaluated by</th><th>Link</th><th className="no-print"></th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s: any) => (
                <tr key={s.id}>
                  <td>
                    <p className="font-medium">{s.profiles?.full_name ?? '—'}</p>
                    <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{s.profiles?.email}</p>
                  </td>
                  <td className="text-sm">
                    <p>{formatDateTime(s.submitted_at)}</p>
                    {s.resubmission_count > 0 && s.first_submitted_at && (
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                        first: {formatDateTime(s.first_submitted_at)}
                      </p>
                    )}
                  </td>
                  <td>
                    <div className="space-y-1">
                      <Pill tone={s.status === 'graded' ? 'green' : s.status === 'returned' ? 'red' : 'blue'}>
                        {s.status}
                      </Pill>
                      <SubmissionBadges
                        submittedAt={s.submitted_at}
                        firstSubmittedAt={s.first_submitted_at}
                        dueAt={assignment.due_at}
                        resubmissionCount={s.resubmission_count}
                        size="sm"
                      />
                    </div>
                  </td>
                  <td className="font-mono text-sm">{s.score != null ? `${s.score} / ${assignment.max_score}` : '—'}</td>
                  <td className="text-sm">
                    {s.evaluated_by ? (
                      <>
                        <p>{evaluatorMap.get(s.evaluated_by) ?? '—'}</p>
                        {s.evaluated_at && (
                          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{formatDateTime(s.evaluated_at)}</p>
                        )}
                      </>
                    ) : <span style={{ color: 'var(--ink-500)' }}>—</span>}
                  </td>
                  <td className="text-xs">
                    {s.github_url && <a href={s.github_url} target="_blank" rel="noreferrer" className="link">GitHub ↗</a>}
                    {s.file_url && <a href={s.file_url} target="_blank" rel="noreferrer" className="link ml-2">File ↗</a>}
                  </td>
                  <td className="no-print"><Link href={`/mentor/evaluate/${s.id}`} className="link text-sm">Evaluate →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState title="No submissions yet" />}

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
