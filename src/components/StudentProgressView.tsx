import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Stat, Pill, EmptyState } from '@/components/ui';
import { formatDateTime, formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  ClipboardCheck,
  Trophy,
  ExternalLink,
  Github,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface Props {
  studentId: string;
  backHref: string;
  backLabel: string;
  scopeInternshipIds?: string[] | null; // null = no scope (admin sees all)
  evalLinkBase: '/admin/submissions' | '/mentor/evaluate';
}

export async function StudentProgressView({
  studentId,
  backHref,
  backLabel,
  scopeInternshipIds,
  evalLinkBase,
}: Props) {
  const supabase = createClient();

  // Student profile
  const { data: student } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', studentId)
    .single();

  if (!student) {
    return (
      <>
        <PageHeader
          eyebrow="Student"
          title="Not found"
          actions={
            <Link href={backHref} className="btn btn-ghost">
              <ArrowLeft size={16} /> {backLabel}
            </Link>
          }
        />
      </>
    );
  }

  // Enrollments — scoped if needed
  let enrQuery = supabase
    .from('enrollments')
    .select(
      'id, internship_id, current_level, status, total_score, enrolled_at, internships:internship_id (id, title, status, total_levels)',
    )
    .eq('student_id', studentId);
  if (scopeInternshipIds && scopeInternshipIds.length > 0) {
    enrQuery = enrQuery.in('internship_id', scopeInternshipIds);
  }
  const { data: enrollments } = await enrQuery;

  const internshipIds = (enrollments ?? []).map((e: any) => e.internship_id);

  // Sessions in those internships
  let allSessions: any[] = [];
  let attendance: any[] = [];
  if (internshipIds.length) {
    const [sessRes, attRes] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, title, session_type, scheduled_at, status, internship_id, internships:internship_id (title)')
        .in('internship_id', internshipIds)
        .order('scheduled_at', { ascending: false }),
      supabase
        .from('attendance')
        .select('session_id, status, marked_at, active_seconds')
        .eq('student_id', studentId),
    ]);
    allSessions = sessRes.data ?? [];
    attendance = attRes.data ?? [];
  }

  const attMap = new Map<string, any>(
    attendance.map((a: any) => [a.session_id, a]),
  );

  // Assignments + submissions
  let allAssignments: any[] = [];
  let submissions: any[] = [];
  if (internshipIds.length) {
    const [aRes, sRes] = await Promise.all([
      supabase
        .from('assignments')
        .select('id, title, kind, max_score, due_at, internship_id, internships:internship_id (title)')
        .in('internship_id', internshipIds)
        .order('due_at', { ascending: false, nullsFirst: false }),
      supabase
        .from('submissions')
        .select('*')
        .eq('student_id', studentId),
    ]);
    allAssignments = aRes.data ?? [];
    submissions = sRes.data ?? [];
  }

  const subMap = new Map<string, any>(
    submissions.map((s: any) => [s.assignment_id, s]),
  );

  // Aggregate stats
  const totalSessions = allSessions.length;
  const attendedSessions = attendance.filter(
    (a: any) => a.status === 'present' || a.status === 'partial',
  ).length;
  const totalAssignments = allAssignments.length;
  const submittedCount = submissions.length;
  const gradedCount = submissions.filter((s: any) => s.status === 'graded').length;
  const avgScore =
    enrollments && enrollments.length > 0
      ? (
          enrollments.reduce((sum: number, e: any) => sum + Number(e.total_score ?? 0), 0) /
          enrollments.length
        ).toFixed(1)
      : '0.0';

  return (
    <>
      <PageHeader
        eyebrow="Student progress"
        title={student.full_name ?? student.email}
        subtitle="Complete view of enrolment, attendance, and submissions."
        actions={
          <Link href={backHref} className="btn btn-ghost">
            <ArrowLeft size={16} /> {backLabel}
          </Link>
        }
      />

      {/* Contact info */}
      <div className="card mb-8">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
          <span className="flex items-center gap-2">
            <Mail size={14} style={{ color: 'var(--ink-500)' }} />
            {student.email}
          </span>
          {student.phone && (
            <span className="flex items-center gap-2">
              <Phone size={14} style={{ color: 'var(--ink-500)' }} />
              {student.phone}
            </span>
          )}
          <span className="flex items-center gap-2">
            <Pill tone="blue">{student.role}</Pill>
          </span>
        </div>
        {student.bio && (
          <p className="mt-3 pt-3 text-sm leading-relaxed"
            style={{ borderTop: '1px solid var(--ink-100)', color: 'var(--ink-500)' }}>
            {student.bio}
          </p>
        )}
      </div>

      {/* Top-level stats */}
      <div className="grid sm:grid-cols-4 gap-5 mb-8">
        <Stat label="Internships" value={enrollments?.length ?? 0} />
        <Stat label="Avg score" value={`${avgScore}%`} />
        <Stat label="Attendance" value={`${attendedSessions}/${totalSessions}`} />
        <Stat label="Submitted" value={`${submittedCount}/${totalAssignments}`} />
      </div>

      {/* Per-internship progress */}
      {enrollments && enrollments.length > 0 ? (
        <div className="space-y-8">
          {enrollments.map((enr: any) => {
            const sessionsInI = allSessions.filter(
              (s: any) => s.internship_id === enr.internship_id,
            );
            const assignmentsInI = allAssignments.filter(
              (a: any) => a.internship_id === enr.internship_id,
            );
            const attendedInI = sessionsInI.filter((s: any) => {
              const a = attMap.get(s.id);
              return a && (a.status === 'present' || a.status === 'partial');
            }).length;
            const submittedInI = assignmentsInI.filter((a: any) => subMap.has(a.id)).length;
            const attPct =
              sessionsInI.length > 0
                ? ((attendedInI / sessionsInI.length) * 100).toFixed(0)
                : '0';
            const subPct =
              assignmentsInI.length > 0
                ? ((submittedInI / assignmentsInI.length) * 100).toFixed(0)
                : '0';
            const score = Number(enr.total_score ?? 0);

            return (
              <div key={enr.id} className="card">
                {/* Internship header */}
                <div className="flex items-start justify-between gap-3 pb-4 mb-4"
                  style={{ borderBottom: '1px solid var(--ink-100)' }}>
                  <div>
                    <p className="eyebrow">{enr.internships?.status}</p>
                    <h3 className="font-display text-xl font-semibold mt-1">
                      {enr.internships?.title}
                    </h3>
                    <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
                      Enrolled {formatDate(enr.enrolled_at)} · Level {enr.current_level} of{' '}
                      {enr.internships?.total_levels}
                    </p>
                  </div>
                  <Pill
                    tone={
                      enr.status === 'active'
                        ? 'blue'
                        : enr.status === 'promoted'
                          ? 'green'
                          : enr.status === 'filtered'
                            ? 'red'
                            : 'accent'
                    }
                  >
                    {enr.status}
                  </Pill>
                </div>

                {/* Mini stats for this internship */}
                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  <div>
                    <p className="text-xs" style={{ color: 'var(--ink-500)' }}>Score</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono font-bold text-lg">{score.toFixed(1)}%</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-100)' }}>
                        <div className="h-full" style={{
                          width: `${Math.min(100, score)}%`,
                          background: score >= 70 ? 'var(--green-500)' : score >= 40 ? 'var(--amber-500)' : 'var(--red-500)',
                        }} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--ink-500)' }}>Attendance</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono font-bold text-lg">{attPct}%</span>
                      <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
                        {attendedInI} of {sessionsInI.length}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--ink-500)' }}>Submissions</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono font-bold text-lg">{subPct}%</span>
                      <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
                        {submittedInI} of {assignmentsInI.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sessions table */}
                {sessionsInI.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-display font-semibold mb-3 flex items-center gap-2">
                      <Calendar size={14} style={{ color: 'var(--accent)' }} />
                      Sessions
                    </h4>
                    <div className="card p-0 overflow-hidden">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Scheduled</th>
                            <th>Attendance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionsInI.slice(0, 10).map((s: any) => {
                            const a = attMap.get(s.id);
                            const status = a?.status ?? 'absent';
                            return (
                              <tr key={s.id}>
                                <td className="font-medium">{s.title}</td>
                                <td className="text-xs capitalize" style={{ color: 'var(--ink-500)' }}>
                                  {s.session_type.replace('_', ' ')}
                                </td>
                                <td className="text-xs">{formatDateTime(s.scheduled_at)}</td>
                                <td>
                                  {status === 'present' && (
                                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--green-700)' }}>
                                      <CheckCircle2 size={12} /> Present
                                    </span>
                                  )}
                                  {status === 'partial' && (
                                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--amber-700)' }}>
                                      <AlertCircle size={12} /> Partial
                                    </span>
                                  )}
                                  {status === 'absent' && (
                                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--ink-500)' }}>
                                      <XCircle size={12} /> Absent
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {sessionsInI.length > 10 && (
                      <p className="text-xs mt-2 text-right" style={{ color: 'var(--ink-500)' }}>
                        + {sessionsInI.length - 10} more
                      </p>
                    )}
                  </div>
                )}

                {/* Assignments table */}
                {assignmentsInI.length > 0 && (
                  <div>
                    <h4 className="font-display font-semibold mb-3 flex items-center gap-2">
                      <ClipboardCheck size={14} style={{ color: 'var(--accent)' }} />
                      Assignments
                    </h4>
                    <div className="card p-0 overflow-hidden">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Kind</th>
                            <th>Due</th>
                            <th>Status</th>
                            <th>Score</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignmentsInI.map((a: any) => {
                            const sub = subMap.get(a.id);
                            return (
                              <tr key={a.id}>
                                <td className="font-medium">{a.title}</td>
                                <td>
                                  <Pill tone={a.kind === 'assessment' ? 'accent' : 'blue'}>
                                    {a.kind}
                                  </Pill>
                                </td>
                                <td className="text-xs">{formatDateTime(a.due_at)}</td>
                                <td>
                                  {sub ? (
                                    <Pill
                                      tone={
                                        sub.status === 'graded'
                                          ? 'green'
                                          : sub.status === 'returned'
                                            ? 'red'
                                            : 'blue'
                                      }
                                    >
                                      {sub.status}
                                    </Pill>
                                  ) : (
                                    <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
                                      not submitted
                                    </span>
                                  )}
                                </td>
                                <td className="font-mono text-sm">
                                  {sub?.score != null ? `${sub.score} / ${a.max_score}` : '—'}
                                </td>
                                <td>
                                  {sub && (
                                    <Link
                                      href={`${evalLinkBase}/${sub.id}`}
                                      className="link text-sm"
                                    >
                                      Open →
                                    </Link>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {sessionsInI.length === 0 && assignmentsInI.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--ink-500)' }}>
                    No sessions or assignments in this internship yet.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Not enrolled in any internship"
          hint="This student doesn't have any enrolments yet."
        />
      )}
    </>
  );
}
