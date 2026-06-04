import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { ArrowLeft, Settings2 } from 'lucide-react';
import ContentControlPanel from './ContentControlPanel';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ContentControlPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole('admin');
  const supabase = createAdminClient();

  const { data: internship } = await supabase
    .from('internships')
    .select('id, title, template_id, start_date')
    .eq('id', params.id)
    .single();

  if (!internship) notFound();

  // Fetch sessions with their quizzes
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, session_type, scheduled_at, recording_url, is_hidden, cloned_from, status, duration_minutes')
    .eq('internship_id', params.id)
    .order('scheduled_at', { ascending: true, nullsFirst: false });

  const sessionIds = (sessions ?? []).map((s: any) => s.id);

  // Fetch quizzes for these sessions
  let quizzes: any[] = [];
  if (sessionIds.length) {
    const { data: qz } = await supabase
      .from('quizzes')
      .select('id, title, session_id, is_hidden, cloned_from, status, quiz_questions(id)')
      .in('session_id', sessionIds);
    quizzes = qz ?? [];
  }

  // Fetch assignments
  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, title, kind, due_at, max_score, weight, is_hidden, cloned_from')
    .eq('internship_id', params.id)
    .order('due_at', { ascending: true, nullsFirst: false });

  // Attach quizzes to sessions
  const sessionsWithQuizzes = (sessions ?? []).map((s: any) => ({
    ...s,
    quizzes: quizzes.filter((q: any) => q.session_id === s.id),
  }));

  return (
    <div className="fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/admin/internships/${params.id}`}
          className="btn btn-ghost"
          style={{ padding: '0.5rem' }}
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <p className="eyebrow mb-0.5 flex items-center gap-1.5">
            <Settings2 size={12} /> Content control
          </p>
          <h1 className="font-display font-bold text-2xl">{internship.title}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ink-500)' }}>
            Toggle visibility for each session, assignment, and quiz.
            Hidden items are invisible to students.
          </p>
        </div>
      </div>

      <ContentControlPanel
        internshipId={params.id}
        sessions={sessionsWithQuizzes}
        assignments={assignments ?? []}
        isCloned={!!internship.template_id}
      />
    </div>
  );
}
