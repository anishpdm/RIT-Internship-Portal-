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
    .select('id, title, status')
    .eq('session_id', session.id)
    .maybeSingle();

  if (!quiz) {
    const { data: created } = await supabase
      .from('quizzes')
      .insert({
        session_id: session.id,
        title: `Quiz · ${session.title}`,
        status: 'draft',
      })
      .select('id, title, status')
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

  const isActive = quiz.status === 'active' || quiz.status === 'reveal';

  return (
    <>
      <PageHeader
        eyebrow={`Quiz · ${session.title}`}
        title={quiz.title}
        subtitle="Build multiple-choice questions, then start a live quiz that all enrolled students can join."
        actions={
          <>
            {isActive ? (
              <Link
                href={`/admin/sessions/${session.id}/quiz/run`}
                className="btn btn-accent"
              >
                <Play size={14} /> Open live panel
              </Link>
            ) : null}
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
            quiz.status === 'active'
              ? 'accent'
              : quiz.status === 'ended'
                ? 'green'
                : undefined
          }
        >
          Status: {quiz.status}
        </Pill>
      </div>

      {isActive ? (
        <div
          className="card mb-6"
          style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}
        >
          A quiz is currently live. Use the{' '}
          <Link
            href={`/admin/sessions/${session.id}/quiz/run`}
            className="link font-medium"
          >
            live panel
          </Link>{' '}
          to control it. To edit questions, end or reset the quiz first.
        </div>
      ) : (
        <QuizBuilder
          quizId={quiz.id}
          initialQuestions={(questions ?? []) as any}
          runHref={`/admin/sessions/${session.id}/quiz/run`}
        />
      )}
    </>
  );
}
