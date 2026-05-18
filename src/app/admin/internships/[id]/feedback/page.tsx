import { notFound } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Stat, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, Eye, EyeOff, MessageSquare } from 'lucide-react';
import PrintButton from '@/components/PrintButton';
import PrintHeader from '@/components/PrintHeader';
import { HorizontalBarChart } from '@/components/Charts';

export const dynamic = 'force-dynamic';

async function toggleVisibility(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const supabase = createClient();
  const id = String(formData.get('internship_id') ?? '');
  const visible = formData.get('visible') === 'true';

  await supabase
    .from('internships')
    .update({ feedback_visible_to_mentors: visible })
    .eq('id', id);

  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: visible ? 'feedback.unhide_for_mentors' : 'feedback.hide_from_mentors',
    entity_type: 'internship',
    entity_id: id,
  });

  revalidatePath(`/admin/internships/${id}/feedback`);
  revalidatePath(`/admin/internships/${id}`);
}

export default async function AdminInternshipFeedbackPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole('admin');
  const supabase = createClient();

  const [internshipRes, assignmentsRes] = await Promise.all([
    supabase
      .from('internships')
      .select('id, title, feedback_visible_to_mentors')
      .eq('id', params.id)
      .single(),
    supabase
      .from('assignments')
      .select('id, title, kind, max_score, created_at')
      .eq('internship_id', params.id)
      .order('created_at', { ascending: true }),
  ]);

  if (!internshipRes.data) notFound();
  const internship = internshipRes.data;
  const assignments = assignmentsRes.data ?? [];
  const assignmentIds = assignments.map((a) => a.id);

  const { data: feedback } = assignmentIds.length
    ? await supabase
        .from('assignment_feedback')
        .select(
          'assignment_id, session_rating, trainer_rating, overall_rating, comment, created_at, student_id, profiles:student_id (full_name, email)',
        )
        .in('assignment_id', assignmentIds)
        .order('created_at', { ascending: false })
    : { data: [] as any[] };

  const perAssignment = new Map<
    string,
    { count: number; session: number[]; trainer: number[]; overall: number[] }
  >();
  for (const a of assignments) {
    perAssignment.set(a.id, { count: 0, session: [], trainer: [], overall: [] });
  }
  for (const f of feedback ?? []) {
    const row = perAssignment.get((f as any).assignment_id);
    if (!row) continue;
    row.count++;
    if ((f as any).session_rating != null) row.session.push((f as any).session_rating);
    if ((f as any).trainer_rating != null) row.trainer.push((f as any).trainer_rating);
    if ((f as any).overall_rating != null) row.overall.push((f as any).overall_rating);
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? null : arr.reduce((s, n) => s + n, 0) / arr.length;

  const allSession: number[] = [];
  const allTrainer: number[] = [];
  const allOverall: number[] = [];
  for (const f of (feedback ?? []) as any[]) {
    if (f.session_rating != null) allSession.push(f.session_rating);
    if (f.trainer_rating != null) allTrainer.push(f.trainer_rating);
    if (f.overall_rating != null) allOverall.push(f.overall_rating);
  }
  const totalResponses = feedback?.length ?? 0;
  const uniqueResponders = new Set((feedback ?? []).map((f: any) => f.student_id));
  const allComments = ((feedback ?? []) as any[]).filter((f) => f.comment);

  const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(1));

  return (
    <>
      <PrintHeader
        title={`${internship.title} — Feedback Summary`}
        subtitle={`${totalResponses} response${totalResponses === 1 ? '' : 's'} · ${uniqueResponders.size} unique student${uniqueResponders.size === 1 ? '' : 's'}`}
      />

      <PageHeader
        eyebrow={`Feedback · ${internship.title}`}
        title="Student feedback overview"
        subtitle="Aggregated star ratings and comments from every assignment in this internship."
        actions={
          <>
            <PrintButton label="Print" />
            <Link href={`/admin/internships/${params.id}`} className="btn btn-ghost">
              <ArrowLeft size={16} /> Back
            </Link>
          </>
        }
      />

      {/* Mentor visibility toggle */}
      <div
        className="card mb-8"
        style={{
          borderColor: internship.feedback_visible_to_mentors ? 'var(--green-500)' : 'var(--ink-200)',
          background: internship.feedback_visible_to_mentors ? 'var(--green-soft)' : 'var(--paper)',
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                background: internship.feedback_visible_to_mentors ? 'var(--green-500)' : 'var(--ink-200)',
                color: internship.feedback_visible_to_mentors ? 'white' : 'var(--ink-700)',
              }}
            >
              {internship.feedback_visible_to_mentors ? <Eye size={18} /> : <EyeOff size={18} />}
            </div>
            <div>
              <p className="font-display font-semibold">
                {internship.feedback_visible_to_mentors
                  ? 'Feedback is visible to mentors'
                  : 'Feedback is hidden from mentors'}
              </p>
              <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                {internship.feedback_visible_to_mentors
                  ? 'Mentors of this internship can see star ratings and comments.'
                  : 'Only admins can see star ratings and comments for this internship.'}
              </p>
            </div>
          </div>
          <form action={toggleVisibility}>
            <input type="hidden" name="internship_id" value={internship.id} />
            <input
              type="hidden"
              name="visible"
              value={internship.feedback_visible_to_mentors ? 'false' : 'true'}
            />
            <button
              type="submit"
              className={internship.feedback_visible_to_mentors ? 'btn btn-secondary' : 'btn btn-primary'}
            >
              {internship.feedback_visible_to_mentors ? (
                <><EyeOff size={14} /> Hide from mentors</>
              ) : (
                <><Eye size={14} /> Share with mentors</>
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-5 mb-8">
        <Stat label="Total responses" value={totalResponses} />
        <Stat label="Avg session" value={<span style={{ color: '#eab308' }}>{fmt(avg(allSession))} ★</span>} />
        <Stat label="Avg trainer" value={<span style={{ color: '#eab308' }}>{fmt(avg(allTrainer))} ★</span>} />
        <Stat label="Avg overall" value={<span style={{ color: '#eab308' }}>{fmt(avg(allOverall))} ★</span>} />
      </div>

      {assignments.length > 0 && totalResponses > 0 && (
        <div className="card mb-8">
          <p className="eyebrow mb-3">Average overall rating per assignment</p>
          <HorizontalBarChart
            data={assignments
              .filter((a) => (perAssignment.get(a.id)?.overall.length ?? 0) > 0)
              .map((a) => {
                const r = perAssignment.get(a.id)!;
                const v = avg(r.overall) ?? 0;
                return {
                  label: a.title,
                  value: v * 20,
                  meta: `${r.count} response${r.count === 1 ? '' : 's'} · ${v.toFixed(1)}/5`,
                };
              })}
            max={100}
            unit="%"
            thresholds={{ good: 80, warn: 60 }}
          />
        </div>
      )}

      <h2 className="font-display text-xl font-semibold mb-3">By assignment</h2>
      {assignments.length === 0 ? (
        <EmptyState title="No assignments in this internship yet" />
      ) : (
        <div className="card p-0 overflow-hidden table-wrap mb-8">
          <table className="table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Responses</th>
                <th>Session</th>
                <th>Trainer</th>
                <th>Overall</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const r = perAssignment.get(a.id)!;
                return (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/admin/assignments/${a.id}`} className="link font-medium">
                        {a.title}
                      </Link>
                      <p className="text-xs capitalize" style={{ color: 'var(--ink-500)' }}>{a.kind}</p>
                    </td>
                    <td className="font-mono text-sm">{r.count}</td>
                    <td><span className="font-mono" style={{ color: r.session.length ? '#eab308' : 'var(--ink-500)' }}>{r.session.length ? `${fmt(avg(r.session))} ★` : '—'}</span></td>
                    <td><span className="font-mono" style={{ color: r.trainer.length ? '#eab308' : 'var(--ink-500)' }}>{r.trainer.length ? `${fmt(avg(r.trainer))} ★` : '—'}</span></td>
                    <td><span className="font-mono font-semibold" style={{ color: r.overall.length ? '#eab308' : 'var(--ink-500)' }}>{r.overall.length ? `${fmt(avg(r.overall))} ★` : '—'}</span></td>
                    <td>
                      {r.count > 0 ? (
                        <Link href={`/admin/assignments/${a.id}`} className="text-xs link">View →</Link>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--ink-500)' }}>no data</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {allComments.length > 0 && (
        <>
          <h2 className="font-display text-xl font-semibold mb-3 flex items-center gap-2">
            <MessageSquare size={16} style={{ color: 'var(--accent)' }} />
            All comments ({allComments.length})
          </h2>
          <div className="space-y-3">
            {allComments.map((c: any) => {
              const assignment = assignments.find((a) => a.id === c.assignment_id);
              return (
                <div
                  key={c.created_at + c.student_id}
                  className="card pl-3"
                  style={{ borderLeft: '4px solid var(--accent)' }}
                >
                  <p className="text-sm leading-relaxed mb-2">{c.comment}</p>
                  <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: 'var(--ink-500)' }}>
                    <span>{c.profiles?.full_name ?? 'Anonymous'}</span>
                    <span>·</span>
                    {assignment && (
                      <Link href={`/admin/assignments/${assignment.id}`} className="link">{assignment.title}</Link>
                    )}
                    <span>·</span>
                    <span>{formatDateTime(c.created_at)}</span>
                    {(c.overall_rating ?? c.session_rating ?? c.trainer_rating) && (
                      <>
                        <span>·</span>
                        <span style={{ color: '#eab308' }}>
                          {'★'.repeat(c.overall_rating ?? c.session_rating ?? c.trainer_rating ?? 0)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
