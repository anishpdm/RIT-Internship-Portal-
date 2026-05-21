import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Stat, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowRight, Video } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MentorHomePage() {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  // Internships this mentor is assigned to
  const { data: assignments } = await supabase
    .from('mentor_assignments')
    .select('internship_id, internships:internship_id (id, title, status, total_levels)')
    .eq('mentor_id', me.userId);

  const internshipIds =
    assignments?.map((a: any) => a.internship_id).filter(Boolean) ?? [];

  // Pending submissions in those internships
  let pendingCount = 0;
  if (internshipIds.length) {
    const { count } = await supabase
      .from('submissions')
      .select('id, assignments!inner(internship_id)', { count: 'exact', head: true })
      .in('assignments.internship_id', internshipIds)
      .in('status', ['submitted', 'under_review']);
    pendingCount = count ?? 0;
  }

  // Upcoming sessions
  let upcoming: any[] = [];
  if (internshipIds.length) {
    const { data } = await supabase
      .from('sessions')
      .select(
        'id, title, scheduled_at, duration_minutes, session_type, status, meeting_url, internships:internship_id (title)',
      )
      .in('internship_id', internshipIds)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(5);
    upcoming = data ?? [];
  }

  // Students under mentor
  let studentCount = 0;
  if (internshipIds.length) {
    const { count } = await supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .in('internship_id', internshipIds)
      .eq('status', 'active');
    studentCount = count ?? 0;
  }

  return (
    <>
      <PageHeader
        eyebrow={`Welcome, ${me.profile.full_name?.split(' ')[0] ?? 'Mentor'}`}
        title="Mentor desk"
        subtitle="Your internships, your students, work that needs your attention."
      />

      <div className="grid sm:grid-cols-3 gap-6 mb-10">
        <Stat label="Internships" value={assignments?.length ?? 0} />
        <Stat label="Active students" value={studentCount} />
        <Stat label="Pending evaluations" value={pendingCount} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl">Your internships</h2>
          </div>
          {assignments && assignments.length > 0 ? (
            <div className="space-y-3">
              {assignments.map((a: any) => (
                <Link
                  key={a.internship_id}
                  href={`/mentor/students?internship=${a.internship_id}`}
                  className="card flex items-center justify-between hover:border-amber-700/40"
                >
                  <div>
                    <p className="font-display text-lg">{a.internships?.title}</p>
                    <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                      {a.internships?.total_levels} levels
                    </p>
                  </div>
                  <Pill tone={a.internships?.status === 'active' ? 'green' : 'blue'}>
                    {a.internships?.status}
                  </Pill>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No internships assigned"
              hint="Once an admin assigns you to an internship, it'll appear here."
            />
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl">Upcoming sessions</h2>
            <Link
              href="/mentor/sessions"
              className="text-sm"
              style={{ color: 'var(--accent)' }}
            >
              All sessions <ArrowRight size={14} className="inline" />
            </Link>
          </div>
          {upcoming.length > 0 ? (
            <div className="space-y-3">
              {upcoming.map((s) => {
                const startsAt = new Date(s.scheduled_at).getTime();
                const now = Date.now();
                const minsUntil = Math.round((startsAt - now) / 60000);
                const endsAt = startsAt + (s.duration_minutes ?? 60) * 60000;
                const isLive = now >= startsAt && now <= endsAt;
                const isStartingSoon = minsUntil > 0 && minsUntil <= 30;
                let label = formatDateTime(s.scheduled_at);
                if (isLive) label = '● Live now';
                else if (minsUntil < 60 && minsUntil > 0)
                  label = `Starts in ${minsUntil} min`;
                else if (minsUntil < 1440 && minsUntil >= 60)
                  label = `Starts in ${Math.round(minsUntil / 60)}h`;

                return (
                  <div
                    key={s.id}
                    className="card"
                    style={{
                      borderColor: isLive
                        ? 'var(--green-500)'
                        : isStartingSoon
                          ? 'var(--accent)'
                          : 'var(--ink-200)',
                      background: isLive
                        ? 'var(--green-soft)'
                        : isStartingSoon
                          ? 'var(--accent-soft)'
                          : 'var(--paper)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <Link
                        href={`/mentor/sessions/${s.id}`}
                        className="font-display text-base font-semibold hover:underline"
                        style={{ color: 'var(--ink-900)' }}
                      >
                        {s.title}
                      </Link>
                      <Pill
                        tone={
                          isLive ? 'green' : isStartingSoon ? 'accent' : undefined
                        }
                      >
                        {s.session_type.replace('_', ' ')}
                      </Pill>
                    </div>
                    <p
                      className="text-xs mb-3"
                      style={{
                        color: isLive
                          ? 'var(--green-700)'
                          : isStartingSoon
                            ? 'var(--accent)'
                            : 'var(--ink-500)',
                        fontWeight: isLive || isStartingSoon ? 600 : 400,
                      }}
                    >
                      {(s.internships as any)?.title} · {label}
                      {!isLive && minsUntil >= 60 && (
                        <>
                          {' · '}
                          {formatDateTime(s.scheduled_at)}
                        </>
                      )}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {s.meeting_url ? (
                        <a
                          href={s.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={isLive ? 'btn btn-primary' : 'btn btn-secondary'}
                          style={{ fontSize: '0.85rem' }}
                        >
                          <Video size={14} /> {isLive ? 'Join now' : 'Open link'}
                        </a>
                      ) : (
                        <span
                          className="text-xs italic"
                          style={{ color: 'var(--ink-500)' }}
                        >
                          No join link set
                        </span>
                      )}
                      <Link
                        href={`/mentor/sessions/${s.id}`}
                        className="btn btn-ghost"
                        style={{ fontSize: '0.85rem' }}
                      >
                        Session details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Nothing scheduled" />
          )}
        </div>
      </div>
    </>
  );
}
