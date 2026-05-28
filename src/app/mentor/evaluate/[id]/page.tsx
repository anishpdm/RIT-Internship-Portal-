import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { Pill } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, ExternalLink, Github } from 'lucide-react';
import SubmissionBadges from '@/components/SubmissionBadges';

export const dynamic = 'force-dynamic';

async function gradeSubmission(formData: FormData) {
  'use server';
  const me = await requireRole(['mentor', 'admin']);
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

  if (error || !updated) redirect(`/mentor/evaluate/${id}?error=db`);

  // Recompute total_score for the enrollment.
  // FIX: denominator = ALL assignments in the internship (unsubmitted/ungraded = 0).
  // This matches the v_internship_leaderboard view formula.
  if (status === 'graded') {
    const internship_id = (updated as any).assignments?.internship_id;
    if (internship_id) {
      // Fetch ALL assignments for this internship
      const { data: allAssignments } = await supabase
        .from('assignments')
        .select('id, weight, max_score')
        .eq('internship_id', internship_id);

      // Fetch this student's graded submissions for this internship
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
        // else: 0 — not submitted or not graded yet
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

  revalidatePath(`/mentor/evaluate/${id}`);
  revalidatePath('/mentor/evaluate');
}

export default async function EvaluatePage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['mentor', 'admin']);
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

  const scorePct = sub.score != null && a?.max_score > 0
    ? Math.round((sub.score / a.max_score) * 100) : null;
  const scoreColor = scorePct == null ? 'var(--ink-400)'
    : scorePct >= 80 ? '#10b981' : scorePct >= 60 ? '#3b82f6' : scorePct >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <>
      {/* ── Header banner ── */}
      <div className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0a0f1e 0%,#1e1040 55%,#0c102e 100%)', boxShadow: '0 8px 32px rgba(99,102,241,.20)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '20px 20px' }}/>
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#818cf8' }}>
              {a?.internships?.title ?? 'Evaluate'} · {a?.kind}
            </p>
            <h1 className="font-bold text-2xl text-white mb-1" style={{ letterSpacing: '-.025em' }}>{a?.title ?? 'Submission'}</h1>
            <div className="flex items-center gap-3 flex-wrap mt-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                  style={{ background: 'linear-gradient(135deg,#10b981,#06b6d4)' }}>
                  {(student?.full_name ?? student?.email ?? 'S')[0].toUpperCase()}
                </div>
                <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,.85)' }}>
                  {student?.full_name ?? student?.email ?? '—'}
                </span>
              </div>
              <Pill tone={sub.status === 'graded' ? 'green' : sub.status === 'returned' ? 'red' : 'blue'}>
                {sub.status}
              </Pill>
              <SubmissionBadges
                submittedAt={sub.submitted_at} firstSubmittedAt={sub.first_submitted_at}
                dueAt={a?.due_at} resubmissionCount={sub.resubmission_count}
              />
            </div>
          </div>
          {scorePct != null && (
            <div className="shrink-0 flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center"
                style={{ background: 'rgba(255,255,255,.1)', border: `2px solid ${scoreColor}66` }}>
                <span className="font-black text-2xl" style={{ color: scoreColor }}>{scorePct}%</span>
                <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,.45)' }}>{sub.score}/{a?.max_score}</span>
              </div>
            </div>
          )}
          <Link href="/mentor/evaluate" className="btn shrink-0"
            style={{ background: 'rgba(255,255,255,.1)', color: 'white', borderColor: 'rgba(255,255,255,.15)', fontSize: '.8rem' }}>
            <ArrowLeft size={14}/> Queue
          </Link>
        </div>
      </div>

      {/* ── Info row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Submitted', value: formatDateTime(sub.submitted_at), icon: '📅' },
          { label: 'Max score', value: a?.max_score ?? '—', icon: '🎯' },
          { label: 'Resubmissions', value: sub.resubmission_count ?? 0, icon: '🔄' },
          { label: 'Evaluated by', value: evaluatorName ?? '—', icon: '👤' },
        ].map(item => (
          <div key={item.label} className="card" style={{ padding: '0.875rem 1rem' }}>
            <p className="text-lg mb-1">{item.icon}</p>
            <p className="font-bold text-sm">{item.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-500)' }}>{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6 mb-6">
        {/* Submission content — 3/5 */}
        <div className="lg:col-span-3 space-y-4">
          {/* Links */}
          <div className="card">
            <p className="eyebrow mb-3">Submission content</p>
            {!sub.github_url && !sub.file_url && !sub.notes && (
              <p className="text-sm" style={{ color: 'var(--ink-500)' }}>No content attached.</p>
            )}
            {sub.github_url && (
              <a href={sub.github_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl mb-2"
                style={{ background: 'var(--ink-50)', border: '1.5px solid var(--ink-200)', textDecoration: 'none' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#24292e' }}>
                  <Github size={16} style={{ color: 'white' }}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: 'var(--ink-700)' }}>GitHub Repository</p>
                  <p className="text-xs truncate" style={{ color: 'var(--accent)' }}>{sub.github_url}</p>
                </div>
                <ExternalLink size={13} style={{ color: 'var(--ink-400)', flexShrink: 0 }}/>
              </a>
            )}
            {sub.file_url && (
              <a href={sub.file_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl mb-2"
                style={{ background: 'var(--accent-soft)', border: '1.5px solid rgba(99,102,241,.2)', textDecoration: 'none' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent)' }}>
                  <ExternalLink size={16} style={{ color: 'white' }}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: 'var(--ink-700)' }}>File attachment</p>
                  <p className="text-xs" style={{ color: 'var(--accent)' }}>Click to download</p>
                </div>
                <ExternalLink size={13} style={{ color: 'var(--accent)', flexShrink: 0 }}/>
              </a>
            )}
            {sub.notes && (
              <div className="mt-3 p-3 rounded-xl" style={{ background: 'var(--amber-soft)', border: '1px solid rgba(245,158,11,.2)' }}>
                <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--amber-700)' }}>💬 Student notes</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink-900)' }}>{sub.notes}</p>
              </div>
            )}
          </div>
          {/* Assignment brief */}
          {a?.description && (
            <div className="card">
              <p className="eyebrow mb-2">Assignment brief</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ink-700)' }}>{a.description}</p>
              {a.attachment_url && (
                <a href={a.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs font-semibold link">
                  <ExternalLink size={12}/> View reference
                </a>
              )}
            </div>
          )}
          {/* Previous feedback */}
          {sub.feedback && (
            <div className="card" style={{ borderColor: 'rgba(16,185,129,.3)', background: 'var(--green-soft)' }}>
              <p className="eyebrow mb-2">Previous feedback</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{sub.feedback}</p>
              {evaluatorName && (
                <p className="text-xs mt-3" style={{ color: 'var(--ink-500)' }}>
                  — {evaluatorName}{sub.evaluated_at && `, ${formatDateTime(sub.evaluated_at)}`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Grading panel — 2/5 */}
        <div className="lg:col-span-2">
          <div className="card sticky top-20">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
                <span>✏️</span>
              </div>
              <p className="font-display font-bold text-base">
                {sub.status === 'graded' ? 'Update evaluation' : 'Evaluate submission'}
              </p>
            </div>
            <form action={gradeSubmission} className="space-y-4">
              <input type="hidden" name="id" value={sub.id}/>
              <div>
                <label className="field-label">Score <span style={{ color: 'var(--ink-400)', fontWeight: 400 }}>out of {a?.max_score}</span></label>
                <input type="number" name="score" min={0} max={a?.max_score} step="0.5"
                  defaultValue={sub.score ?? ''} className="field" placeholder="e.g. 85"/>
              </div>
              <div>
                <label className="field-label">Feedback to student</label>
                <textarea name="feedback" rows={5} className="field"
                  defaultValue={sub.feedback ?? ''}
                  placeholder="What worked well, what to improve, next steps…"/>
              </div>
              <div className="space-y-2">
                <button type="submit" name="action" value="grade" className="btn btn-primary w-full">
                  {sub.status === 'graded' ? '✓ Update grade' : '✓ Grade & finalise'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="submit" name="action" value="review" className="btn btn-secondary">
                    Under review
                  </button>
                  <button type="submit" name="action" value="return" className="btn btn-secondary">
                    Return
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
