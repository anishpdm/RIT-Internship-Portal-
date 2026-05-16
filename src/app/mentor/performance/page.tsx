import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, EmptyState } from '@/components/ui';
import { ArrowRight, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MentorPerformanceIndex() {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  let internships: any[] = [];
  if (me.profile.role === 'admin') {
    const { data } = await supabase
      .from('internships')
      .select('id, title, status, total_levels')
      .neq('status', 'archived')
      .order('created_at', { ascending: false });
    internships = data ?? [];
  } else {
    const { data: assignments } = await supabase
      .from('mentor_assignments')
      .select('internship_id, internships:internship_id (id, title, status, total_levels)')
      .eq('mentor_id', me.userId);
    internships = (assignments ?? [])
      .map((a: any) => a.internships)
      .filter(Boolean);
  }

  return (
    <>
      <PageHeader
        eyebrow="Mentor"
        title="Performance"
        subtitle="Pick an internship to see attendance, submissions and scores for every student."
      />

      {internships.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {internships.map((i: any) => (
            <Link
              key={i.id}
              href={`/mentor/performance/${i.id}`}
              className="card card-hover block"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{i.status}</p>
                  <p className="font-display text-lg font-semibold mt-1">{i.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
                    {i.total_levels} levels
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <TrendingUp size={18} />
                </div>
              </div>
              <p className="mt-4 text-sm flex items-center gap-1 link">
                View performance <ArrowRight size={12} />
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No internships available"
          hint="Ask an administrator to assign you to an internship."
        />
      )}
    </>
  );
}
