import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function EvaluateQueuePage() {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  // Internships this mentor handles
  const { data: assignments } = await supabase
    .from('mentor_assignments')
    .select('internship_id')
    .eq('mentor_id', me.userId);
  const internshipIds = assignments?.map((a: any) => a.internship_id) ?? [];

  let pending: any[] = [];
  if (internshipIds.length || me.profile.role === 'admin') {
    let q = supabase
      .from('submissions')
      .select(
        '*, profiles:student_id (full_name, email), assignments:assignment_id (title, max_score, internship_id, kind, internships:internship_id (title))',
      )
      .in('status', ['submitted', 'under_review'])
      .order('submitted_at', { ascending: true })
      .limit(100);
    const { data } = await q;
    pending = data ?? [];
    if (me.profile.role !== 'admin') {
      pending = pending.filter((s: any) =>
        internshipIds.includes(s.assignments?.internship_id),
      );
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Mentor"
        title="Evaluation queue"
        subtitle="Submissions waiting for your review — oldest first."
      />

      {pending.length > 0 ? (
        <div className="space-y-3">
          {pending.map((s: any) => (
            <Link
              key={s.id}
              href={`/mentor/evaluate/${s.id}`}
              className="card hover:border-amber-700/40 block"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-lg">
                      {s.assignments?.title ?? '—'}
                    </p>
                    <Pill tone={s.assignments?.kind === 'assessment' ? 'accent' : 'blue'}>
                      {s.assignments?.kind}
                    </Pill>
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--ink-500)' }}>
                    {s.profiles?.full_name ?? s.profiles?.email} ·{' '}
                    {s.assignments?.internships?.title}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                    submitted {relativeTime(s.submitted_at)}
                  </p>
                  <p className="text-xs font-mono">{formatDateTime(s.submitted_at)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing to evaluate"
          hint="When students submit, they'll appear here."
        />
      )}
    </>
  );
}
