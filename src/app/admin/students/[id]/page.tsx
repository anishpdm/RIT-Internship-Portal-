import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { StudentDetailView } from '@/components/StudentDetailView';

export const dynamic = 'force-dynamic';

export default async function AdminStudentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole('admin');
  const supabase = createClient();

  return (
    <StudentDetailView
      supabase={supabase}
      studentId={params.id}
      backHref="/admin/students"
      backLabel="All students"
    />
  );
}
