import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import QuizMonitor from '@/components/QuizMonitor';

export const dynamic = 'force-dynamic';

export default async function AdminQuizMonitorPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('id, internship_id')
    .eq('id', params.id)
    .single();
  if (!session) notFound();

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id')
    .eq('session_id', session.id)
    .single();
  if (!quiz) notFound();

  // Total enrolled students in this internship — for the monitor's denominator
  const { count: totalEnrolled } = await supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('internship_id', session.internship_id);

  return (
    <QuizMonitor
      sessionId={session.id}
      totalEnrolled={totalEnrolled ?? 0}
      backHref={`/admin/sessions/${session.id}/quiz`}
    />
  );
}
