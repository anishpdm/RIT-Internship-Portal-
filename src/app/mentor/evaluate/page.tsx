import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function EvaluateQueuePage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();
  const tab = searchParams.tab ?? 'pending';

  // Internships this mentor handles
  const { data: assignments } = await supabase
    .from('mentor_assignments')
    .select('internship_id')
    .eq('mentor_id', me.userId);
  const internshipIds = assignments?.map((a: any) => a.internship_id) ?? [];

  // Pick statuses based on tab
  const statusFilter =
    tab === 'graded'
      ? ['graded']
      : tab === 'returned'
        ? ['returned']
        : ['submitted', 'under_review'];

  let rows: any[] = [];
  if (internshipIds.length || me.profile.role === 'admin') {
    let q = supabase
      .from('submissions')
      .select(
        '*, profiles:student_id (full_name, email), assignments:assignment_id (title, max_score, internship_id, kind, internships:internship_id (title))',
      )
      .in('status', statusFilter)
      .order(tab === 'pending' ? 'submitted_at' : 'evaluated_at', {
        ascending: tab === 'pending',
        nullsFirst: false,
      })
      .limit(200);
    const { data } = await q;
    rows = data ?? [];
    if (me.profile.role !== 'admin') {
      rows = rows.filter((s: any) =>
        internshipIds.includes(s.assignments?.internship_id),
      );
    }
  }

  const tabs = [
    { v: 'pending', label: 'Pending' },
    { v: 'graded', label: 'Graded' },
    { v: 'returned', label: 'Returned' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Mentor"
        title="Evaluation"
        subtitle="Submissions to review and grades you have already given."
      />

      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <Link
            key={t.v}
            href={`/mentor/evaluate${t.v === 'pending' ? '' : `?tab=${t.v}`}`}
            className={`pill ${tab === t.v ? 'pill-accent' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((s: any) => (
            <Link
              key={s.id}
              href={`/mentor/evaluate/${s.id}`}
              className="card card-hover block"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-semibold">
                      {s.assignments?.title ?? '—'}
                    </p>
                    <Pill tone={s.assignments?.kind === 'assessment' ? 'accent' : 'blue'}>
                      {s.assignments?.kind}
                    </Pill>
                    {s.status === 'graded' && (
                      <Pill tone="green">
                        {s.score} / {s.assignments?.max_score}
                      </Pill>
                    )}
                    {s.status === 'returned' && <Pill tone="red">returned</Pill>}
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--ink-500)' }}>
                    {s.profiles?.full_name ?? s.profiles?.email} ·{' '}
                    {s.assignments?.internships?.title}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                    {tab === 'pending' ? 'submitted' : 'graded'}{' '}
                    {relativeTime(
                      tab === 'pending' ? s.submitted_at : s.evaluated_at ?? s.submitted_at,
                    )}
                  </p>
                  <p className="text-xs font-mono">
                    {formatDateTime(
                      tab === 'pending' ? s.submitted_at : s.evaluated_at ?? s.submitted_at,
                    )}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            tab === 'pending'
              ? 'Nothing to evaluate'
              : tab === 'graded'
                ? 'No graded submissions yet'
                : 'No returned submissions'
          }
        />
      )}
    </>
  );
}
