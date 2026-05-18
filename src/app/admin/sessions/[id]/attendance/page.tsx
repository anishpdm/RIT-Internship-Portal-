import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
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
    .select(
      'id, title, scheduled_at, duration_minutes, session_type, internship_id, internships:internship_id (title)',
    )
    .eq('id', params.id)
    .single();
  if (!session) notFound();

  if (me.profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments')
      .select('id')
      .eq('mentor_id', me.userId)
      .eq('internship_id', session.internship_id)
      .maybeSingle();
    if (!ma) notFound();
  }

  const basePath = me.profile.role === 'admin' ? 'admin' : 'mentor';

  const [enrollmentsRes, attendanceRes] = await Promise.all([
    supabase
      .from('enrollments')
      .select('student_id, current_level, profiles:student_id (full_name, email)')
      .eq('internship_id', session.internship_id),
    supabase
      .from('attendance')
      .select(
        'student_id, status, code_entered_at, joined_at, marked_manually_by, marked_manually_at, markers:marked_manually_by (full_name, email)',
      )
      .eq('session_id', session.id),
  ]);

  // Sort alphabetically by name (fall back to email)
  const enrollments = (enrollmentsRes.data ?? []).slice().sort((a: any, b: any) => {
    const an = (a.profiles?.full_name ?? a.profiles?.email ?? '').toLowerCase();
    const bn = (b.profiles?.full_name ?? b.profiles?.email ?? '').toLowerCase();
    return an.localeCompare(bn);
  });
  const attendance = attendanceRes.data ?? [];

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
          <Link
            href={`/${basePath}/sessions/${session.id}`}
            className="btn btn-ghost"
          >
            <ArrowLeft size={16} /> Back to session
          </Link>
        }
      />

      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="eyebrow">Present</p>
          <p className="stat-num" style={{ color: 'var(--green-700)' }}>{counts.present}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Partial</p>
          <p className="stat-num" style={{ color: '#eab308' }}>{counts.partial}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Absent</p>
          <p className="stat-num" style={{ color: 'var(--red-500)' }}>{counts.absent}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Not marked</p>
          <p className="stat-num" style={{ color: 'var(--ink-500)' }}>{counts.notMarked}</p>
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
                const manualBy = a?.markers;
                const isManual = !!a?.marked_manually_by;
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
                        <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
                          Not marked
                        </span>
                      )}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--ink-500)' }}>
                      {!a ? (
                        '—'
                      ) : isManual ? (
                        <>
                          Manually by{' '}
                          <strong style={{ color: 'var(--ink-700)' }}>
                            {manualBy?.full_name ?? manualBy?.email ?? 'staff'}
                          </strong>
                          <br />
                          {a.marked_manually_at && formatDateTime(a.marked_manually_at)}
                        </>
                      ) : a.code_entered_at ? (
                        <>Self via code<br />{formatDateTime(a.code_entered_at)}</>
                      ) : a.joined_at ? (
                        <>Self<br />{formatDateTime(a.joined_at)}</>
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
