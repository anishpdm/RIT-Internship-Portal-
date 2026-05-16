import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function InternshipsPage() {
  const supabase = createClient();
  const { data: internships } = await supabase
    .from('internships')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Internships"
        subtitle="Cohort programs you've defined. Click any to manage levels, students, and sessions."
        actions={
          <Link href="/admin/internships/new" className="btn btn-primary">
            <Plus size={16} /> New internship
          </Link>
        }
      />

      {internships && internships.length > 0 ? (
        <div className="card overflow-hidden p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Levels</th>
                <th>Window</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {internships.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link
                      href={`/admin/internships/${i.id}`}
                      className="font-display text-base font-medium hover:underline"
                    >
                      {i.title}
                    </Link>
                    {i.description && (
                      <p className="text-xs mt-1 max-w-md truncate" style={{ color: 'var(--ink-500)' }}>
                        {i.description}
                      </p>
                    )}
                  </td>
                  <td className="font-mono">{i.total_levels}</td>
                  <td className="text-sm">
                    {formatDate(i.start_date)} → {formatDate(i.end_date)}
                  </td>
                  <td>
                    <Pill
                      tone={
                        i.status === 'active'
                          ? 'green'
                          : i.status === 'archived'
                            ? 'red'
                            : undefined
                      }
                    >
                      {i.status}
                    </Pill>
                  </td>
                  <td>
                    <Link
                      href={`/admin/internships/${i.id}`}
                      className="text-sm"
                      style={{ color: 'var(--accent)' }}
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No internships yet"
          hint="Click ‘New internship’ to define your first cohort program."
        />
      )}
    </>
  );
}
