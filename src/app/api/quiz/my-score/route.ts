import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const quiz_id = req.nextUrl.searchParams.get('quiz_id');
  if (!quiz_id) {
    return NextResponse.json({ error: 'quiz_id required' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id')
    .eq('quiz_id', quiz_id);

  const total = questions?.length ?? 0;
  if (total === 0) return NextResponse.json({ correct: 0, total: 0 });

  const ids = questions!.map((q) => q.id);
  const { data: my } = await supabase
    .from('quiz_responses')
    .select('is_correct')
    .eq('student_id', user.id)
    .in('question_id', ids);

  const correct = (my ?? []).filter((r) => r.is_correct).length;
  return NextResponse.json({ correct, total });
}
