import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { getAccessibleLevelIds } from '@/lib/level-access';
import QuizTaker from '@/components/QuizTaker';

export const dynamic = 'force-dynamic';

export default async function StudentQuizPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, level_id, is_hidden, internship_id, internships:internship_id (title)')
    .eq('id', params.id)
    .single();
  if (!session) notFound();

  // Access check for students: session must not be hidden, level must be reached
  if (me.profile.role === 'student') {
    if (session.is_hidden) notFound();
    if (session.level_id) {
      const access = await getAccessibleLevelIds(me.userId);
      if (!access || !access.levelIds.includes(session.level_id)) notFound();
    }
  }

  return (
    <QuizTaker
      sessionId={session.id}
      sessionTitle={session.title}
      internshipTitle={(session as any).internships?.title ?? ''}
      backHref={`/student/sessions/${session.id}`}
    />
  );
}
