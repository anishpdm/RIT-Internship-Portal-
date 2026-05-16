import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PageHeader, Stat, Pill, EmptyState } from '@/components/ui';
import { formatDateTime, formatDate, relativeTime } from '@/lib/utils';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Github,
  TrendingUp,
} from 'lucide-react';

/**
 * Renders the full progress view for a single student.
 * Used by both /admin/students/[id] and /mentor/students/[id].
 */
export async function StudentDetailView({
  supabase,
  studentId,
  backHref,
  backLabel,
  scope,
}: {
  supabase: SupabaseClient<any>;
  studentId: string;
  backHref: string;
  backLabel: string;
  /** Restrict enrolments to these internship IDs (mentor scope). undefined = admin (all) */
  scope?: string[];
}) {
  // Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', studentId)
    .single();

  if (!profile) {
    return (
      <>
        <PageHeader eyebrow="" title="Student not found" />
        <Link href={backHref} className="btn btn-ghost">
          <ArrowLeft size={16} /> {backLabel}
        </Link>
      </>
    );
  }

  // Enrolments
  let enrollQuery = supabase
    .from('enrollments')
    .select(
      'id, current_level, status, total_score, enrolled_at, promoted_at, filtered_at, completed_at, internship_id, internships:internship_id (id, title, status, total_levels)',
    )
    .eq('student_id', studentId);
  if (scope) {
    if (scope.length === 0) {
      enrollQuery = enrollQuery.eq('internship_id', '00000000-0000-0000-0000-000000000000');
    } else {
      enrollQuery = enrollQuery.in('internship_id', scope);
    }
  }
  const { data: enrollments } = await enrollQuery;

  const internshipIds = (enrollments ?? [])
    .map((e: any) => e.internship_id)
    .filter(Boolean);

  // Submissions across those internships
  let submissions: any[] = [];
  if (internshipIds.length) {
    const { data } = await supabase
      .from('submissions')
      .select(
        '*, assignments:assignment_id!inner (id, title, kind, max_score, internship_id, internships:internship_id (title))',
      )
      .eq('student_id', studentId)
      .in('assignments.internship_id', internshipIds)
      .order('submitted_at', { ascending: false });
    submissions = data ?? [];
  }

  // Attendance across sessions in those internships
  let attendance: any[] = [];
  if (internshipIds.length) {
    const { data } = await supabase
      .from('attendance')
      .select(
        '*, sessions:session_id!inner (id, title, session_type, scheduled_at, internship_id, internships:internship_id (title))',
      )
      .eq('student_id', studentId)
      .in('sessions.internship_id', internshipIds)
      .order('marked_at', { ascending: false });
    attendance = data ?? [];
  }

  // Aggregates
  const graded = submissions.filter((s) => s.status === 'graded');
  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const partialCount = attendance.filter((a) => a.status === 'partial').length;
  const avgScore =
    graded.length > 0
      ? (
          graded.reduce(
            (acc, s) =>
              acc + (Number(s.score) / Number(s.assignments?.max_score || 1)) * 100,
            0,
          ) / graded.length
        ).toFixed(1)
      : '0.0';

  return (
    <>
      <PageHeader
        eyebrow="Student progress"
        title={profile.full_name ?? profile.email}
        subtitle={profile.bio || 'Complete academic record for this student.'}
        actions={
          <Link href={backHref} className="btn btn-ghost">
            <ArrowLeft size={16} /> {backLabel}
          </Link>
        }
      />

      {/* Profile card */}
      <div className="card mb-8">
        <div className="flex items-start gap-5 flex-wrap">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, #818cf8 100%)',
              color: 'white',
            }}
          >
            {(profile.full_name ?? profile.email)
              .split(' ')
              .map((p: string) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-2xl font-semibold">
              {profile.full_name ?? '—'}
            </p>
            <div className="flex gap-4 flex-wrap mt-2 text-sm" style={{ color: 'var(--ink-500)' }}>
              <span className="flex items-center gap-1">
                <Mail size={12} /> {profile.email}
              </span>
              {profile.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={12} /> {profile.phone}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar size={12} /> Joined {formatDate(profile.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate stats */}
      <div className="grid sm:grid-cols-4 gap-5 mb-10">
        <Stat label="Internships" value={enrollments?.length ?? 0} />
        <Stat label="Avg score" value={`${avgScore}%`} />
        <Stat
          label="Sessions attended"
          value={`${presentCount}${partialCount ? ` +${partialCount}p` : ''}`}
        />
        <Stat label="Submissions" value={submissions.length} />
      </div>

      {/* Enrolments */}
      <h2 className="font-display text-xl font-semibold mb-4">Enrolments</h2>
      {enrollments && enrollments.length > 0 ? (
        <div className="grid lg:grid-cols-2 gap-4 mb-10">
          {enrollments.map((e: any) => {
            const score = Number(e.total_score ?? 0);
            return (
              <div key={e.id} className="card">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg font-semibold">
                      {e.internships?.title}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
                      Level {e.current_level} of {e.internships?.total_levels} ·
                      enrolled {formatDate(e.enrolled_at)}
                    </p>
                  </div>
                  <Pill
                    tone={
                      e.status === 'active'
                        ? 'blue'
                        : e.status === 'promoted'
                          ? 'green'
                          : e.status === 'filtered'
                            ? 'red'
                            : 'accent'
                    }
                  >
                    {e.status}
                  </Pill>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-lg">
                    {score.toFixed(1)}%
                  </span>
                  <div
                    className="flex-1 h-2 rounded-full overflow-hidden"
                    style={{ background: 'var(--ink-100)' }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, score)}%`,
                        background:
                          score >= 70
                            ? 'var(--green-500)'
                            : score >= 40
                              ? 'var(--amber-500)'
                              : 'var(--red-500)',
                      }}
                    />
                  </div>
                </div>
                <div className="mt-3 text-xs" style={{ color: 'var(--ink-500)' }}>
                  Progress: Level {e.current_level} / {e.internships?.total_levels}
                  {e.promoted_at && <> · last promoted {relativeTime(e.promoted_at)}</>}
                  {e.filtered_at && <> · filtered {relativeTime(e.filtered_at)}</>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Not enrolled in any internship" />
      )}

      {/* Submissions */}
      <h2 className="font-display text-xl font-semibold mb-4">
        Submissions ({submissions.length})
      </h2>
      {submissions.length > 0 ? (
        <div className="card p-0 overflow-hidden mb-10">
          <table className="table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Internship</th>
                <th>Kind</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Score</th>
                <th>Links</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s: any) => (
                <tr key={s.id}>
                  <td>
                    <p className="font-medium">{s.assignments?.title}</p>
                  </td>
                  <td className="text-sm" style={{ color: 'var(--ink-500)' }}>
                    {s.assignments?.internships?.title}
                  </td>
                  <td>
                    <Pill
                      tone={s.assignments?.kind === 'assessment' ? 'accent' : 'blue'}
                    >
                      {s.assignments?.kind}
                    </Pill>
                  </td>
                  <td className="text-xs">{formatDateTime(s.submitted_at)}</td>
                  <td>
                    <Pill
                      tone={
                        s.status === 'graded'
                          ? 'green'
                          : s.status === 'returned'
                            ? 'red'
                            : 'blue'
                      }
                    >
                      {s.status}
                    </Pill>
                  </td>
                  <td className="font-mono text-sm">
                    {s.score != null
                      ? `${s.score} / ${s.assignments?.max_score}`
                      : '—'}
                  </td>
                  <td className="text-xs">
                    {s.github_url && (
                      <a
                        href={s.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="link inline-flex items-center gap-1"
                      >
                        <Github size={11} /> repo
                      </a>
                    )}
                    {s.file_url && (
                      <a
                        href={s.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="link inline-flex items-center gap-1 ml-2"
                      >
                        <ExternalLink size={11} /> file
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty mb-10">No submissions yet.</div>
      )}

      {/* Attendance */}
      <h2 className="font-display text-xl font-semibold mb-4">
        Attendance ({attendance.length})
      </h2>
      {attendance.length > 0 ? (
        <div className="card p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Internship</th>
                <th>Type</th>
                <th>Status</th>
                <th>Active time</th>
                <th>Marked</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((a: any) => (
                <tr key={a.id}>
                  <td>
                    <p className="font-medium">{a.sessions?.title}</p>
                    {a.sessions?.scheduled_at && (
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                        {formatDateTime(a.sessions.scheduled_at)}
                      </p>
                    )}
                  </td>
                  <td className="text-sm" style={{ color: 'var(--ink-500)' }}>
                    {a.sessions?.internships?.title}
                  </td>
                  <td className="text-xs capitalize">
                    {a.sessions?.session_type?.replace('_', ' ')}
                  </td>
                  <td>
                    {a.status === 'present' ? (
                      <Pill tone="green">
                        <CheckCircle2 size={10} className="inline" /> present
                      </Pill>
                    ) : a.status === 'partial' ? (
                      <Pill tone="amber">partial</Pill>
                    ) : (
                      <Pill tone="red">
                        <XCircle size={10} className="inline" /> {a.status}
                      </Pill>
                    )}
                  </td>
                  <td className="font-mono text-xs">
                    {a.active_seconds
                      ? `${Math.floor(a.active_seconds / 60)}m ${a.active_seconds % 60}s`
                      : '—'}
                  </td>
                  <td className="text-xs">
                    {a.marked_at ? formatDateTime(a.marked_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No attendance records yet.</div>
      )}
    </>
  );
}
