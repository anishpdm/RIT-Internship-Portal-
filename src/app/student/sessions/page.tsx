import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { Calendar, Video, BookOpen, Check, Lock } from 'lucide-react';
import { getAccessibleLevelIds, levelOrFilter } from '@/lib/level-access';

export const dynamic = 'force-dynamic';

const TYPE_ICON = { live: Calendar, recorded: Video, self_learning: BookOpen };

export default async function StudentSessionsPage() {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  const access = await getAccessibleLevelIds(me.userId);
  const internshipIds = access?.enrollments.map((e) => e.internship_id) ?? [];

  let sessions: any[] = [];
  if (internshipIds.length && access) {
    const accessibleLevelIds = access.levelIds ?? [];
    const { data } = await supabase
      .from('sessions')
      .select('id, title, session_type, status, scheduled_at, duration_minutes, level_id, is_hidden, internships:internship_id (title)')
      .in('internship_id', internshipIds)
      .order('scheduled_at', { ascending: false });

    // Filter in JS — more reliable than chaining two .or() filters:
    //  • not hidden (NULL or false both count as visible)
    //  • no level tag (global) OR level the student has reached
    sessions = (data ?? []).filter((s: any) =>
      s.is_hidden !== true &&
      (!s.level_id || accessibleLevelIds.includes(s.level_id))
    );
  }

  const { data: myAttendance } = await supabase
    .from('attendance')
    .select('session_id, status')
    .eq('student_id', me.userId);
  const attMap = new Map<string, string>(
    (myAttendance ?? []).map((a: any) => [a.session_id, a.status]),
  );

  return (
    <>
      <PageHeader
        eyebrow="Student"
        title="Sessions"
        subtitle="All your sessions — live, recorded, and self-learning."
      />

      {sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.map((s) => {
            const Icon = TYPE_ICON[s.session_type as keyof typeof TYPE_ICON];
            const att = attMap.get(s.id);
            return (
              <Link
                key={s.id}
                href={`/student/sessions/${s.id}`}
                className="card hover:border-amber-700/40 block"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon
                      size={20}
                      style={{ color: 'var(--accent)' }}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-lg">{s.title}</p>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: 'var(--ink-500)' }}
                      >
                        {s.internships?.title} · {formatDateTime(s.scheduled_at)}{' '}
                        · {s.duration_minutes}m
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {att === 'present' && (
                      <Pill tone="green">
                        <Check size={10} className="inline" /> attended
                      </Pill>
                    )}
                    {att === 'partial' && <Pill tone="accent">partial</Pill>}
                    <Pill tone={s.status === 'live' ? 'accent' : 'blue'}>
                      {s.status}
                    </Pill>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No sessions yet" />
      )}
    </>
  );
}
