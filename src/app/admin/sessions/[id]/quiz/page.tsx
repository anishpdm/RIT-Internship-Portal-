import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill } from '@/components/ui';
import { ArrowLeft, Play } from 'lucide-react';
import QuizBuilder from '@/components/QuizBuilder';

export const dynamic = 'force-dynamic';

export default async function AdminQuizPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, internship_id, internships:internship_id (title)')
    .eq('id', params.id)
    .single();
  if (!session) notFound();

  // Get or create the quiz for this session
  let { data: quiz } = await supabase
    .from('quizzes')
    .select('id, title, status, mode, starts_at, ends_at')
    .eq('session_id', session.id)
    .maybeSingle();

  if (!quiz) {
    const { data: created } = await supabase
      .from('quizzes')
      .insert({
        session_id: session.id,
        title: `Quiz · ${session.title}`,
        status: 'draft',
        mode: 'self_paced',
      })
      .select('id, title, status, mode, starts_at, ends_at')
      .single();
    quiz = created;
  }

  if (!quiz) {
    return (
      <div className="empty">
        Could not initialise quiz. Make sure the quiz schema migration has been run in Supabase.
      </div>
    );
  }

  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, order_index, question_text, options, correct_option, time_limit_seconds')
    .eq('quiz_id', quiz.id)
    .order('order_index');

  // Window state
  const now = Date.now();
  const startMs = quiz.starts_at ? new Date(quiz.starts_at).getTime() : null;
  const endMs = quiz.ends_at ? new Date(quiz.ends_at).getTime() : null;
  const scheduled = !!(startMs && endMs);
  const isOpen = scheduled && now >= (startMs as number) && now <= (endMs as number);
  const isClosed = scheduled && now > (endMs as number);

  return (
    <>
      <PageHeader
        eyebrow={`Quiz · ${session.title}`}
        title={quiz.title}
        subtitle="Build multiple-choice questions, then schedule a window when students can take the quiz at their own pace."
        actions={
          <>
            {scheduled && (
              <Link
                href={`/admin/sessions/${session.id}/quiz/run`}
                className="btn btn-accent"
              >
                <Play size={14} /> Open monitor
              </Link>
            )}
            <Link
              href={`/admin/sessions/${session.id}`}
              className="btn btn-ghost"
            >
              <ArrowLeft size={16} /> Back
            </Link>
          </>
        }
      />

      <div className="mb-4">
        <Pill
          tone={
            isOpen ? 'accent' : isClosed ? 'green' : scheduled ? 'amber' : undefined
          }
        >
          {isOpen
            ? 'Open now'
            : isClosed
              ? 'Closed'
              : scheduled
                ? 'Scheduled'
                : 'Draft'}
        </Pill>
      </div>

      <QuizBuilder
        quizId={quiz.id}
        initialQuestions={(questions ?? []) as any}
        initialStartsAt={quiz.starts_at}
        initialEndsAt={quiz.ends_at}
        runHref={`/admin/sessions/${session.id}/quiz/run`}
      />
    </>
  );
}
