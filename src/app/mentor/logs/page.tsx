import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { X } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function MentorLogsPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    action?: string;
    actor?: string;
  };
}) {
  const me = await requireRole(['mentor', 'admin']);
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createClient();

  // Get the mentor's internships
  let internshipIds: string[] = [];
  if (me.profile.role === 'mentor') {
    const { data: mas } = await supabase
      .from('mentor_assignments')
      .select('internship_id')
      .eq('mentor_id', me.userId);
    internshipIds = (mas ?? []).map((m: any) => m.internship_id);
  }

  // Get all student IDs the mentor can see
  let studentIds: string[] = [];
  if (me.profile.role === 'mentor') {
    if (internshipIds.length === 0) {
      return (
        <>
          <PageHeader
            eyebrow="Mentor"
            title="Student activity"
            subtitle="Audit log of every action your students take."
          />
          <EmptyState
            title="You aren't assigned to any internship yet"
            hint="Once you're assigned, your students' activity will show up here."
          />
        </>
      );
    }
    const { data: enrs } = await supabase
      .from('enrollments')
      .select('student_id')
      .in('internship_id', internshipIds);
    studentIds = Array.from(
      new Set((enrs ?? []).map((e: any) => e.student_id)),
    );
  } else {
    // Admin sees all students
    const { data: ss } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'student');
    studentIds = (ss ?? []).map((s: any) => s.id);
  }

  if (studentIds.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Mentor"
          title="Student activity"
          subtitle="Audit log of every action your students take."
        />
        <EmptyState
          title="No students yet"
          hint="Once students enrol in your internships, their actions will appear here."
        />
      </>
    );
  }

  // Build student list for the filter
  const { data: students } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', studentIds)
    .order('full_name');

  // Query audit_logs for these students only
  let query = supabase
    .from('audit_logs')
    .select(
      'id, action, entity_type, entity_id, actor_role, actor_id, details, created_at, profiles:actor_id (full_name, email)',
      { count: 'exact' },
    )
    .in('actor_id', studentIds)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchParams.action) query = query.eq('action', searchParams.action);
  if (searchParams.actor && studentIds.includes(searchParams.actor)) {
    query = query.eq('actor_id', searchParams.actor);
  }

  const { data: logs, count } = await query;
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  // Distinct action names — within scope only
  const { data: distinctActions } = await supabase
    .from('audit_logs')
    .select('action')
    .in('actor_id', studentIds)
    .limit(500);
  const actionSet = new Set<string>(
    (distinctActions ?? []).map((a: any) => a.action),
  );
  const actions = Array.from(actionSet).sort();

  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      page: undefined as string | undefined,
      actor: searchParams.actor,
      action: searchParams.action,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return `/mentor/logs${qs ? `?${qs}` : ''}`;
  }

  const hasFilters = !!searchParams.actor || !!searchParams.action;
  const currentActor = searchParams.actor
    ? students?.find((s) => s.id === searchParams.actor)
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Mentor"
        title="Student activity"
        subtitle="Audit log of every action your students take — submissions, attendance, quiz responses."
      />

      <div className="card mb-6 space-y-4">
        <p className="eyebrow">Filters</p>

        <form action="/mentor/logs" method="get" className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label">Specific student</label>
            <select name="actor" defaultValue={searchParams.actor ?? ''} className="field">
              <option value="">Anyone</option>
              {students?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name ?? s.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Action type</label>
            <select name="action" defaultValue={searchParams.action ?? ''} className="field">
              <option value="">Any action</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex gap-2 justify-end">
            {hasFilters && (
              <Link href="/mentor/logs" className="btn btn-ghost text-sm">
                <X size={12} /> Clear filters
              </Link>
            )}
            <button type="submit" className="btn btn-primary">
              Apply filters
            </button>
          </div>
        </form>

        {hasFilters && (
          <div
            className="flex flex-wrap gap-2 pt-3"
            style={{ borderTop: '1px solid var(--ink-100)' }}
          >
            <span className="text-xs" style={{ color: 'var(--ink-500)' }}>
              Showing:
            </span>
            {currentActor && (
              <Link href={buildUrl({ actor: undefined })} className="pill pill-accent">
                {currentActor.full_name ?? currentActor.email}{' '}
                <X size={10} className="inline" />
              </Link>
            )}
            {searchParams.action && (
              <Link href={buildUrl({ action: undefined })} className="pill pill-accent">
                Action: {searchParams.action} <X size={10} className="inline" />
              </Link>
            )}
          </div>
        )}
      </div>

      {logs && logs.length > 0 ? (
        <>
          <div className="card p-0 overflow-hidden table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Student</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id}>
                    <td className="text-xs font-mono">
                      {formatDateTime(l.created_at)}
                    </td>
                    <td className="text-sm">
                      {l.actor_id ? (
                        <Link
                          href={buildUrl({ actor: l.actor_id, page: undefined })}
                          className="link"
                        >
                          {l.profiles?.full_name ?? l.profiles?.email ?? '—'}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="font-mono text-xs">
                      <Link
                        href={buildUrl({ action: l.action, page: undefined })}
                        className="link"
                      >
                        {l.action}
                      </Link>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--ink-500)' }}>
                      {l.entity_type}
                      {l.entity_id ? ` · ${l.entity_id.slice(0, 8)}…` : ''}
                    </td>
                    <td>
                      <code className="text-xs" style={{ color: 'var(--ink-500)' }}>
                        {Object.keys(l.details ?? {}).length
                          ? JSON.stringify(l.details).slice(0, 80)
                          : '—'}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-6 text-sm">
            <p style={{ color: 'var(--ink-500)' }}>
              Page {page} of {totalPages} · {count} matching entries
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({ page: String(page - 1) })}
                  className="btn btn-ghost"
                >
                  ← Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="btn btn-ghost"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title={hasFilters ? 'No entries match your filters' : 'No student activity yet'}
          hint={
            hasFilters
              ? 'Try clearing filters.'
              : 'Activity appears here as students submit assignments, mark attendance, or respond to quizzes.'
          }
        />
      )}
    </>
  );
}
