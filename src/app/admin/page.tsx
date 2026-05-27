import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Stat, Pill } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { GraduationCap, Users, ShieldCheck, ClipboardCheck } from 'lucide-react';

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
    supabase.from('internships').select('*', { count: 'exact', head: true }).neq('status', 'archived'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'mentor'),
    supabase.from('submissions').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'under_review']),
    supabase.from('internships').select('id, title, status, start_date, end_date, total_levels').order('created_at', { ascending: false }).limit(5),
    supabase.from('audit_logs').select('id, actor_role, action, entity_type, created_at').order('created_at', { ascending: false }).limit(8),
  ]);

  return (
    <>
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 mb-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0a0f1e 0%, #1e1b4b 50%, #0e1628 100%)',
          boxShadow: '0 8px 32px rgba(99,102,241,0.20)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 60% 80% at 90% 50%, rgba(99,102,241,0.18) 0%, transparent 70%)',
        }} />
        <p className="eyebrow mb-1" style={{ color: '#818cf8' }}>Admin workspace</p>
        <h1 className="font-display font-bold text-2xl" style={{ color: 'white', letterSpacing: '-0.025em' }}>
          RIT Internship Portal
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Manage cohorts, mentors and review submissions
        </p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Stat label="Active internships" value={internshipsCount ?? 0} icon={GraduationCap} accent="#6366f1" />
        <Stat label="Students" value={studentsCount ?? 0} icon={Users} accent="#10b981" />
        <Stat label="Mentors" value={mentorsCount ?? 0} icon={ShieldCheck} accent="#06b6d4" />
        <Stat label="Pending review" value={pendingSubsCount ?? 0} icon={ClipboardCheck} accent="#f59e0b" />
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h2 className="font-display text-xl font-semibold">Recent internships</h2>
            <Link href="/admin/internships" className="text-sm link">All →</Link>
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
