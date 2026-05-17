import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import QuizPresenter from '@/components/QuizPresenter';

export const dynamic = 'force-dynamic';

export default async function AdminQuizRunPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', params.id)
    .single();
  if (!session) notFound();

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id')
    .eq('session_id', session.id)
    .single();
  if (!quiz) notFound();

  return (
    <QuizPresenter
      quizId={quiz.id}
      sessionId={session.id}
      backHref={`/admin/sessions/${session.id}`}
    />
  );
}
