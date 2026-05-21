import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { Plus, Calendar, Video, BookOpen } from 'lucide-react';

export const dynamic = 'force-dynamic';

const TYPE_ICON = { live: Calendar, recorded: Video, self_learning: BookOpen };

export default async function MentorSessionsPage() {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  const { data: assignments } = await supabase
    .from('mentor_assignments')
    .select('internship_id')
    .eq('mentor_id', me.userId);
  const internshipIds = assignments?.map((a: any) => a.internship_id) ?? [];

  let sessions: any[] = [];
  if (internshipIds.length) {
    const { data } = await supabase
      .from('sessions')
      .select(
        'id, title, session_type, status, scheduled_at, duration_minutes, meeting_url, internships:internship_id (title)',
      )
      .in('internship_id', internshipIds)
      .order('scheduled_at', { ascending: false });
    sessions = data ?? [];
  }

  return (
    <>
      <PageHeader
        eyebrow="Mentor"
        title="Sessions"
        subtitle="Sessions across the internships you mentor."
        actions={
          <Link href="/mentor/sessions/new" className="btn btn-primary">
            <Plus size={16} /> New session
          </Link>
        }
      />

      {sessions.length > 0 ? (
        <div className="card p-0 overflow-hidden table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Internship</th>
                <th>Type</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Join</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const Icon = TYPE_ICON[s.session_type as keyof typeof TYPE_ICON];
                const startsAt = new Date(s.scheduled_at).getTime();
                const now = Date.now();
                const endsAt = startsAt + (s.duration_minutes ?? 60) * 60000;
                const isLive = now >= startsAt && now <= endsAt;
                const isPast = now > endsAt;
                return (
                  <tr key={s.id}>
                    <td>
                      <p className="font-display text-base font-medium">{s.title}</p>
                    </td>
                    <td className="text-sm" style={{ color: 'var(--ink-500)' }}>
                      {s.internships?.title}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <Icon size={12} /> {s.session_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-sm">{formatDateTime(s.scheduled_at)}</td>
                    <td>
                      <Pill tone={isLive ? 'green' : isPast ? undefined : 'blue'}>
                        {isLive ? '● live' : isPast ? 'past' : s.status}
                      </Pill>
                    </td>
                    <td>
                      {s.meeting_url ? (
                        <a
                          href={s.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={isLive ? 'btn btn-primary' : 'btn btn-secondary'}
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                        >
                          <Video size={11} /> {isLive ? 'Join' : 'Link'}
                        </a>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--ink-500)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/mentor/sessions/${s.id}`}
                        className="text-sm link"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No sessions yet" hint="Create one to get started." />
      )}
    </>
  );
}
