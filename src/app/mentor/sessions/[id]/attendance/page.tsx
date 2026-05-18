import { notFound } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, UserCheck, Clock, UserX, CircleSlash } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function markAttendance(formData: FormData) {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const session_id = String(formData.get('session_id') ?? '');
  const student_id = String(formData.get('student_id') ?? '');
  const status = String(formData.get('status') ?? '');
  const internship_id = String(formData.get('internship_id') ?? '');
  const back_path = String(formData.get('back_path') ?? '');

  if (!session_id || !student_id) return;

  if (!['present', 'partial', 'absent', '__clear__'].includes(status)) return;

  if (status === '__clear__') {
    // Delete the row to clear manual marking
    await supabase
      .from('attendance')
      .delete()
      .eq('session_id', session_id)
      .eq('student_id', student_id);
  } else {
    // Upsert
    await supabase.from('attendance').upsert(
      {
        session_id,
        student_id,
        status,
        marked_manually_by: me.userId,
        marked_manually_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,student_id' },
    );
  }

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: status === '__clear__' ? 'attendance.clear_manual' : 'attendance.mark_manual',
    entity_type: 'attendance',
    entity_id: `${session_id}:${student_id}`,
    details: { status, session_id, student_id, internship_id },
  });

  revalidatePath(back_path);
}

async function bulkMarkAllPresent(formData: FormData) {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const session_id = String(formData.get('session_id') ?? '');
  const internship_id = String(formData.get('internship_id') ?? '');
  const back_path = String(formData.get('back_path') ?? '');
  if (!session_id || !internship_id) return;

  // Find every enrolled student who isn't yet marked present
  const { data: enrolled } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('internship_id', internship_id);

  const studentIds = (enrolled ?? []).map((e: any) => e.student_id);
  if (studentIds.length === 0) return;

  const rows = studentIds.map((sid) => ({
    session_id,
    student_id: sid,
    status: 'present',
    marked_manually_by: me.userId,
    marked_manually_at: new Date().toISOString(),
  }));

  await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'session_id,student_id' });

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'attendance.bulk_mark_present',
    entity_type: 'session',
    entity_id: session_id,
    details: { count: studentIds.length, internship_id },
  });

  revalidatePath(back_path);
}

export default async function MentorAttendancePage({
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

  // Mentor scope check
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
  const backPath = `/${basePath}/sessions/${session.id}/attendance`;

  // All enrolled students for this internship + existing attendance
  const [enrollmentsRes, attendanceRes] = await Promise.all([
    supabase
      .from('enrollments')
      .select(
        'student_id, current_level, profiles:student_id (full_name, email)',
      )
      .eq('internship_id', session.internship_id)
      .order('current_level'),
    supabase
      .from('attendance')
      .select(
        'student_id, status, code_entered_at, joined_at, marked_manually_by, marked_manually_at, markers:marked_manually_by (full_name, email)',
      )
      .eq('session_id', session.id),
  ]);

  const enrollments = enrollmentsRes.data ?? [];
  const attendance = attendanceRes.data ?? [];

  // Build a lookup map
  const attMap = new Map<string, any>();
  for (const a of attendance) {
    attMap.set((a as any).student_id, a);
  }

  // Stats
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
        subtitle={`${formatDateTime(session.scheduled_at)} · ${session.duration_minutes}m · manual marking by ${me.profile.role}`}
        actions={
          <Link
            href={`/${basePath}/sessions/${session.id}`}
            className="btn btn-ghost"
          >
            <ArrowLeft size={16} /> Back to session
          </Link>
        }
      />

      {/* Stats summary */}
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

      {/* Bulk action */}
      <form action={bulkMarkAllPresent} className="mb-4">
        <input type="hidden" name="session_id" value={session.id} />
        <input type="hidden" name="internship_id" value={session.internship_id} />
        <input type="hidden" name="back_path" value={backPath} />
        <button
          type="submit"
          className="btn btn-secondary text-sm"
          formAction={bulkMarkAllPresent}
        >
          <UserCheck size={14} /> Mark all enrolled students Present
        </button>
        <span className="text-xs ml-3" style={{ color: 'var(--ink-500)' }}>
          Use after a live session when most attended — then change individual exceptions below.
        </span>
      </form>

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
                <th style={{ minWidth: 360 }}>Set status</th>
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
                      <p
                        className="text-xs"
                        style={{ color: 'var(--ink-500)' }}
                      >
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
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(['present', 'partial', 'absent'] as const).map((s) => (
                          <form key={s} action={markAttendance}>
                            <input
                              type="hidden"
                              name="session_id"
                              value={session.id}
                            />
                            <input
                              type="hidden"
                              name="student_id"
                              value={studentId}
                            />
                            <input
                              type="hidden"
                              name="internship_id"
                              value={session.internship_id}
                            />
                            <input
                              type="hidden"
                              name="back_path"
                              value={backPath}
                            />
                            <input type="hidden" name="status" value={s} />
                            <button
                              type="submit"
                              className="btn text-xs"
                              style={{
                                padding: '0.35rem 0.7rem',
                                background:
                                  status === s
                                    ? s === 'present'
                                      ? 'var(--green-500)'
                                      : s === 'partial'
                                        ? '#eab308'
                                        : 'var(--red-500)'
                                    : 'var(--ink-100)',
                                color:
                                  status === s ? 'white' : 'var(--ink-700)',
                                border: 'none',
                                textTransform: 'capitalize',
                              }}
                              title={`Mark as ${s}`}
                            >
                              {s === 'present' && <UserCheck size={11} />}
                              {s === 'partial' && <Clock size={11} />}
                              {s === 'absent' && <UserX size={11} />}{' '}
                              {s}
                            </button>
                          </form>
                        ))}
                        {a && (
                          <form action={markAttendance}>
                            <input
                              type="hidden"
                              name="session_id"
                              value={session.id}
                            />
                            <input
                              type="hidden"
                              name="student_id"
                              value={studentId}
                            />
                            <input
                              type="hidden"
                              name="internship_id"
                              value={session.internship_id}
                            />
                            <input
                              type="hidden"
                              name="back_path"
                              value={backPath}
                            />
                            <input
                              type="hidden"
                              name="status"
                              value="__clear__"
                            />
                            <button
                              type="submit"
                              className="btn btn-ghost text-xs"
                              style={{ padding: '0.35rem 0.7rem' }}
                              title="Clear (remove any marking)"
                            >
                              <CircleSlash size={11} /> Clear
                            </button>
                          </form>
                        )}
                      </div>
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
