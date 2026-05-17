import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const session_id = req.nextUrl.searchParams.get('session_id');
  if (!session_id) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, title, status, current_question_index, reveal_answer')
    .eq('session_id', session_id)
    .maybeSingle();

  if (!quiz) return NextResponse.json({ quiz: null });

  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, order_index, question_text, options, correct_option, time_limit_seconds')
    .eq('quiz_id', quiz.id)
    .order('order_index');

  const total = questions?.length ?? 0;
  const idx = Math.max(0, Math.min(total - 1, quiz.current_question_index));
  const currentQuestion = questions?.[idx] ?? null;

  // Hide correct_option from students unless reveal is on
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const isStudent = profile?.role === 'student';

  let questionForClient = currentQuestion;
  if (currentQuestion && isStudent && !quiz.reveal_answer) {
    const { correct_option, ...rest } = currentQuestion;
    questionForClient = rest as any;
  }

  // Student's own response for current question
  let myResponse: any = null;
  if (currentQuestion && isStudent) {
    const { data: r } = await supabase
      .from('quiz_responses')
      .select('selected_option, is_correct')
      .eq('question_id', currentQuestion.id)
      .eq('student_id', user.id)
      .maybeSingle();
    myResponse = r;
  }

  // Aggregate response counts (for presenter view) — only on reveal or for non-students
  let responseCounts: number[] = [];
  let respondedStudents = 0;
  if (currentQuestion && (!isStudent || quiz.reveal_answer)) {
    const { data: counts } = await supabase
      .from('quiz_responses')
      .select('selected_option')
      .eq('question_id', currentQuestion.id);
    respondedStudents = counts?.length ?? 0;
    const optsLen = Array.isArray(currentQuestion.options)
      ? currentQuestion.options.length
      : 4;
    responseCounts = new Array(optsLen).fill(0);
    for (const c of counts ?? []) {
      const o = (c as any).selected_option;
      if (typeof o === 'number' && o >= 0 && o < optsLen) {
        responseCounts[o]++;
      }
    }
  }

  return NextResponse.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      status: quiz.status,
      current_question_index: idx,
      total_questions: total,
      reveal_answer: quiz.reveal_answer,
    },
    question: questionForClient,
    myResponse,
    responseCounts,
    respondedStudents,
  });
}
