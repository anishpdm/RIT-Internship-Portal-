import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import QuizTaker from '@/components/QuizTaker';

export const dynamic = 'force-dynamic';

export default async function StudentQuizPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['student', 'admin']);
  const supabase = createClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, internships:internship_id (title)')
    .eq('id', params.id)
    .single();
  if (!session) notFound();

  return (
    <QuizTaker
      sessionId={session.id}
      sessionTitle={session.title}
      internshipTitle={(session as any).internships?.title ?? ''}
      backHref={`/student/sessions/${session.id}`}
    />
  );
}
