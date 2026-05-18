import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Quiz state endpoint — supports both legacy live mode and new self-paced mode.
 *
 * For self-paced (the new default), this returns:
 *   - The quiz metadata + window state (before / open / closed)
 *   - The student's FIRST UNANSWERED question (or null if all done)
 *   - The student's current score
 *
 * For live (legacy), returns the current question chosen by the presenter.
 */
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

  const [quizRes, profileRes] = await Promise.all([
    supabase
      .from('quizzes')
      .select(
        'id, title, status, mode, starts_at, ends_at, current_question_index, reveal_answer',
      )
      .eq('session_id', session_id)
      .maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ]);

  const quiz = quizRes.data;
  if (!quiz) return NextResponse.json({ quiz: null });

  const isStudent = profileRes.data?.role === 'student';
  const mode: 'live' | 'self_paced' = quiz.mode ?? 'self_paced';

  // Fetch all questions in order — needed for both modes
  const { data: allQuestions } = await supabase
    .from('quiz_questions')
    .select('id, order_index, question_text, options, correct_option')
    .eq('quiz_id', quiz.id)
    .order('order_index');

  const total = allQuestions?.length ?? 0;

  // ─────────────────────────────────────────
  // SELF-PACED MODE (the new default)
  // ─────────────────────────────────────────
  if (mode === 'self_paced') {
    const now = new Date();
    const startsAt = quiz.starts_at ? new Date(quiz.starts_at) : null;
    const endsAt = quiz.ends_at ? new Date(quiz.ends_at) : null;

    let window_state: 'before' | 'open' | 'closed' = 'open';
    if (startsAt && now < startsAt) window_state = 'before';
    else if (endsAt && now > endsAt) window_state = 'closed';

    // Student-side processing
    if (isStudent) {
      // Fetch student's responses to count progress and score
      const { data: myResponses } = await supabase
        .from('quiz_responses')
        .select('question_id, selected_option, is_correct')
        .eq('student_id', user.id);

      const responseMap = new Map<string, any>();
      for (const r of myResponses ?? []) {
        responseMap.set((r as any).question_id, r);
      }
      // Count only responses to THIS quiz's questions
      const myCorrect = (allQuestions ?? []).filter(
        (q) => responseMap.get(q.id)?.is_correct === true,
      ).length;
      const myAnswered = (allQuestions ?? []).filter((q) =>
        responseMap.has(q.id),
      ).length;

      // Find first unanswered question
      const firstUnanswered = (allQuestions ?? []).find(
        (q) => !responseMap.has(q.id),
      );

      const done = myAnswered >= total && total > 0;

      // Hide correct_option from student
      let questionForClient: any = null;
      let myResponseForCurrent: any = null;
      if (window_state === 'open' && firstUnanswered) {
        const { correct_option, ...rest } = firstUnanswered as any;
        questionForClient = rest;
      }

      return NextResponse.json({
        quiz: {
          id: quiz.id,
          title: quiz.title,
          mode,
          starts_at: quiz.starts_at,
          ends_at: quiz.ends_at,
          window_state,
          answered: myAnswered,
          total,
        },
        question: questionForClient,
        myResponseForCurrent,
        done,
        myScore: { correct: myCorrect, total: myAnswered },
      });
    }

    // Mentor/admin monitor view — return everything with aggregate counts
    const { data: allResponses } = await supabase
      .from('quiz_responses')
      .select('student_id, question_id, is_correct');
    return NextResponse.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        mode,
        starts_at: quiz.starts_at,
        ends_at: quiz.ends_at,
        window_state,
        answered: 0,
        total,
      },
      question: null,
      myResponseForCurrent: null,
      done: false,
      myScore: null,
      // Monitor-only fields
      monitor: {
        responses: allResponses ?? [],
        questions: allQuestions ?? [],
      },
    });
  }

  // ─────────────────────────────────────────
  // LIVE MODE (legacy compatibility)
  // ─────────────────────────────────────────
  const idx = Math.max(0, Math.min(total - 1, quiz.current_question_index));
  const currentQuestion = allQuestions?.[idx] ?? null;
  let questionForClient: any = currentQuestion;
  if (currentQuestion && isStudent && !quiz.reveal_answer) {
    const { correct_option, ...rest } = currentQuestion as any;
    questionForClient = rest;
  }

  let myResponseForCurrent: any = null;
  if (currentQuestion && isStudent) {
    const { data: myResp } = await supabase
      .from('quiz_responses')
      .select('selected_option, is_correct')
      .eq('student_id', user.id)
      .eq('question_id', currentQuestion.id)
      .maybeSingle();
    if (myResp) myResponseForCurrent = myResp;
  }

  return NextResponse.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      mode,
      status: quiz.status,
      starts_at: quiz.starts_at,
      ends_at: quiz.ends_at,
      window_state:
        quiz.status === 'active'
          ? 'open'
          : quiz.status === 'ended'
            ? 'closed'
            : 'before',
      answered: 0,
      total,
      current_question_index: idx,
      reveal_answer: quiz.reveal_answer,
    },
    question: questionForClient,
    myResponseForCurrent,
    done: false,
    myScore: null,
  });
}
