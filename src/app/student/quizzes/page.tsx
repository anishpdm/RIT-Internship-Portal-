import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { getAccessibleLevelIds } from '@/lib/level-access';
import { PageHeader, EmptyState, Pill } from '@/components/ui';
import { HelpCircle, Clock, CheckCircle2, PlayCircle, Lock } from 'lucide-react';

export const dynamic = 'force-dynamic';

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default async function StudentQuizzesPage() {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  const access = await getAccessibleLevelIds(me.userId);
  const internshipIds = access?.enrollments.map(e => e.internship_id) ?? [];

  if (!internshipIds.length) {
    return (
      <>
        <PageHeader eyebrow="Student" title="Quizzes" subtitle="Quizzes from your sessions."/>
        <EmptyState title="No enrollments yet" hint="You'll see quizzes here once you're enrolled in an internship."/>
      </>
    );
  }

  const accessibleLevelIds = access?.levelIds ?? [];

  // Get all sessions in enrolled internships.
  // NOTE: filter hidden in JS, not via .eq('is_hidden', false), because
  // older rows may have is_hidden = NULL which .eq() would wrongly exclude.
  const { data: allSessions } = await supabase
    .from('sessions')
    .select('id, title, level_id, is_hidden, internship_id, internships:internship_id (title)')
    .in('internship_id', internshipIds);

  // Filter to sessions the student can access: not hidden (NULL = visible) + level reached
  const visibleSessions = (allSessions ?? []).filter((s: any) =>
    s.is_hidden !== true &&                              // NULL or false → visible
    (!s.level_id || accessibleLevelIds.includes(s.level_id))
  );
  const sessionIds = visibleSessions.map((s: any) => s.id);
  const sessionMap = new Map(visibleSessions.map((s: any) => [s.id, s]));

  if (!sessionIds.length) {
    return (
      <>
        <PageHeader eyebrow="Student" title="Quizzes" subtitle="Quizzes from your sessions."/>
        <EmptyState title="No quizzes available yet" hint="Quizzes appear here when your sessions have them."/>
      </>
    );
  }

  // Fetch quizzes for accessible sessions (not hidden)
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, title, session_id, status, mode, starts_at, ends_at, is_hidden, quiz_questions(id)')
    .in('session_id', sessionIds)
    .order('starts_at', { ascending: false });

  const visibleQuizzes = (quizzes ?? []).filter((q: any) => q.is_hidden !== true);

  // Fetch my responses to compute progress
  const quizIds = visibleQuizzes.map((q: any) => q.id);
  const { data: myResponses } = quizIds.length
    ? await supabase
        .from('quiz_responses')
        .select('question_id, is_correct, quiz_questions:question_id (quiz_id)')
        .eq('student_id', me.userId)
    : { data: [] };

  // Map quiz_id → { answered, correct }
  const progressMap = new Map<string, { answered: number; correct: number }>();
  for (const r of myResponses ?? []) {
    const qid = (r as any).quiz_questions?.quiz_id;
    if (!qid) continue;
    if (!progressMap.has(qid)) progressMap.set(qid, { answered: 0, correct: 0 });
    const p = progressMap.get(qid)!;
    p.answered++;
    if ((r as any).is_correct) p.correct++;
  }

  const now = new Date();

  // Categorise
  const available: any[] = [];
  const upcoming: any[] = [];
  const completed: any[] = [];

  for (const q of visibleQuizzes) {
    const session = sessionMap.get(q.session_id);
    const total = q.quiz_questions?.length ?? 0;
    const prog = progressMap.get(q.id) ?? { answered: 0, correct: 0 };
    const startsAt = q.starts_at ? new Date(q.starts_at) : null;
    const endsAt = q.ends_at ? new Date(q.ends_at) : null;
    const windowState = startsAt && now < startsAt ? 'before' : endsAt && now > endsAt ? 'closed' : 'open';

    const item = { ...q, session, total, prog, windowState };

    if (prog.answered >= total && total > 0) completed.push(item);
    else if (windowState === 'before') upcoming.push(item);
    else available.push(item);
  }

  // Sort available quizzes: open-now first (by closing soonest), then no-window quizzes
  available.sort((a, b) => {
    // Open quizzes with an end date come first, ordered by soonest close
    const aHasEnd = a.windowState === 'open' && a.ends_at;
    const bHasEnd = b.windowState === 'open' && b.ends_at;
    if (aHasEnd && bHasEnd) {
      return new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime();
    }
    if (aHasEnd) return -1;  // a closes soon → first
    if (bHasEnd) return 1;
    // Neither has a close date — keep open ones above, then by start date
    if (a.windowState === 'open' && b.windowState !== 'open') return -1;
    if (b.windowState === 'open' && a.windowState !== 'open') return 1;
    const aStart = a.starts_at ? new Date(a.starts_at).getTime() : 0;
    const bStart = b.starts_at ? new Date(b.starts_at).getTime() : 0;
    return bStart - aStart;
  });

  // Upcoming sorted by soonest opening first
  upcoming.sort((a, b) => {
    const aStart = a.starts_at ? new Date(a.starts_at).getTime() : Infinity;
    const bStart = b.starts_at ? new Date(b.starts_at).getTime() : Infinity;
    return aStart - bStart;
  });

  function QuizCard({ q, kind }: { q: any; kind: 'available' | 'upcoming' | 'completed' }) {
    const pct = q.total > 0 ? Math.round((q.prog.correct / q.total) * 100) : 0;
    const answeredPct = q.total > 0 ? Math.round((q.prog.answered / q.total) * 100) : 0;

    return (
      <Link
        href={`/student/sessions/${q.session_id}/quiz`}
        className="card transition-all hover:scale-[1.01]"
        style={{
          borderColor: kind === 'available' ? 'var(--accent)' : 'var(--ink-200)',
          background: kind === 'available' ? 'linear-gradient(135deg,rgba(99,102,241,.05),transparent)' : 'white',
          opacity: kind === 'upcoming' ? 0.75 : 1,
          textDecoration: 'none',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: kind === 'completed' ? 'var(--green-soft)' : kind === 'upcoming' ? 'var(--ink-100)' : 'var(--accent-soft)',
            }}>
            {kind === 'completed' ? <CheckCircle2 size={20} style={{ color: 'var(--green-700)' }}/>
              : kind === 'upcoming' ? <Clock size={20} style={{ color: 'var(--ink-500)' }}/>
              : <PlayCircle size={20} style={{ color: 'var(--accent)' }}/>}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-sm leading-snug">{q.title}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-500)' }}>
              {q.session?.title} · {q.session?.internships?.title}
            </p>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="pill" style={{ fontSize: '.62rem' }}>{q.total} questions</span>
              {kind === 'available' && q.windowState === 'open' && (() => {
                if (!q.ends_at) {
                  return <span className="pill pill-accent" style={{ fontSize: '.62rem' }}>● Open now</span>;
                }
                const msLeft = new Date(q.ends_at).getTime() - Date.now();
                const hoursLeft = msLeft / 3600000;
                const closingSoon = hoursLeft < 24;
                const label = hoursLeft < 1
                  ? `Closes in ${Math.max(1, Math.round(msLeft / 60000))} min`
                  : hoursLeft < 24
                    ? `Closes in ${Math.round(hoursLeft)}h`
                    : `Closes ${fmt(q.ends_at)}`;
                return (
                  <span className="pill" style={{
                    fontSize: '.62rem',
                    background: closingSoon ? 'rgba(239,68,68,.12)' : 'var(--accent-soft)',
                    color: closingSoon ? 'var(--red-700)' : 'var(--accent)',
                    border: `1px solid ${closingSoon ? 'rgba(239,68,68,.25)' : 'rgba(99,102,241,.2)'}`,
                  }}>
                    {closingSoon ? '🔴' : '●'} {label}
                  </span>
                );
              })()}
              {kind === 'upcoming' && q.starts_at && (
                <span className="pill" style={{ fontSize: '.62rem' }}>Opens {fmt(q.starts_at)}</span>
              )}
              {kind === 'completed' && (
                <span className="pill pill-green" style={{ fontSize: '.62rem' }}>
                  ✓ {q.prog.correct}/{q.total} correct ({pct}%)
                </span>
              )}
              {kind === 'available' && q.prog.answered > 0 && (
                <span className="pill pill-amber" style={{ fontSize: '.62rem' }}>
                  {q.prog.answered}/{q.total} done
                </span>
              )}
            </div>

            {/* Progress bar for in-progress */}
            {kind === 'available' && q.prog.answered > 0 && (
              <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'var(--ink-100)' }}>
                <div className="h-full rounded-full" style={{ width: `${answeredPct}%`, background: 'var(--accent)' }}/>
              </div>
            )}
          </div>

          <div className="shrink-0 self-center">
            {kind === 'completed' ? (
              <span className="font-bold text-lg" style={{ color: pct >= 60 ? '#10b981' : '#f59e0b' }}>{pct}%</span>
            ) : kind === 'available' ? (
              <span className="btn btn-primary" style={{ fontSize: '.72rem', padding: '.4rem .7rem', pointerEvents: 'none' }}>
                {q.prog.answered > 0 ? 'Continue' : 'Start'} →
              </span>
            ) : (
              <Lock size={16} style={{ color: 'var(--ink-300)' }}/>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Student"
        title="Quizzes"
        subtitle="All quizzes from your sessions in one place. Tap any open quiz to start."
      />

      {available.length === 0 && upcoming.length === 0 && completed.length === 0 && (
        <EmptyState title="No quizzes yet" hint="Quizzes from your sessions will appear here."/>
      )}

      {/* Available now */}
      {available.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <PlayCircle size={16} style={{ color: 'var(--accent)' }}/>
            <h2 className="font-display font-bold text-lg">Available now</h2>
            <span className="pill pill-accent" style={{ fontSize: '.65rem' }}>{available.length}</span>
          </div>
          <div className="space-y-3">
            {available.map(q => <QuizCard key={q.id} q={q} kind="available"/>)}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} style={{ color: 'var(--green-700)' }}/>
            <h2 className="font-display font-bold text-lg">Completed</h2>
            <span className="pill pill-green" style={{ fontSize: '.65rem' }}>{completed.length}</span>
          </div>
          <div className="space-y-3">
            {completed.map(q => <QuizCard key={q.id} q={q} kind="completed"/>)}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} style={{ color: 'var(--ink-500)' }}/>
            <h2 className="font-display font-bold text-lg">Upcoming</h2>
            <span className="pill" style={{ fontSize: '.65rem' }}>{upcoming.length}</span>
          </div>
          <div className="space-y-3">
            {upcoming.map(q => <QuizCard key={q.id} q={q} kind="upcoming"/>)}
          </div>
        </section>
      )}
    </>
  );
}
