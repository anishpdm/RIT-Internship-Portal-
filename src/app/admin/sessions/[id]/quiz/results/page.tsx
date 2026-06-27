import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, Clock, CheckCircle2, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function QuizResultsPage({ params }: { params: { id: string } }) {
  const me = await requireRole(['admin', 'mentor']);
  const admin = createAdminClient();
  const isAdmin = me.profile.role === 'admin';
  const basePath = isAdmin ? 'admin' : 'mentor';

  // Session + internship
  const { data: session } = await admin
    .from('sessions')
    .select('id, title, internship_id, internships:internship_id (title)')
    .eq('id', params.id)
    .single();
  if (!session) notFound();

  if (me.profile.role === 'mentor') {
    const { data: ma } = await admin
      .from('mentor_assignments').select('id')
      .eq('mentor_id', me.userId).eq('internship_id', session.internship_id).maybeSingle();
    if (!ma) notFound();
  }

  // Quizzes for this session
  const { data: quizzes } = await admin
    .from('quizzes')
    .select('id, title, status, starts_at, ends_at, quiz_questions(id)')
    .eq('session_id', params.id)
    .order('starts_at', { ascending: false });

  if (!quizzes?.length) {
    return (
      <>
        <PageHeader
          eyebrow={`${(session as any).internships?.title}`}
          title={`Quiz results: ${session.title}`}
          actions={<Link href={`/${basePath}/sessions/${params.id}`} className="btn btn-ghost"><ArrowLeft size={16}/> Back</Link>}
        />
        <EmptyState title="No quizzes for this session" hint="Build a quiz first."/>
      </>
    );
  }

  // Enrolled students
  const { data: enrollments } = await admin
    .from('enrollments')
    .select('student_id, profiles:student_id (full_name, email)')
    .eq('internship_id', session.internship_id)
    .neq('status', 'filtered');
  const studentMap = new Map<string, any>(
    (enrollments ?? []).map((e: any) => [e.student_id, e.profiles]),
  );
  const totalStudents = enrollments?.length ?? 0;

  // All question IDs across these quizzes
  const allQuestionIds: string[] = [];
  const quizQuestionCount = new Map<string, number>();
  for (const q of quizzes) {
    const ids = (q.quiz_questions ?? []).map((qq: any) => qq.id);
    quizQuestionCount.set(q.id, ids.length);
    allQuestionIds.push(...ids);
  }

  // All responses with submitted_at — the key data
  const { data: responses } = allQuestionIds.length
    ? await admin
        .from('quiz_responses')
        .select('student_id, question_id, is_correct, submitted_at, quiz_questions:question_id (quiz_id)')
        .in('question_id', allQuestionIds)
    : { data: [] };

  return (
    <>
      <PageHeader
        eyebrow={`${(session as any).internships?.title}`}
        title={`Quiz results: ${session.title}`}
        subtitle="Per-student scores and exactly when each student attempted the quiz."
        actions={<Link href={`/${basePath}/sessions/${params.id}`} className="btn btn-ghost"><ArrowLeft size={16}/> Back</Link>}
      />

      {quizzes.map((quiz: any) => {
        const qTotal = quizQuestionCount.get(quiz.id) ?? 0;
        // Responses for this quiz only
        const quizResponses = (responses ?? []).filter((r: any) => r.quiz_questions?.quiz_id === quiz.id);

        // Group by student
        const byStudent = new Map<string, { answered: number; correct: number; firstAt: string; lastAt: string }>();
        for (const r of quizResponses) {
          if (!byStudent.has(r.student_id)) {
            byStudent.set(r.student_id, { answered: 0, correct: 0, firstAt: r.submitted_at, lastAt: r.submitted_at });
          }
          const s = byStudent.get(r.student_id)!;
          s.answered++;
          if (r.is_correct) s.correct++;
          if (r.submitted_at < s.firstAt) s.firstAt = r.submitted_at;
          if (r.submitted_at > s.lastAt) s.lastAt = r.submitted_at;
        }

        const attempted = byStudent.size;
        const rows = Array.from(byStudent.entries())
          .map(([studentId, stats]) => ({
            studentId,
            profile: studentMap.get(studentId),
            ...stats,
            pct: qTotal > 0 ? Math.round((stats.correct / qTotal) * 100) : 0,
          }))
          .sort((a, b) => {
            if (b.correct !== a.correct) return b.correct - a.correct;
            return new Date(a.firstAt).getTime() - new Date(b.firstAt).getTime(); // earlier finishers rank higher
          });

        // Students who didn't attempt
        const attemptedIds = new Set(byStudent.keys());
        const notAttempted = (enrollments ?? []).filter((e: any) => !attemptedIds.has(e.student_id));

        return (
          <section key={quiz.id} className="mb-10">
            {/* Quiz header */}
            <div className="rounded-2xl p-5 mb-4"
              style={{ background: 'linear-gradient(135deg,#0a0f1e,#1e1b4b)', boxShadow: 'var(--s-md)' }}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-bold text-white text-lg">{quiz.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,.5)' }}>
                    {qTotal} questions
                    {quiz.starts_at && ` · opened ${formatDateTime(quiz.starts_at)}`}
                    {quiz.ends_at && ` · closed ${formatDateTime(quiz.ends_at)}`}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="pill pill-green">{attempted} attempted</span>
                  <span className="pill">{totalStudents - attempted} didn't</span>
                  <span className="pill pill-accent">{Math.round(totalStudents ? (attempted/totalStudents)*100 : 0)}% participation</span>
                </div>
              </div>
            </div>

            {rows.length === 0 ? (
              <EmptyState title="No attempts yet" hint="No students have answered this quiz."/>
            ) : (
              <div className="card p-0 overflow-hidden table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 48 }}>#</th>
                      <th>Student</th>
                      <th style={{ textAlign: 'right' }}>Score</th>
                      <th style={{ textAlign: 'right' }}>Answered</th>
                      <th>Started at</th>
                      <th>Finished at</th>
                      <th>Time taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const scoreColor = r.pct >= 80 ? '#10b981' : r.pct >= 50 ? '#f59e0b' : '#ef4444';
                      const durMs = new Date(r.lastAt).getTime() - new Date(r.firstAt).getTime();
                      const durMin = Math.floor(durMs / 60000);
                      const durSec = Math.floor((durMs % 60000) / 1000);
                      const COLORS = ['#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6'];
                      const ini = (r.profile?.full_name ?? r.profile?.email ?? '?').split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase();
                      return (
                        <tr key={r.studentId}>
                          <td className="font-mono text-sm" style={{ color: 'var(--ink-500)' }}>{idx + 1}</td>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                                style={{ background: COLORS[idx % COLORS.length] }}>{ini}</div>
                              <div>
                                <p className="font-medium text-sm">{r.profile?.full_name ?? '—'}</p>
                                <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{r.profile?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="font-bold" style={{ color: scoreColor }}>{r.correct}/{qTotal}</span>
                            <p className="text-xs font-mono" style={{ color: scoreColor }}>{r.pct}%</p>
                          </td>
                          <td style={{ textAlign: 'right' }} className="font-mono text-sm">{r.answered}/{qTotal}</td>
                          <td className="text-xs" style={{ color: 'var(--ink-600)' }}>{formatDateTime(r.firstAt)}</td>
                          <td className="text-xs" style={{ color: 'var(--ink-600)' }}>{formatDateTime(r.lastAt)}</td>
                          <td className="text-xs font-mono" style={{ color: 'var(--ink-500)' }}>
                            {durMs > 0 ? `${durMin}m ${durSec}s` : '< 1s'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Didn't attempt */}
            {notAttempted.length > 0 && (
              <div className="mt-3 card" style={{ background: 'var(--amber-soft)', borderColor: 'rgba(245,158,11,.2)' }}>
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--amber-700)' }}>
                  ⚠ {notAttempted.length} student{notAttempted.length !== 1 ? 's' : ''} haven't attempted this quiz
                </p>
                <p className="text-xs" style={{ color: 'var(--ink-600)' }}>
                  {notAttempted.map((e: any) => e.profiles?.full_name?.split(' ')[0] ?? e.profiles?.email).join(', ')}
                </p>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
