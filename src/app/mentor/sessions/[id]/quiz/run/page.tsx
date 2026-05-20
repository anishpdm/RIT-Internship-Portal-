import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import QuizMonitor from '@/components/QuizMonitor';

export const dynamic = 'force-dynamic';

export default async function MentorQuizMonitorPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['admin', 'mentor']);
  const admin = createAdminClient();

  const { data: session } = await admin
    .from('sessions')
    .select('id, internship_id')
    .eq('id', params.id)
    .single();
  if (!session) notFound();

  const { data: quiz } = await admin
    .from('quizzes')
    .select('id')
    .eq('session_id', session.id)
    .single();
  if (!quiz) notFound();

  // Fetch enrolled students with names — for the per-student breakdown table
  const { data: enrolled } = await admin
    .from('enrollments')
    .select('student_id, profiles:student_id (full_name, email)')
    .eq('internship_id', session.internship_id);

  const enrolledStudents = (enrolled ?? [])
    .map((e: any) => ({
      id: e.student_id,
      name: e.profiles?.full_name ?? e.profiles?.email ?? 'Unknown',
      email: e.profiles?.email ?? '',
    }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  return (
    <QuizMonitor
      sessionId={session.id}
      enrolledStudents={enrolledStudents}
      backHref={`/mentor/sessions/${session.id}/quiz`}
    />
  );
}
