import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Stat, Pill } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

export default async function AdminOverview() {
  const supabase = createClient();

  const [
    { count: internshipsCount },
    { count: studentsCount },
    { count: mentorsCount },
    { count: pendingSubsCount },
    { data: recentInternships },
    { data: recentLogs },
  ] = await Promise.all([
    supabase
      .from('internships')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived'),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student'),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'mentor'),
    supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['submitted', 'under_review']),
    supabase
      .from('internships')
      .select('id, title, status, start_date, end_date, total_levels')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('audit_logs')
      .select('id, actor_role, action, entity_type, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Overview"
        subtitle="At-a-glance picture of every cohort, mentor, and pending review."
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Active internships" value={internshipsCount ?? 0} />
        <Stat label="Students" value={studentsCount ?? 0} />
        <Stat label="Mentors" value={mentorsCount ?? 0} />
        <Stat label="Pending review" value={pendingSubsCount ?? 0} />
      </section>

      <section className="grid lg:grid-cols-2 gap-6 mt-10">
        <div className="card">
          <div className="card-header">
            <h2 className="font-display text-xl font-semibold">
              Recent internships
            </h2>
            <Link href="/admin/internships" className="text-sm" style={{ color: 'var(--accent)' }}>
              All →
            </Link>
          </div>
          {recentInternships?.length ? (
            <ul className="space-y-3">
              {recentInternships.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      href={`/admin/internships/${i.id}`}
                      className="font-display text-lg font-medium hover:underline"
                    >
                      {i.title}
                    </Link>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--ink-500)' }}>
                      {i.total_levels} levels · {i.start_date ?? '—'} → {i.end_date ?? '—'}
                    </p>
                  </div>
                  <Pill tone={i.status === 'active' ? 'green' : undefined}>
                    {i.status}
                  </Pill>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
              No internships yet. <Link href="/admin/internships" className="underline">Create one</Link>.
            </p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="font-display text-xl font-semibold">Activity</h2>
            <Link href="/admin/logs" className="text-sm" style={{ color: 'var(--accent)' }}>
              All →
            </Link>
          </div>
          {recentLogs?.length ? (
            <ul className="space-y-3 text-sm">
              {recentLogs.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs" style={{ color: 'var(--ink-500)' }}>
                      {l.actor_role ?? 'system'}
                    </span>
                    <span className="ml-2">{l.action}</span>
                    <span className="ml-1" style={{ color: 'var(--ink-500)' }}>
                      on {l.entity_type}
                    </span>
                  </div>
                  <time className="text-xs shrink-0" style={{ color: 'var(--ink-500)' }}>
                    {formatDateTime(l.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
              No activity yet.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
