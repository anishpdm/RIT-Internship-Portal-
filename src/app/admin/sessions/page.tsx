import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { Plus, Calendar, Video, BookOpen } from 'lucide-react';

export const dynamic = 'force-dynamic';

const TYPE_ICON = {
  live: Calendar,
  recorded: Video,
  self_learning: BookOpen,
};

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: { internship?: string };
}) {
  const supabase = createClient();
  let query = supabase
    .from('sessions')
    .select(
      'id, title, session_type, status, scheduled_at, duration_minutes, internship_id, internships:internship_id (title)'
    )
    .order('scheduled_at', { ascending: false });
  if (searchParams.internship) {
    query = query.eq('internship_id', searchParams.internship);
  }
  const { data: sessions } = await query;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Sessions"
        subtitle="Live sessions, recorded videos, and self-learning modules across all internships."
        actions={
          <Link href="/admin/sessions/new" className="btn btn-primary">
            <Plus size={16} /> New session
          </Link>
        }
      />

      {sessions && sessions.length > 0 ? (
        <div className="card p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Internship</th>
                <th>Type</th>
                <th>Scheduled</th>
                <th>Duration</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s: any) => {
                const Icon = TYPE_ICON[s.session_type as keyof typeof TYPE_ICON];
                return (
                  <tr key={s.id}>
                    <td>
                      <p className="font-display text-base font-medium">{s.title}</p>
                    </td>
                    <td className="text-sm" style={{ color: 'var(--ink-500)' }}>
                      {s.internships?.title}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon size={12} />
                        <span className="text-xs">{s.session_type.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="text-sm">{formatDateTime(s.scheduled_at)}</td>
                    <td className="font-mono text-xs">{s.duration_minutes}m</td>
                    <td>
                      <Pill
                        tone={
                          s.status === 'live'
                            ? 'accent'
                            : s.status === 'ended'
                              ? undefined
                              : s.status === 'cancelled'
                                ? 'red'
                                : 'blue'
                        }
                      >
                        {s.status}
                      </Pill>
                    </td>
                    <td>
                      <Link
                        href={`/admin/sessions/${s.id}`}
                        className="text-sm"
                        style={{ color: 'var(--accent)' }}
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
        <EmptyState
          title="No sessions scheduled"
          hint="Create a session — live, recorded, or self-learning — and add materials."
        />
      )}
    </>
  );
}
