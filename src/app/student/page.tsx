import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Stat, Pill, EmptyState } from '@/components/ui';
import { formatDateTime, relativeTime } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function StudentHomePage() {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(
      'id, current_level, status, total_score, internship_id, internships:internship_id (id, title, status, total_levels)',
    )
    .eq('student_id', me.userId);

  const internshipIds =
    enrollments?.map((e: any) => e.internship_id) ?? [];

  // Upcoming sessions
  let upcoming: any[] = [];
  if (internshipIds.length) {
    const { data } = await supabase
      .from('sessions')
      .select(
        'id, title, session_type, scheduled_at, status, internships:internship_id (title)',
      )
      .in('internship_id', internshipIds)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(5);
    upcoming = data ?? [];
  }

  // Pending assignments (no submission yet)
  let pending: any[] = [];
  if (internshipIds.length) {
    const { data: allA } = await supabase
      .from('assignments')
      .select(
        'id, title, kind, due_at, max_score, internships:internship_id (title)',
      )
      .in('internship_id', internshipIds)
      .order('due_at', { ascending: true, nullsFirst: false });

    const { data: mySubs } = await supabase
      .from('submissions')
      .select('assignment_id')
      .eq('student_id', me.userId);

    const submittedIds = new Set((mySubs ?? []).map((s: any) => s.assignment_id));
    pending = (allA ?? []).filter((a: any) => !submittedIds.has(a.id)).slice(0, 5);
  }

  const avgScore =
    enrollments && enrollments.length
      ? (
          enrollments.reduce((s: number, e: any) => s + Number(e.total_score ?? 0), 0) /
          enrollments.length
        ).toFixed(1)
      : '0.0';

  return (
    <>
      <PageHeader
        eyebrow={`Welcome, ${me.profile.full_name?.split(' ')[0] ?? 'Student'}`}
        title="Your dashboard"
        subtitle="Where you are, what's next, and what's due."
      />

      <div className="grid sm:grid-cols-3 gap-6 mb-10">
        <Stat label="Internships" value={enrollments?.length ?? 0} />
        <Stat label="Avg score" value={`${avgScore}%`} />
        <Stat label="Pending" value={pending.length} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="font-display text-2xl mb-4">Your internships</h2>
          {enrollments && enrollments.length > 0 ? (
            <div className="space-y-3">
              {enrollments.map((e: any) => (
                <div key={e.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-lg">{e.internships?.title}</p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: 'var(--ink-500)' }}
                      >
                        Level {e.current_level} of {e.internships?.total_levels} ·{' '}
                        score {Number(e.total_score).toFixed(1)}%
                      </p>
                    </div>
                    <Pill
                      tone={
                        e.status === 'active'
                          ? 'blue'
                          : e.status === 'promoted'
                            ? 'green'
                            : e.status === 'filtered'
                              ? 'red'
                              : 'accent'
                      }
                    >
                      {e.status}
                    </Pill>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-4 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, (e.current_level / (e.internships?.total_levels || 1)) * 100)}%`,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Not enrolled yet"
              hint="An admin will enrol you in an internship. You'll see it here."
            />
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl">Upcoming sessions</h2>
            <Link
              href="/student/sessions"
              className="text-sm"
              style={{ color: 'var(--accent)' }}
            >
              All <ArrowRight size={14} className="inline" />
            </Link>
          </div>
          {upcoming.length > 0 ? (
            <div className="space-y-3">
              {upcoming.map((s) => (
                <Link
                  key={s.id}
                  href={`/student/sessions/${s.id}`}
                  className="card hover:border-amber-700/40 block"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-display text-base">{s.title}</p>
                    <Pill>{s.session_type.replace('_', ' ')}</Pill>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
                    {(s.internships as any)?.title} · {formatDateTime(s.scheduled_at)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing scheduled" />
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">Pending assignments</h2>
          <Link
            href="/student/assignments"
            className="text-sm"
            style={{ color: 'var(--accent)' }}
          >
            All <ArrowRight size={14} className="inline" />
          </Link>
        </div>
        {pending.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {pending.map((a: any) => (
              <Link
                key={a.id}
                href={`/student/assignments/${a.id}`}
                className="card hover:border-amber-700/40 block"
              >
                <div className="flex items-center justify-between">
                  <p className="font-display text-base">{a.title}</p>
                  <Pill tone={a.kind === 'assessment' ? 'accent' : 'blue'}>
                    {a.kind}
                  </Pill>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
                  {a.internships?.title} ·{' '}
                  {a.due_at ? `due ${relativeTime(a.due_at)}` : 'no due date'}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing pending — well done." />
        )}
      </div>
    </>
  );
}
