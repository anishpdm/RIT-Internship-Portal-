import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const quiz_id = String(body.quiz_id ?? '');
  const action = String(body.action ?? '');

  if (!quiz_id || !action) {
    return NextResponse.json({ error: 'quiz_id and action required' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'mentor')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, session_id, status, current_question_index, sessions:session_id (internship_id)')
    .eq('id', quiz_id)
    .single();
  if (!quiz) return NextResponse.json({ error: 'quiz not found' }, { status: 404 });

  // Mentor scope check
  if (profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments')
      .select('id')
      .eq('mentor_id', user.id)
      .eq('internship_id', (quiz as any).sessions?.internship_id)
      .maybeSingle();
    if (!ma) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Get total questions for bounds
  const { count: totalQuestions } = await supabase
    .from('quiz_questions')
    .select('id', { count: 'exact', head: true })
    .eq('quiz_id', quiz_id);

  const total = totalQuestions ?? 0;
  let update: Record<string, unknown> = {};
  let auditAction = `quiz.${action}`;

  switch (action) {
    case 'start':
      if (total === 0) {
        return NextResponse.json(
          { error: 'Add at least one question first' },
          { status: 400 },
        );
      }
      update = {
        status: 'active',
        current_question_index: 0,
        reveal_answer: false,
        started_at: new Date().toISOString(),
      };
      break;
    case 'reveal':
      update = { reveal_answer: true };
      break;
    case 'next':
      const nextIdx = quiz.current_question_index + 1;
      if (nextIdx >= total) {
        update = {
          status: 'ended',
          ended_at: new Date().toISOString(),
          reveal_answer: true,
        };
        auditAction = 'quiz.end';
      } else {
        update = {
          current_question_index: nextIdx,
          reveal_answer: false,
        };
      }
      break;
    case 'previous':
      update = {
        current_question_index: Math.max(0, quiz.current_question_index - 1),
        reveal_answer: false,
      };
      break;
    case 'end':
      update = {
        status: 'ended',
        ended_at: new Date().toISOString(),
        reveal_answer: true,
      };
      break;
    case 'reset':
      update = {
        status: 'draft',
        current_question_index: 0,
        reveal_answer: false,
        started_at: null,
        ended_at: null,
      };
      break;
    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }

  const { error } = await supabase
    .from('quizzes')
    .update(update)
    .eq('id', quiz_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    actor_id: user.id,
    actor_role: profile.role,
    action: auditAction,
    entity_type: 'quiz',
    entity_id: quiz_id,
    details: { action, ...update },
  });

  return NextResponse.json({ ok: true, update });
}
