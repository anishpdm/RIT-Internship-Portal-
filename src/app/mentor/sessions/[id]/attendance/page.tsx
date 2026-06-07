import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import AttendanceRowActions from '@/components/AttendanceRowActions';
import BulkMarkAllPresent from '@/components/BulkMarkAllPresent';

export const dynamic = 'force-dynamic';

async function resetAttendance(formData: FormData) {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const sessionId = String(formData.get('session_id') ?? '');
  const returnUrl = String(formData.get('return_url') ?? '');
  if (!sessionId) return;

  const admin = createAdminClient();

  // Only delete attendance records for students currently in the filtered list
  const studentIds = formData.getAll('student_id') as string[];
  if (studentIds.length > 0) {
    await admin.from('attendance')
      .delete()
      .eq('session_id', sessionId)
      .in('student_id', studentIds);
  }

  await logAudit({
    actor_id: me.userId, actor_role: me.profile.role,
    action: 'attendance.reset', entity_type: 'session', entity_id: sessionId,
    details: { cleared: studentIds.length },
  });

  revalidatePath(returnUrl);
  redirect(returnUrl);
}

export default async function AttendanceMarkingPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();
  const admin = createAdminClient();

  // 1. Fetch session — simple columns only, no join (avoids FK ambiguity)
  const { data: session } = await admin
    .from('sessions')
    .select('id, title, scheduled_at, duration_minutes, session_type, internship_id, level_id')
    .eq('id', params.id)
    .single();
  if (!session) notFound();

  // 2. Mentor access check
  if (me.profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments').select('id')
      .eq('mentor_id', me.userId).eq('internship_id', session.internship_id).maybeSingle();
    if (!ma) notFound();
  }

  const basePath = me.profile.role === 'admin' ? 'admin' : 'mentor';

  // 3. Resolve level number from level_id via a direct query (not a join)
  let sessionLevelNumber: number | null = null;
  let sessionLevelTitle: string | null = null;
  if (session.level_id) {
    const { data: lv } = await admin
      .from('levels')
      .select('level_number, title')
      .eq('id', session.level_id)
      .single();
    sessionLevelNumber = lv?.level_number ?? null;
    sessionLevelTitle  = lv?.title ?? null;
  }

  // 4. Fetch internship name separately
  const { data: internshipData } = await admin
    .from('internships').select('title').eq('id', session.internship_id).single();

  // 5. Fetch enrollments — filter by level when session is level-gated
  //    Rule: current_level >= sessionLevelNumber means student has reached that level
  let enrollmentsQuery = admin
    .from('enrollments')
    .select('student_id, current_level, status, profiles:student_id (full_name, email)')
    .eq('internship_id', session.internship_id)
    .neq('status', 'filtered')  // never show removed students in attendance
    .order('profiles(full_name)', { ascending: true });

  if (sessionLevelNumber !== null) {
    enrollmentsQuery = enrollmentsQuery.gte('current_level', sessionLevelNumber);
  }

  const [enrollmentsRes, attendanceRes] = await Promise.all([
    enrollmentsQuery,
    admin.from('attendance').select('*').eq('session_id', session.id),
  ]);

  const enrollments = (enrollmentsRes.data ?? []).slice().sort((a: any, b: any) => {
    const an = (a.profiles?.full_name ?? a.profiles?.email ?? '').toLowerCase();
    const bn = (b.profiles?.full_name ?? b.profiles?.email ?? '').toLowerCase();
    return an.localeCompare(bn);
  });

  const attendance = attendanceRes.data ?? [];

  // 6. Marker names
  const markerIds = Array.from(new Set(
    attendance.map((a: any) => a.marked_manually_by).filter(Boolean)
  ));
  const markerProfiles = new Map<string, { full_name: string | null; email: string | null }>();
  if (markerIds.length) {
    const { data: profiles } = await admin.from('profiles').select('id, full_name, email').in('id', markerIds);
    for (const p of profiles ?? []) markerProfiles.set(p.id, p);
  }

  const attMap = new Map<string, any>();
  for (const a of attendance) attMap.set((a as any).student_id, a);

  // 7. Counts — only for the filtered student list
  const counts = { present: 0, partial: 0, absent: 0, notMarked: 0 };
  for (const e of enrollments) {
    const a = attMap.get((e as any).student_id);
    if (!a) counts.notMarked++;
    else if (a.status === 'present') counts.present++;
    else if (a.status === 'partial') counts.partial++;
    else if (a.status === 'absent') counts.absent++;
    else counts.notMarked++;
  }

  // 8. Student IDs for bulk-mark (only the filtered set)
  const eligibleStudentIds = enrollments.map((e: any) => e.student_id);

  return (
    <>
      <PageHeader
        eyebrow={`Attendance · ${internshipData?.title ?? ''}`}
        title={session.title}
        subtitle={`${formatDateTime(session.scheduled_at)} · ${session.duration_minutes}m`}
        actions={
          <Link href={`/${basePath}/sessions/${session.id}`} className="btn btn-ghost">
            <ArrowLeft size={16}/> Back to session
          </Link>
        }
      />

      {/* Level filter notice */}
      {sessionLevelNumber !== null ? (
        <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.1),rgba(99,102,241,.04))', border: '1.5px solid rgba(99,102,241,.25)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0"
            style={{ background: 'linear-gradient(135deg,var(--accent),#818cf8)' }}>
            {sessionLevelNumber}
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
              Level {sessionLevelNumber}{sessionLevelTitle ? ` — ${sessionLevelTitle}` : ''} session
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              Only students at Level {sessionLevelNumber}+ are shown ({enrollments.length} students).
              Students who haven&apos;t reached this level are excluded.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl px-4 py-2.5 mb-5 flex items-center gap-2"
          style={{ background: 'var(--ink-50)', border: '1px solid var(--ink-200)' }}>
          <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
            Global session — all {enrollments.length} active students shown
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Present',    count: counts.present,   color: 'var(--green-700)' },
          { label: 'Partial',    count: counts.partial,   color: '#eab308' },
          { label: 'Absent',     count: counts.absent,    color: 'var(--red-500)' },
          { label: 'Not marked', count: counts.notMarked, color: 'var(--ink-500)' },
        ].map(s => (
          <div key={s.label} className="card">
            <p className="eyebrow">{s.label}</p>
            <p className="stat-num" style={{ color: s.color }}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Bulk actions row */}
      <div className="flex items-start gap-3 flex-wrap mb-6">
        <BulkMarkAllPresent sessionId={session.id} studentIds={eligibleStudentIds}/>

        {/* Reset — only show if any attendance exists for this session's eligible students */}
        {counts.present + counts.partial + counts.absent > 0 && (
          <form action={resetAttendance}>
            <input type="hidden" name="session_id" value={session.id}/>
            <input type="hidden" name="return_url" value={`/${basePath}/sessions/${session.id}/attendance`}/>
            {eligibleStudentIds.map(id => (
              <input key={id} type="hidden" name="student_id" value={id}/>
            ))}
            <button type="submit" className="btn btn-ghost text-sm"
              style={{ color: 'var(--red-700)', borderColor: 'rgba(239,68,68,.25)' }}
              onClick={e => {
                if (!window.confirm(`Clear all ${counts.present + counts.partial + counts.absent} marked records for this session and start fresh?`)) {
                  e.preventDefault();
                }
              }}>
              <Trash2 size={13}/> Reset attendance
            </button>
          </form>
        )}
      </div>

      {enrollments.length === 0 ? (
        <EmptyState
          title={sessionLevelNumber !== null
            ? `No students have reached Level ${sessionLevelNumber} yet`
            : 'No students enrolled in this internship'}
          hint={sessionLevelNumber !== null
            ? 'Promote students to this level from the Levels page before marking attendance.'
            : 'Enrol students from the internship page.'}
        />
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
                const a         = attMap.get(studentId);
                const status    = a?.status ?? null;
                const marker    = a?.marked_manually_by ? markerProfiles.get(a.marked_manually_by) : null;
                const name      = e.profiles?.full_name ?? e.profiles?.email ?? '—';

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
                      {status === 'absent'  && <Pill tone="red">Absent</Pill>}
                      {!status && <span className="text-xs" style={{ color: 'var(--ink-500)' }}>Not marked</span>}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--ink-500)', lineHeight: '1.6' }}>
                      {!a
                        ? <span style={{ color: 'var(--ink-300)' }}>—</span>
                        : marker
                          ? <><span className="font-semibold" style={{ color: 'var(--ink-700)' }}>
                              👤 {marker.full_name ?? marker.email ?? 'Staff'}
                            </span>
                            {a.marked_manually_at && <><br/><span style={{ color: 'var(--ink-400)' }}>{formatDateTime(a.marked_manually_at)}</span></>}
                            </>
                          : a.code_entered_at
                            ? <><span className="font-semibold" style={{ color: 'var(--ink-700)' }}>✓ Self via code</span><br/><span style={{ color: 'var(--ink-400)' }}>{formatDateTime(a.code_entered_at)}</span></>
                            : a.joined_at
                              ? <><span className="font-semibold" style={{ color: 'var(--ink-700)' }}>✓ Self joined</span><br/><span style={{ color: 'var(--ink-400)' }}>{formatDateTime(a.joined_at)}</span></>
                              : status
                                ? <span style={{ color: 'var(--amber-700)' }}>⚠ Old record — no history</span>
                                : <span style={{ color: 'var(--ink-300)' }}>—</span>
                      }
                    </td>
                    <td>
                      <AttendanceRowActions sessionId={session.id} studentId={studentId} currentStatus={status}/>
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
