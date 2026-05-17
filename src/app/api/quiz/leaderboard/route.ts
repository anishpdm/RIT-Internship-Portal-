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

  // Get all questions in this quiz
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id')
    .eq('quiz_id', quiz_id);

  const total = questions?.length ?? 0;
  if (total === 0) return NextResponse.json({ leaderboard: [] });

  const questionIds = questions!.map((q) => q.id);

  // Get all responses
  const { data: responses } = await supabase
    .from('quiz_responses')
    .select(
      'student_id, is_correct, profiles:student_id (full_name, email)',
    )
    .in('question_id', questionIds);

  // Aggregate per student
  const byStudent = new Map<
    string,
    { student_id: string; full_name: string | null; email: string | null; correct: number; total: number }
  >();
  for (const r of responses ?? []) {
    const id = r.student_id as string;
    if (!byStudent.has(id)) {
      const p: any = (r as any).profiles;
      byStudent.set(id, {
        student_id: id,
        full_name: p?.full_name ?? null,
        email: p?.email ?? null,
        correct: 0,
        total,
      });
    }
    const row = byStudent.get(id)!;
    if (r.is_correct) row.correct++;
  }

  const leaderboard = Array.from(byStudent.values()).sort(
    (a, b) => b.correct - a.correct,
  );

  return NextResponse.json({ leaderboard, total });
}
