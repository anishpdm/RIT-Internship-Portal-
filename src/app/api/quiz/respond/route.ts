import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const question_id = String(body.question_id ?? '');
  const selected_option = Number(body.selected_option ?? -1);
  const response_time_ms = body.response_time_ms
    ? Number(body.response_time_ms)
    : null;

  if (!question_id || selected_option < 0) {
    return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  // Fetch question + quiz status
  const { data: q } = await supabase
    .from('quiz_questions')
    .select(
      'id, correct_option, options, quizzes:quiz_id (id, status, mode, starts_at, ends_at, sessions:session_id (internship_id))',
    )
    .eq('id', question_id)
    .single();

  if (!q) {
    return NextResponse.json({ error: 'question not found' }, { status: 404 });
  }

  const quiz: any = (q as any).quizzes;
  if (!quiz) {
    return NextResponse.json({ error: 'quiz not found' }, { status: 404 });
  }

  // Check the quiz is acceptable to answer — different rules per mode
  const mode = quiz.mode ?? 'self_paced';
  if (mode === 'self_paced') {
    const now = new Date();
    const startsAt = quiz.starts_at ? new Date(quiz.starts_at) : null;
    const endsAt = quiz.ends_at ? new Date(quiz.ends_at) : null;
    if (startsAt && now < startsAt) {
      return NextResponse.json(
        { error: 'Quiz has not opened yet' },
        { status: 403 },
      );
    }
    if (endsAt && now > endsAt) {
      return NextResponse.json(
        { error: 'Quiz window has closed' },
        { status: 403 },
      );
    }
  } else {
    // Live mode legacy
    if (quiz.status !== 'active') {
      return NextResponse.json(
        { error: 'Quiz is not active' },
        { status: 403 },
      );
    }
  }

  // Verify student is enrolled
  const internship_id = quiz.sessions?.internship_id;
  if (internship_id) {
    const { data: enr } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', user.id)
      .eq('internship_id', internship_id)
      .maybeSingle();
    if (!enr) {
      return NextResponse.json(
        { error: 'You are not enrolled in this internship' },
        { status: 403 },
      );
    }
  }

  const opts = Array.isArray(q.options) ? q.options : [];
  if (selected_option >= opts.length) {
    return NextResponse.json({ error: 'invalid option' }, { status: 400 });
  }
  const is_correct = selected_option === q.correct_option;

  // Upsert (one response per student per question)
  const { data: existing } = await supabase
    .from('quiz_responses')
    .select('id')
    .eq('question_id', question_id)
    .eq('student_id', user.id)
    .maybeSingle();

  if (existing) {
    // Don't allow changing answer once submitted — Mentimeter-style locks in first choice
    return NextResponse.json(
      { error: 'You have already answered this question' },
      { status: 400 },
    );
  }

  const { error } = await supabase.from('quiz_responses').insert({
    question_id,
    student_id: user.id,
    selected_option,
    is_correct,
    response_time_ms,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    actor_id: user.id,
    actor_role: 'student',
    action: 'quiz.respond',
    entity_type: 'quiz_response',
    entity_id: question_id,
    details: { selected_option, is_correct, quiz_id: quiz.id },
  });

  return NextResponse.json({ ok: true, is_correct });
}
