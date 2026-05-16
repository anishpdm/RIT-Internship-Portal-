import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { page?: string; action?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createClient();
  let query = supabase
    .from('audit_logs')
    .select(
      'id, action, entity_type, entity_id, actor_role, details, created_at, profiles:actor_id (full_name, email)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);
  if (searchParams.action) query = query.eq('action', searchParams.action);

  const { data: logs, count } = await query;
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Audit logs"
        subtitle="Every privileged action — who, when, what."
      />

      {logs && logs.length > 0 ? (
        <>
          <div className="card p-0 overflow-hidden table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id}>
                    <td className="text-xs font-mono">{formatDateTime(l.created_at)}</td>
                    <td className="text-sm">
                      {l.profiles?.full_name ?? l.profiles?.email ?? '—'}
                    </td>
                    <td>
                      <Pill tone={l.actor_role === 'admin' ? 'accent' : 'blue'}>
                        {l.actor_role ?? '—'}
                      </Pill>
                    </td>
                    <td className="font-mono text-xs">{l.action}</td>
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
              Page {page} of {totalPages} · {count} total
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/logs?page=${page - 1}${searchParams.action ? `&action=${searchParams.action}` : ''}`}
                  className="btn btn-ghost"
                >
                  ← Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/logs?page=${page + 1}${searchParams.action ? `&action=${searchParams.action}` : ''}`}
                  className="btn btn-ghost"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        </>
      ) : (
        <EmptyState title="No audit entries" />
      )}
    </>
  );
}
