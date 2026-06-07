import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import AttendanceRowActions from '@/components/AttendanceRowActions';
import BulkMarkAllPresent from '@/components/BulkMarkAllPresent';

export const dynamic = 'force-dynamic';

export default async function AttendanceMarkingPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, scheduled_at, duration_minutes, session_type, internship_id, level_id, internships:internship_id (title), levels:level_id (level_number, title)')
    .eq('id', params.id)
    .single();
  if (!session) notFound();

  if (me.profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments').select('id')
      .eq('mentor_id', me.userId).eq('internship_id', session.internship_id).maybeSingle();
    if (!ma) notFound();
  }

  const basePath = me.profile.role === 'admin' ? 'admin' : 'mentor';
  const admin = createAdminClient();

  const sessionLevel = (session as any).levels?.level_number ?? null;

  // Fetch enrollments — filtered by level if session is level-gated.
  // A Level 2 session only shows students who have reached Level 2+ (current_level >= 2).
  let enrollmentsQuery = admin
    .from('enrollments')
    .select('student_id, current_level, status, profiles:student_id (full_name, email)')
    .eq('internship_id', session.internship_id)
    .neq('status', 'filtered');

  if (sessionLevel) {
    enrollmentsQuery = enrollmentsQuery.gte('current_level', sessionLevel);
  }

  const [enrollmentsRes, attendanceRes] = await Promise.all([
    enrollmentsQuery,
    admin.from('attendance').select('*').eq('session_id', session.id),
  ]);

  const enrollments = (enrollmentsRes.data ?? [])
    .slice()
    .sort((a: any, b: any) => {
      const an = (a.profiles?.full_name ?? a.profiles?.email ?? '').toLowerCase();
      const bn = (b.profiles?.full_name ?? b.profiles?.email ?? '').toLowerCase();
      return an.localeCompare(bn);
    });
  const attendance = attendanceRes.data ?? [];

  // Fetch marker profiles in a separate query — no FK auto-join needed
  const markerIds = Array.from(
    new Set(
      attendance
        .map((a: any) => a.marked_manually_by)
        .filter((id: string | null | undefined): id is string => !!id),
    ),
  );
  const markerProfiles = new Map<
    string,
    { full_name: string | null; email: string | null }
  >();
  if (markerIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', markerIds);
    for (const p of profiles ?? []) {
      markerProfiles.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }

  const attMap = new Map<string, any>();
  for (const a of attendance) attMap.set((a as any).student_id, a);

  const counts = { present: 0, partial: 0, absent: 0, notMarked: 0 };
  for (const e of enrollments) {
    const a = attMap.get((e as any).student_id);
    if (!a) counts.notMarked++;
    else if (a.status === 'present') counts.present++;
    else if (a.status === 'partial') counts.partial++;
    else if (a.status === 'absent') counts.absent++;
    else counts.notMarked++;
  }

  return (
    <>
      <PageHeader
        eyebrow={`Attendance · ${(session as any).internships?.title ?? ''}`}
        title={session.title}
        subtitle={`${formatDateTime(session.scheduled_at)} · ${session.duration_minutes}m · manual marking`}
        actions={
          <Link href={`/${basePath}/sessions/${session.id}`} className="btn btn-ghost">
            <ArrowLeft size={16}/> Back to session
          </Link>
        }
      />

      {/* Level filter notice */}
      {sessionLevel && (
        <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.1),rgba(99,102,241,.04))', border: '1.5px solid rgba(99,102,241,.25)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0"
            style={{ background: 'linear-gradient(135deg,var(--accent),#818cf8)' }}>
            {sessionLevel}
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
              Level {sessionLevel}{(session as any).levels?.title ? ` — ${(session as any).levels.title}` : ''} session
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              Showing only students who have reached Level {sessionLevel} or above ({enrollments.length} students).
              Students below this level are not shown.
            </p>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="eyebrow">Present</p>
          <p className="stat-num" style={{ color: 'var(--green-700)' }}>
            {counts.present}
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Partial</p>
          <p className="stat-num" style={{ color: '#eab308' }}>
            {counts.partial}
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Absent</p>
          <p className="stat-num" style={{ color: 'var(--red-500)' }}>
            {counts.absent}
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Not marked</p>
          <p className="stat-num" style={{ color: 'var(--ink-500)' }}>
            {counts.notMarked}
          </p>
        </div>
      </div>

      <BulkMarkAllPresent sessionId={session.id} />

      {enrollments.length === 0 ? (
        <EmptyState title="No students enrolled in this internship" />
      ) : (
        <div className="card p-0 overflow-hidden table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Current status</th>
                <th>How marked</th>
                <th style={{ minWidth: 320 }}>Set status</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e: any) => {
                const studentId = e.student_id;
                const a = attMap.get(studentId);
                const status = a?.status ?? null;
                const markerId: string | null = a?.marked_manually_by ?? null;
                const marker = markerId ? markerProfiles.get(markerId) : null;
                const name = e.profiles?.full_name ?? e.profiles?.email ?? '—';

                return (
                  <tr key={studentId}>
                    <td>
                      <p className="font-medium">{name}</p>
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                        L{e.current_level} · {e.profiles?.email}
                      </p>
                    </td>
                    <td>
                      {status === 'present' && <Pill tone="green">Present</Pill>}
                      {status === 'partial' && <Pill tone="amber">Partial</Pill>}
                      {status === 'absent' && <Pill tone="red">Absent</Pill>}
                      {!status && (
                        <span
                          className="text-xs"
                          style={{ color: 'var(--ink-500)' }}
                        >
                          Not marked
                        </span>
                      )}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--ink-500)' }}>
                      {!a ? (
                        '—'
                      ) : marker ? (
                        <>
                          Manually by{' '}
                          <strong style={{ color: 'var(--ink-700)' }}>
                            {marker.full_name ?? marker.email ?? 'staff'}
                          </strong>
                          {a.marked_manually_at && (
                            <>
                              <br />
                              {formatDateTime(a.marked_manually_at)}
                            </>
                          )}
                        </>
                      ) : a.code_entered_at ? (
                        <>
                          Self via code
                          <br />
                          {formatDateTime(a.code_entered_at)}
                        </>
                      ) : a.joined_at ? (
                        <>
                          Self
                          <br />
                          {formatDateTime(a.joined_at)}
                        </>
                      ) : status ? (
                        <em>Set manually (no history)</em>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <AttendanceRowActions
                        sessionId={session.id}
                        studentId={studentId}
                        currentStatus={status}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
