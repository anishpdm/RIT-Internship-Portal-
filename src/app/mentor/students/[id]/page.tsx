import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { StudentDetailView } from '@/components/StudentDetailView';

export const dynamic = 'force-dynamic';

export default async function MentorStudentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  // Build the internship scope: mentors only see data for their assigned internships
  let scope: string[] | undefined;
  if (me.profile.role === 'mentor') {
    const { data: assignments } = await supabase
      .from('mentor_assignments')
      .select('internship_id')
      .eq('mentor_id', me.userId);
    scope = (assignments ?? []).map((a: any) => a.internship_id);

    // Confirm the target student is in at least one of my internships
    if (scope.length === 0) redirect('/mentor/students');
    const { data: enrolled } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', params.id)
      .in('internship_id', scope)
      .limit(1);
    if (!enrolled || enrolled.length === 0) redirect('/mentor/students');
  }

  return (
    <StudentDetailView
      supabase={supabase}
      studentId={params.id}
      backHref="/mentor/students"
      backLabel="All students"
      scope={scope}
    />
  );
}
