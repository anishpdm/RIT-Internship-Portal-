import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Stat, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, EyeOff, MessageSquare } from 'lucide-react';
import PrintButton from '@/components/PrintButton';
import PrintHeader from '@/components/PrintHeader';
import { HorizontalBarChart } from '@/components/Charts';

export const dynamic = 'force-dynamic';

export default async function MentorInternshipFeedbackPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  if (me.profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments')
      .select('id')
      .eq('mentor_id', me.userId)
      .eq('internship_id', params.id)
      .maybeSingle();
    if (!ma) notFound();
  }

  const [internshipRes, assignmentsRes] = await Promise.all([
    supabase
      .from('internships')
      .select('id, title, feedback_visible_to_mentors')
      .eq('id', params.id)
      .single(),
    supabase
      .from('assignments')
      .select('id, title, kind, created_at')
      .eq('internship_id', params.id)
      .order('created_at'),
  ]);

  if (!internshipRes.data) notFound();
  const internship = internshipRes.data;

  if (me.profile.role === 'mentor' && !internship.feedback_visible_to_mentors) {
    return (
      <>
        <PageHeader
          eyebrow={`Feedback · ${internship.title}`}
          title="Feedback not shared yet"
          actions={
            <Link href={`/mentor/performance/${params.id}`} className="btn btn-ghost">
              <ArrowLeft size={16} /> Back
            </Link>
          }
        />
        <div className="card text-center" style={{ padding: '3rem 1.5rem', color: 'var(--ink-500)' }}>
          <EyeOff size={32} style={{ margin: '0 auto 1rem' }} />
          <p className="font-display text-lg font-semibold mb-1" style={{ color: 'var(--ink-700)' }}>
            Feedback is not visible yet
          </p>
          <p className="text-sm">
            The admin needs to share feedback for this internship before mentors can view it.
          </p>
        </div>
      </>
    );
  }

  const assignments = assignmentsRes.data ?? [];
  const assignmentIds = assignments.map((a) => a.id);

  const { data: feedback } = assignmentIds.length
    ? await supabase
        .from('assignment_feedback')
        .select(
          'assignment_id, session_rating, trainer_rating, overall_rating, comment, created_at, student_id, profiles:student_id (full_name)',
        )
        .in('assignment_id', assignmentIds)
        .order('created_at', { ascending: false })
    : { data: [] as any[] };

  const perAssignment = new Map<string, { count: number; session: number[]; trainer: number[]; overall: number[] }>();
  for (const a of assignments) {
    perAssignment.set(a.id, { count: 0, session: [], trainer: [], overall: [] });
  }
  for (const f of (feedback ?? []) as any[]) {
    const row = perAssignment.get(f.assignment_id);
    if (!row) continue;
    row.count++;
    if (f.session_rating != null) row.session.push(f.session_rating);
    if (f.trainer_rating != null) row.trainer.push(f.trainer_rating);
    if (f.overall_rating != null) row.overall.push(f.overall_rating);
  }
  const avg = (arr: number[]) => arr.length === 0 ? null : arr.reduce((s, n) => s + n, 0) / arr.length;
  const allSession: number[] = [], allTrainer: number[] = [], allOverall: number[] = [];
  for (const f of (feedback ?? []) as any[]) {
    if (f.session_rating != null) allSession.push(f.session_rating);
    if (f.trainer_rating != null) allTrainer.push(f.trainer_rating);
    if (f.overall_rating != null) allOverall.push(f.overall_rating);
  }
  const totalResponses = feedback?.length ?? 0;
  const uniqueResponders = new Set((feedback ?? []).map((f: any) => f.student_id));
  const allComments = ((feedback ?? []) as any[]).filter((f) => f.comment);
  const fmt = (v: number | null) => v === null ? '—' : v.toFixed(1);

  return (
    <>
      <PrintHeader
        title={`${internship.title} — Feedback Summary`}
        subtitle={`${totalResponses} responses · ${uniqueResponders.size} students`}
      />

      <PageHeader
        eyebrow={`Feedback · ${internship.title}`}
        title="Student feedback"
        subtitle="Aggregated star ratings and comments from your students."
        actions={
          <>
            <PrintButton label="Print" />
            <Link href={`/mentor/performance/${params.id}`} className="btn btn-ghost">
              <ArrowLeft size={16} /> Back
            </Link>
          </>
        }
      />

      <div className="grid sm:grid-cols-4 gap-5 mb-8">
        <Stat label="Total responses" value={totalResponses} />
        <Stat label="Avg session" value={<span style={{ color: '#eab308' }}>{fmt(avg(allSession))} ★</span>} />
        <Stat label="Avg trainer" value={<span style={{ color: '#eab308' }}>{fmt(avg(allTrainer))} ★</span>} />
        <Stat label="Avg overall" value={<span style={{ color: '#eab308' }}>{fmt(avg(allOverall))} ★</span>} />
      </div>

      {totalResponses > 0 && (
        <div className="card mb-8">
          <p className="eyebrow mb-3">Average overall rating per assignment</p>
          <HorizontalBarChart
            data={assignments
              .filter((a) => (perAssignment.get(a.id)?.overall.length ?? 0) > 0)
              .map((a) => {
                const r = perAssignment.get(a.id)!;
                const v = avg(r.overall) ?? 0;
                return { label: a.title, value: v * 20, meta: `${r.count} response${r.count === 1 ? '' : 's'} · ${v.toFixed(1)}/5` };
              })}
            max={100}
            unit="%"
            thresholds={{ good: 80, warn: 60 }}
          />
        </div>
      )}

      <h2 className="font-display text-xl font-semibold mb-3">By assignment</h2>
      {assignments.length === 0 ? <EmptyState title="No assignments" /> : (
        <div className="card p-0 overflow-hidden table-wrap mb-8">
          <table className="table">
            <thead>
              <tr><th>Assignment</th><th>Responses</th><th>Session</th><th>Trainer</th><th>Overall</th></tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const r = perAssignment.get(a.id)!;
                return (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/mentor/assignments/${a.id}`} className="link font-medium">{a.title}</Link>
                      <p className="text-xs capitalize" style={{ color: 'var(--ink-500)' }}>{a.kind}</p>
                    </td>
                    <td className="font-mono text-sm">{r.count}</td>
                    <td><span className="font-mono" style={{ color: r.session.length ? '#eab308' : 'var(--ink-500)' }}>{r.session.length ? `${fmt(avg(r.session))} ★` : '—'}</span></td>
                    <td><span className="font-mono" style={{ color: r.trainer.length ? '#eab308' : 'var(--ink-500)' }}>{r.trainer.length ? `${fmt(avg(r.trainer))} ★` : '—'}</span></td>
                    <td><span className="font-mono font-semibold" style={{ color: r.overall.length ? '#eab308' : 'var(--ink-500)' }}>{r.overall.length ? `${fmt(avg(r.overall))} ★` : '—'}</span></td>
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
                <div key={c.created_at + c.student_id} className="card pl-3" style={{ borderLeft: '4px solid var(--accent)' }}>
                  <p className="text-sm leading-relaxed mb-2">{c.comment}</p>
                  <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: 'var(--ink-500)' }}>
                    <span>{c.profiles?.full_name ?? 'Anonymous'}</span>
                    <span>·</span>
                    {assignment && <Link href={`/mentor/assignments/${assignment.id}`} className="link">{assignment.title}</Link>}
                    <span>·</span>
                    <span>{formatDateTime(c.created_at)}</span>
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
