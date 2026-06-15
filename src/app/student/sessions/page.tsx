import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { Calendar, Video, BookOpen, Check } from 'lucide-react';

export const dynamic = 'force-dynamic';

const TYPE_ICON = { live: Calendar, recorded: Video, self_learning: BookOpen };

export default async function StudentSessionsPage() {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  // 1. Get enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('internship_id, current_level')
    .eq('student_id', me.userId);

  const internshipIds = (enrollments ?? []).map((e: any) => e.internship_id);
  // Map internship_id → student's current level
  const currentLevelByInternship = new Map<string, number>(
    (enrollments ?? []).map((e: any) => [e.internship_id, e.current_level]),
  );

  let sessions: any[] = [];
  if (internshipIds.length) {
    // 2. Get all levels for these internships → map level_id to its level_number + internship
    const { data: levels } = await supabase
      .from('levels')
      .select('id, level_number, internship_id')
      .in('internship_id', internshipIds);

    const levelInfo = new Map<string, { level_number: number; internship_id: string }>(
      (levels ?? []).map((l: any) => [l.id, { level_number: l.level_number, internship_id: l.internship_id }]),
    );

    // 3. Fetch all sessions
    const { data } = await supabase
      .from('sessions')
      .select('id, title, session_type, status, scheduled_at, duration_minutes, level_id, is_hidden, internship_id, internships:internship_id (title)')
      .in('internship_id', internshipIds)
      .order('scheduled_at', { ascending: false });

    // 4. Filter by level NUMBER (robust against mis-tagged level_ids)
    sessions = (data ?? []).filter((s: any) => {
      if (s.is_hidden === true) return false;

      // No level tag → visible to everyone
      if (!s.level_id) return true;

      const info = levelInfo.get(s.level_id);
      // level_id doesn't resolve to a known level (orphaned/legacy) → show it
      if (!info) return true;

      const myLevel = currentLevelByInternship.get(s.internship_id) ?? 1;
      // Student can see this session if they've reached its level
      return info.level_number <= myLevel;
    });
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
            const Icon = TYPE_ICON[s.session_type as keyof typeof TYPE_ICON] ?? Calendar;
            const att = attMap.get(s.id);
            return (
              <Link
                key={s.id}
                href={`/student/sessions/${s.id}`}
                className="card hover:border-amber-700/40 block"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon size={20} style={{ color: 'var(--accent)' }} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-lg">{s.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-500)' }}>
                        {s.internships?.title} · {formatDateTime(s.scheduled_at)} · {s.duration_minutes}m
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {att === 'present' && (
                      <Pill tone="green"><Check size={10} className="inline" /> attended</Pill>
                    )}
                    {att === 'partial' && <Pill tone="accent">partial</Pill>}
                    <Pill tone={s.status === 'live' ? 'accent' : 'blue'}>{s.status}</Pill>
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
