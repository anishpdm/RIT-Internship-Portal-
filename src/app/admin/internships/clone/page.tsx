import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import CloneWizard from './CloneWizard';

export const dynamic = 'force-dynamic';

export default async function CloneInternshipPage() {
  await requireRole('admin');
  const supabase = createClient();

  const { data: internships } = await supabase
    .from('internships')
    .select('id, title, status, start_date, end_date, total_levels')
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  return <CloneWizard internships={internships ?? []} />;
}
