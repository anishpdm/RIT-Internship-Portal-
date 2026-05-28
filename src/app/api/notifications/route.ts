import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ notifications: [] });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ notifications: [] });

  const role = profile.role as string;
  const notifications: any[] = [];
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // last 7 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /* ── ADMIN notifications ─────────────────────────── */
  if (role === 'admin') {
    // Pending submissions
    const { count: pendingCount } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['submitted', 'under_review']);

    if ((pendingCount ?? 0) > 0) {
      notifications.push({
        id: 'pending-subs',
        icon: '📋',
        title: `${pendingCount} submission${pendingCount === 1 ? '' : 's'} pending review`,
        body: 'Students are waiting for evaluation',
        href: '/admin/submissions',
        type: 'submission',
        urgent: (pendingCount ?? 0) > 5,
        created_at: new Date().toISOString(),
      });
    }

    // Today's sessions
    const { data: todaySessions } = await supabase
      .from('sessions')
      .select('id, title, scheduled_at')
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', new Date(today.getTime() + 86400000).toISOString())
      .order('scheduled_at');

    if (todaySessions?.length) {
      notifications.push({
        id: 'today-sessions',
        icon: '📅',
        title: `${todaySessions.length} session${todaySessions.length === 1 ? '' : 's'} today`,
        body: todaySessions[0]?.title ?? '',
        href: '/admin/sessions',
        type: 'session',
        urgent: false,
        created_at: todaySessions[0]?.scheduled_at ?? new Date().toISOString(),
      });
    }

    // New assignments (last 7 days)
    const { count: newAssignments } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since);

    if ((newAssignments ?? 0) > 0) {
      notifications.push({
        id: 'new-assignments',
        icon: '📝',
        title: `${newAssignments} new assignment${newAssignments === 1 ? '' : 's'} created`,
        body: 'Track submissions from the assignments page',
        href: '/admin/assignments',
        type: 'assignment',
        urgent: false,
        created_at: new Date().toISOString(),
      });
    }

    // New enrollments (last 7 days)
    const { count: newEnrollments } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since);

    if ((newEnrollments ?? 0) > 0) {
      notifications.push({
        id: 'new-enrollments',
        icon: '👤',
        title: `${newEnrollments} new enrollment${newEnrollments === 1 ? '' : 's'}`,
        body: 'Students joined your internships this week',
        href: '/admin/students',
        type: 'enrollment',
        urgent: false,
        created_at: new Date().toISOString(),
      });
    }
  }

  /* ── MENTOR notifications ────────────────────────── */
  if (role === 'mentor') {
    // Get mentor's internship IDs
    const { data: assignments } = await supabase
      .from('mentor_assignments')
      .select('internship_id')
      .eq('mentor_id', user.id);

    const internshipIds = assignments?.map((a: any) => a.internship_id) ?? [];

    if (internshipIds.length) {
      // Pending submissions to evaluate
      const { count: pendingCount } = await supabase
        .from('submissions')
        .select('id, assignments!inner(internship_id)', { count: 'exact', head: true })
        .in('assignments.internship_id', internshipIds)
        .in('status', ['submitted', 'under_review']);

      if ((pendingCount ?? 0) > 0) {
        notifications.push({
          id: 'pending-eval',
          icon: '📋',
          title: `${pendingCount} submission${pendingCount === 1 ? '' : 's'} to evaluate`,
          body: 'Students are waiting for your feedback',
          href: '/mentor/evaluate',
          type: 'submission',
          urgent: (pendingCount ?? 0) > 3,
          created_at: new Date().toISOString(),
        });
      }

      // Today's sessions
      const { data: todaySessions } = await supabase
        .from('sessions')
        .select('id, title, scheduled_at, meeting_url')
        .in('internship_id', internshipIds)
        .gte('scheduled_at', today.toISOString())
        .lt('scheduled_at', new Date(today.getTime() + 86400000).toISOString())
        .order('scheduled_at');

      if (todaySessions?.length) {
        notifications.push({
          id: 'today-sessions',
          icon: '📅',
          title: `${todaySessions.length} session${todaySessions.length === 1 ? '' : 's'} today`,
          body: todaySessions[0]?.title ?? '',
          href: '/mentor/sessions',
          type: 'session',
          urgent: true,
          created_at: todaySessions[0]?.scheduled_at ?? new Date().toISOString(),
        });
      }

      // New assignments (last 7 days) in their internships
      const { count: newA } = await supabase
        .from('assignments')
        .select('*', { count: 'exact', head: true })
        .in('internship_id', internshipIds)
        .gte('created_at', since);

      if ((newA ?? 0) > 0) {
        notifications.push({
          id: 'new-assignments',
          icon: '📝',
          title: `${newA} new assignment${newA === 1 ? '' : 's'} posted`,
          body: 'Review your internship assignments',
          href: '/mentor/assignments',
          type: 'assignment',
          urgent: false,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  /* ── STUDENT notifications ───────────────────────── */
  if (role === 'student') {
    // Get student's internships
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('internship_id')
      .eq('student_id', user.id);

    const internshipIds = enrollments?.map((e: any) => e.internship_id) ?? [];

    if (internshipIds.length) {
      // Upcoming sessions (next 48h)
      const in48h = new Date(Date.now() + 48 * 3600000).toISOString();
      const { data: upcomingSessions } = await supabase
        .from('sessions')
        .select('id, title, scheduled_at, meeting_url')
        .in('internship_id', internshipIds)
        .gte('scheduled_at', new Date().toISOString())
        .lte('scheduled_at', in48h)
        .order('scheduled_at')
        .limit(3);

      if (upcomingSessions?.length) {
        for (const s of upcomingSessions) {
          const ms = new Date(s.scheduled_at).getTime() - Date.now();
          const hours = Math.round(ms / 3600000);
          notifications.push({
            id: `session-${s.id}`,
            icon: '📅',
            title: s.title,
            body: hours < 2 ? `Starting in ${Math.round(ms / 60000)} minutes!` : `In ${hours} hours`,
            href: `/student/sessions/${s.id}`,
            type: 'session',
            urgent: hours < 2,
            created_at: s.scheduled_at,
          });
        }
      }

      // New assignments (last 7 days) not yet submitted
      const { data: newAssignments } = await supabase
        .from('assignments')
        .select('id, title, due_at')
        .in('internship_id', internshipIds)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5);

      if (newAssignments?.length) {
        const { data: mySubs } = await supabase
          .from('submissions')
          .select('assignment_id')
          .eq('student_id', user.id);
        const submittedIds = new Set((mySubs ?? []).map((s: any) => s.assignment_id));
        const pending = newAssignments.filter((a: any) => !submittedIds.has(a.id));
        if (pending.length) {
          notifications.push({
            id: 'new-assignments',
            icon: '📝',
            title: `${pending.length} new assignment${pending.length === 1 ? '' : 's'} posted`,
            body: pending[0]?.title ?? 'Check your assignments',
            href: '/student/assignments',
            type: 'assignment',
            urgent: false,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Graded submissions (last 7 days)
      const { data: graded } = await supabase
        .from('submissions')
        .select('id, score, evaluated_at, assignments:assignment_id(title, max_score)')
        .eq('student_id', user.id)
        .eq('status', 'graded')
        .gte('evaluated_at', since)
        .order('evaluated_at', { ascending: false })
        .limit(3);

      if (graded?.length) {
        for (const g of graded) {
          const a: any = g.assignments;
          notifications.push({
            id: `grade-${g.id}`,
            icon: '🎯',
            title: `Assignment graded: ${a?.title ?? '—'}`,
            body: g.score != null ? `Score: ${g.score} / ${a?.max_score}` : 'Check your result',
            href: '/student/assignments',
            type: 'grade',
            urgent: false,
            created_at: g.evaluated_at ?? new Date().toISOString(),
          });
        }
      }
    }
  }

  // Sort by urgency then time
  notifications.sort((a, b) => {
    if (a.urgent && !b.urgent) return -1;
    if (!a.urgent && b.urgent) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return NextResponse.json({ notifications: notifications.slice(0, 8) });
}
