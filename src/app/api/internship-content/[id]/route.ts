import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await requireRole('admin');
  const supabase = createClient();
  const { id } = params;

  const [{ data: internship }, { data: sessions }, { data: assignments }, { data: quizzes }] =
    await Promise.all([
      supabase.from('internships').select('id, start_date').eq('id', id).single(),
      supabase
        .from('sessions')
        .select('id, title, session_type, scheduled_at, recording_url, duration_minutes')
        .eq('internship_id', id)
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('assignments')
        .select('id, title, kind, due_at, max_score, weight, description')
        .eq('internship_id', id)
        .order('due_at', { ascending: true, nullsFirst: false }),
      supabase
        .from('quizzes')
        .select('id, title, session_id, starts_at, quiz_questions(id)')
        .eq('sessions.internship_id', id)
        .not('session_id', 'is', null),
    ]);

  if (!internship) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Also fetch quizzes via join since the above join may not work cleanly
  const sessionIds = (sessions ?? []).map((s: any) => s.id);
  let quizData: any[] = [];
  if (sessionIds.length) {
    const { data: qz } = await supabase
      .from('quizzes')
      .select('id, title, session_id, starts_at, quiz_questions(id)')
      .in('session_id', sessionIds);
    quizData = qz ?? [];
  }

  const srcStart = internship.start_date ? new Date(internship.start_date) : null;

  function dayNum(date: string | null): number {
    if (!date || !srcStart) return 0;
    const d = new Date(date).getTime();
    return Math.max(1, Math.round((d - srcStart.getTime()) / 86400000) + 1);
  }

  return NextResponse.json({
    sessions: (sessions ?? []).map((s: any) => ({
      id: s.id,
      title: s.title,
      session_type: s.session_type,
      scheduled_at: s.scheduled_at,
      recording_url: s.recording_url,
      day_number: dayNum(s.scheduled_at),
    })),
    assignments: (assignments ?? []).map((a: any) => ({
      id: a.id,
      title: a.title,
      kind: a.kind,
      due_at: a.due_at,
      max_score: a.max_score,
      weight: a.weight,
      day_number: dayNum(a.due_at),
    })),
    quizzes: quizData.map((q: any) => ({
      id: q.id,
      title: q.title,
      session_id: q.session_id,
      starts_at: q.starts_at,
      question_count: q.quiz_questions?.length ?? 0,
    })),
  });
}
