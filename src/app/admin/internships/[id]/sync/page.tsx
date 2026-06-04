import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Pill } from '@/components/ui';
import { ArrowLeft, RefreshCw, Video, BookOpen, HelpCircle, Check } from 'lucide-react';

export const dynamic = 'force-dynamic';

// ── Sync server action ────────────────────────────────────────────
async function syncItems(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const supabase = createAdminClient();

  const cloneId   = String(formData.get('clone_id')   ?? '');
  const sourceId  = String(formData.get('source_id')  ?? '');
  const newStart  = String(formData.get('new_start')  ?? '');
  const srcStart  = String(formData.get('src_start')  ?? '');

  if (!cloneId || !sourceId) redirect(`/admin/internships/${cloneId}`);

  const dayOffset = newStart && srcStart
    ? Math.round((new Date(newStart).getTime() - new Date(srcStart).getTime()) / 86400000)
    : 0;

  // Fetch selected items from form
  const selSessions    = formData.getAll('session_ids')    as string[];
  const selAssignments = formData.getAll('assignment_ids') as string[];
  const selQuizzes     = formData.getAll('quiz_ids')       as string[];

  // Fetch level mapping: source level_number → clone level id
  const { data: cloneLevels }  = await supabase.from('levels').select('id, level_number').eq('internship_id', cloneId);
  const { data: sourceLevels } = await supabase.from('levels').select('id, level_number').eq('internship_id', sourceId);
  const levelMap = new Map<string, string>();
  for (const sl of sourceLevels ?? []) {
    const cl = cloneLevels?.find((l: any) => l.level_number === sl.level_number);
    if (cl) levelMap.set(sl.id, cl.id);
  }

  const sessionIdMap = new Map<string, string>(); // source session id → new clone session id

  // ── Sync sessions ──────────────────────────────────────────────
  if (selSessions.length) {
    const { data: srcSessions } = await supabase
      .from('sessions')
      .select('*')
      .in('id', selSessions);

    for (const s of srcSessions ?? []) {
      const { data: created } = await supabase
        .from('sessions')
        .insert({
          internship_id: cloneId,
          level_id: s.level_id ? levelMap.get(s.level_id) ?? null : null,
          title: s.title,
          description: s.description,
          session_type: s.session_type,
          status: 'scheduled',
          recording_url: s.recording_url,
          meeting_url: null,
          scheduled_at: s.scheduled_at
            ? new Date(new Date(s.scheduled_at).getTime() + dayOffset * 86400000).toISOString()
            : null,
          duration_minutes: s.duration_minutes,
          created_by: me.userId,
          cloned_from: s.id,
        })
        .select('id')
        .single();

      if (created) {
        sessionIdMap.set(s.id, created.id);
        // Copy materials
        const { data: mats } = await supabase.from('session_materials').select('*').eq('session_id', s.id);
        if (mats?.length) {
          await supabase.from('session_materials').insert(
            mats.map((m: any) => ({ session_id: created.id, title: m.title, url: m.url, material_type: m.material_type }))
          );
        }
      }
    }
  }

  // ── Sync assignments ───────────────────────────────────────────
  if (selAssignments.length) {
    const { data: srcAssignments } = await supabase.from('assignments').select('*').in('id', selAssignments);
    if (srcAssignments?.length) {
      await supabase.from('assignments').insert(
        srcAssignments.map((a: any) => ({
          internship_id: cloneId,
          level_id: a.level_id ? levelMap.get(a.level_id) ?? null : null,
          title: a.title, description: a.description, kind: a.kind,
          max_score: a.max_score, weight: a.weight,
          allow_github: a.allow_github, allow_file_upload: a.allow_file_upload,
          attachment_url: a.attachment_url,
          due_at: a.due_at
            ? new Date(new Date(a.due_at).getTime() + dayOffset * 86400000).toISOString()
            : null,
          created_by: me.userId,
          cloned_from: a.id,
        }))
      );
    }
  }

  // ── Sync quizzes ───────────────────────────────────────────────
  if (selQuizzes.length) {
    const { data: srcQuizzes } = await supabase
      .from('quizzes').select('*, quiz_questions(*)').in('id', selQuizzes);
    for (const q of srcQuizzes ?? []) {
      const newSid = sessionIdMap.get(q.session_id);
      if (!newSid) continue;
      const { data: newQuiz } = await supabase.from('quizzes').insert({
        session_id: newSid, title: q.title, status: 'draft', mode: q.mode ?? 'live',
        starts_at: q.starts_at ? new Date(new Date(q.starts_at).getTime() + dayOffset * 86400000).toISOString() : null,
        ends_at:   q.ends_at   ? new Date(new Date(q.ends_at  ).getTime() + dayOffset * 86400000).toISOString() : null,
        created_by: me.userId, cloned_from: q.id,
      }).select('id').single();
      if (newQuiz && q.quiz_questions?.length) {
        await supabase.from('quiz_questions').insert(
          q.quiz_questions.map((qq: any) => ({
            quiz_id: newQuiz.id, question_text: qq.question_text,
            option_a: qq.option_a, option_b: qq.option_b,
            option_c: qq.option_c, option_d: qq.option_d,
            correct_option: qq.correct_option, explanation: qq.explanation,
          }))
        );
      }
    }
  }

  await logAudit({
    actor_id: me.userId, actor_role: 'admin', action: 'internship.sync',
    entity_type: 'internship', entity_id: cloneId,
    details: { source: sourceId, sessions: selSessions.length, assignments: selAssignments.length, quizzes: selQuizzes.length },
  });

  revalidatePath(`/admin/internships/${cloneId}`);
  redirect(`/admin/internships/${cloneId}?synced=1`);
}

// ── Page ──────────────────────────────────────────────────────────
export default async function SyncPage({ params }: { params: { id: string } }) {
  await requireRole('admin');
  const supabase = createAdminClient();

  // Load the clone internship
  const { data: clone } = await supabase
    .from('internships')
    .select('id, title, start_date, template_id')
    .eq('id', params.id)
    .single();

  if (!clone?.template_id) notFound();

  // Load the source internship
  const { data: source } = await supabase
    .from('internships')
    .select('id, title, start_date')
    .eq('id', clone.template_id)
    .single();

  if (!source) notFound();

  // Find already-synced IDs in the clone
  const [{ data: cloneSessions }, { data: cloneAssignments }, { data: cloneQuizzes }] =
    await Promise.all([
      supabase.from('sessions')   .select('cloned_from').eq('internship_id', clone.id).not('cloned_from', 'is', null),
      supabase.from('assignments').select('cloned_from').eq('internship_id', clone.id).not('cloned_from', 'is', null),
      supabase.from('quizzes')    .select('cloned_from').in(
        'session_id',
        (await supabase.from('sessions').select('id').eq('internship_id', clone.id)).data?.map((s: any) => s.id) ?? []
      ).not('cloned_from', 'is', null),
    ]);

  const syncedSessionIds    = new Set((cloneSessions    ?? []).map((s: any) => s.cloned_from));
  const syncedAssignmentIds = new Set((cloneAssignments ?? []).map((a: any) => a.cloned_from));
  const syncedQuizIds       = new Set((cloneQuizzes     ?? []).map((q: any) => q.cloned_from));

  // Load ALL source content
  const sessionIds = [] as string[];
  const [{ data: srcSessions }, { data: srcAssignments }] = await Promise.all([
    supabase.from('sessions')   .select('id,title,session_type,scheduled_at,recording_url,duration_minutes').eq('internship_id', source.id).order('scheduled_at'),
    supabase.from('assignments').select('id,title,kind,due_at,max_score,weight').eq('internship_id', source.id).order('due_at', { ascending: true, nullsFirst: false }),
  ]);
  (srcSessions ?? []).forEach((s: any) => sessionIds.push(s.id));

  let srcQuizzes: any[] = [];
  if (sessionIds.length) {
    const { data: qz } = await supabase.from('quizzes').select('id,title,session_id,quiz_questions(id)').in('session_id', sessionIds);
    srcQuizzes = qz ?? [];
  }

  // Filter to NEW only (not yet synced)
  const newSessions    = (srcSessions    ?? []).filter((s: any) => !syncedSessionIds.has(s.id));
  const newAssignments = (srcAssignments ?? []).filter((a: any) => !syncedAssignmentIds.has(a.id));
  const newQuizzes     = srcQuizzes.filter((q: any) =>
    !syncedQuizIds.has(q.id) && newSessions.some((s: any) => s.id === q.session_id)
  );

  const hasNew = newSessions.length + newAssignments.length + newQuizzes.length > 0;
  const srcStart  = source.start_date;
  const cloneStart = clone.start_date;

  function dayNum(date: string | null): number {
    if (!date || !srcStart) return 0;
    return Math.max(1, Math.round((new Date(date).getTime() - new Date(srcStart).getTime()) / 86400000) + 1);
  }
  function fmt(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/admin/internships/${params.id}`} className="btn btn-ghost" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={16}/>
        </Link>
        <div className="flex-1">
          <p className="eyebrow mb-0.5">Sync from source</p>
          <h1 className="font-display font-bold text-2xl">{clone.title}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ink-500)' }}>
            Pulling new content from <strong>{source.title}</strong>
          </p>
        </div>
      </div>

      {!hasNew ? (
        <div className="card text-center py-12">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--green-soft)' }}>
            <Check size={24} style={{ color: 'var(--green-700)' }}/>
          </div>
          <p className="font-bold text-lg" style={{ color: 'var(--green-700)' }}>All synced!</p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink-500)' }}>
            No new sessions, assignments, or quizzes in <strong>{source.title}</strong>.
          </p>
          <Link href={`/admin/internships/${params.id}`} className="btn btn-secondary mt-4 inline-flex">
            Back to internship
          </Link>
        </div>
      ) : (
        <form action={syncItems}>
          <input type="hidden" name="clone_id"  value={clone.id}/>
          <input type="hidden" name="source_id" value={source.id}/>
          <input type="hidden" name="new_start" value={cloneStart ?? ''}/>
          <input type="hidden" name="src_start" value={srcStart ?? ''}/>

          {/* Date shift info */}
          {srcStart && cloneStart && (
            <div className="card mb-5" style={{ background: 'var(--amber-soft)', borderColor: 'rgba(245,158,11,.25)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--amber-700)' }}>
                📅 Dates will shift {(() => {
                  const d = Math.round((new Date(cloneStart).getTime() - new Date(srcStart).getTime()) / 86400000);
                  return d === 0 ? '0 days (same start date)' : `${d > 0 ? '+' : ''}${d} days`;
                })()} — source starts {fmt(srcStart)}, this internship starts {fmt(cloneStart)}
              </p>
            </div>
          )}

          {/* New sessions */}
          {newSessions.length > 0 && (
            <div className="card mb-4 p-0 overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2"
                style={{ background: 'linear-gradient(90deg,rgba(99,102,241,.08),transparent)', borderBottom: '1px solid var(--ink-100)' }}>
                <Video size={15} style={{ color: 'var(--accent)' }}/>
                <p className="font-bold text-sm">New sessions ({newSessions.length})</p>
                <span className="ml-auto text-xs pill pill-accent">not in this cohort yet</span>
              </div>
              <div className="divide-y">
                {newSessions.map((s: any) => (
                  <label key={s.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" name="session_ids" value={s.id} defaultChecked
                      style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{s.title}</p>
                        <span className="pill" style={{ fontSize: '.65rem' }}>{s.session_type.replace('_',' ')}</span>
                        {s.recording_url && <span className="pill pill-green" style={{ fontSize: '.6rem' }}>🎬 Recording</span>}
                        {dayNum(s.scheduled_at) > 0 && (
                          <span className="text-xs" style={{ color: 'var(--ink-500)' }}>Day {dayNum(s.scheduled_at)}</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* New quizzes */}
          {newQuizzes.length > 0 && (
            <div className="card mb-4 p-0 overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2"
                style={{ background: 'linear-gradient(90deg,rgba(245,158,11,.08),transparent)', borderBottom: '1px solid var(--ink-100)' }}>
                <HelpCircle size={15} style={{ color: '#f59e0b' }}/>
                <p className="font-bold text-sm">New quizzes ({newQuizzes.length})</p>
                <span className="ml-auto text-xs pill pill-amber">requires session above</span>
              </div>
              <div className="divide-y">
                {newQuizzes.map((q: any) => {
                  const sess = newSessions.find((s: any) => s.id === q.session_id);
                  return (
                    <label key={q.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50">
                      <input type="checkbox" name="quiz_ids" value={q.id} defaultChecked
                        style={{ width: 16, height: 16, accentColor: '#f59e0b' }}/>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{q.title}</p>
                        <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                          {q.quiz_questions?.length ?? 0} questions · in session "{sess?.title}"
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* New assignments */}
          {newAssignments.length > 0 && (
            <div className="card mb-4 p-0 overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2"
                style={{ background: 'linear-gradient(90deg,rgba(16,185,129,.08),transparent)', borderBottom: '1px solid var(--ink-100)' }}>
                <BookOpen size={15} style={{ color: '#10b981' }}/>
                <p className="font-bold text-sm">New assignments ({newAssignments.length})</p>
              </div>
              <div className="divide-y">
                {newAssignments.map((a: any) => (
                  <label key={a.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" name="assignment_ids" value={a.id} defaultChecked
                      style={{ width: 16, height: 16, accentColor: '#10b981' }}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{a.title}</p>
                        <span className="pill pill-green" style={{ fontSize: '.65rem' }}>{a.kind}</span>
                        <span className="text-xs" style={{ color: 'var(--ink-500)' }}>{a.max_score} pts</span>
                        {a.due_at && (
                          <span className="text-xs" style={{ color: 'var(--ink-400)' }}>due {fmt(a.due_at)} (src)</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button type="submit" className="btn btn-primary">
              <RefreshCw size={14}/> Sync selected into this cohort
            </button>
            <Link href={`/admin/internships/${params.id}`} className="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </>
  );
}
