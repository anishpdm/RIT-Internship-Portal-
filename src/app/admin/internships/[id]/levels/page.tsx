import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { ArrowLeft, Layers, ArrowUpCircle, XCircle, ChevronsUp, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

/* ── Promote individual student ─────────────────────────── */
async function promoteOrFilter(formData: FormData) {
  'use server';
  await requireRole(['admin', 'mentor']);
  const supabase = createClient();
  const enrollmentId = String(formData.get('enrollment_id'));
  const action       = String(formData.get('action'));
  const returnUrl    = String(formData.get('return_url'));

  if (action === 'promote') {
    const { data: enr } = await supabase
      .from('enrollments').select('current_level').eq('id', enrollmentId).single();
    if (enr) {
      await supabase.from('enrollments')
        .update({ current_level: enr.current_level + 1, status: 'active' })
        .eq('id', enrollmentId);
    }
  } else if (action === 'demote') {
    const { data: enr } = await supabase
      .from('enrollments').select('current_level').eq('id', enrollmentId).single();
    if (enr && enr.current_level > 1) {
      await supabase.from('enrollments')
        .update({ current_level: enr.current_level - 1, status: 'active' })
        .eq('id', enrollmentId);
    }
  } else if (action === 'filter') {
    await supabase.from('enrollments')
      .update({ status: 'filtered' }).eq('id', enrollmentId);
  } else if (action === 'restore') {
    await supabase.from('enrollments')
      .update({ status: 'active' }).eq('id', enrollmentId);
  }
  revalidatePath(returnUrl);
  redirect(returnUrl);
}

/* ── Bulk promote eligible at a level ───────────────────── */
async function bulkPromote(formData: FormData) {
  'use server';
  await requireRole(['admin', 'mentor']);
  const supabase = createAdminClient();
  const levelNumber    = Number(formData.get('level_number'));
  const returnUrl      = String(formData.get('return_url'));
  const enrollmentIds  = String(formData.get('enrollment_ids')).split(',').filter(Boolean);
  if (!enrollmentIds.length) { redirect(returnUrl); return; }
  await supabase.from('enrollments')
    .update({ current_level: levelNumber + 1, status: 'active' })
    .in('id', enrollmentIds);
  revalidatePath(returnUrl);
  redirect(returnUrl);
}

/* ── Page ────────────────────────────────────────────────── */
export default async function LevelStandingsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { level?: string };
}) {
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const { data: internship } = await supabase
    .from('internships').select('id, title, total_levels').eq('id', params.id).single();
  if (!internship) notFound();

  if (me.profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments').select('id')
      .eq('mentor_id', me.userId).eq('internship_id', params.id).maybeSingle();
    if (!ma) notFound();
  }

  // Parallel: levels + enrollments + level scores from view
  const [levelsRes, enrollmentsRes, levelScoresRes] = await Promise.all([
    supabase.from('levels')
      .select('id, level_number, title, pass_threshold')
      .eq('internship_id', params.id).order('level_number'),
    supabase.from('enrollments')
      .select('id, student_id, current_level, status, profiles:student_id (full_name, email)')
      .eq('internship_id', params.id),
    supabase.from('v_student_level_scores')
      .select('student_id, level_id, level_number, level_score, pass_threshold, graded_count, total_count, reached')
      .eq('internship_id', params.id),
  ]);

  const levels      = levelsRes.data ?? [];
  const enrollments = enrollmentsRes.data ?? [];

  // Build: student_id → level_number → score data (from view — same formula as leaderboard)
  const levelScoreMap = new Map<string, Map<number, any>>();
  for (const ls of levelScoresRes.data ?? []) {
    if (!levelScoreMap.has(ls.student_id)) levelScoreMap.set(ls.student_id, new Map());
    levelScoreMap.get(ls.student_id)!.set(ls.level_number, ls);
  }

  const selectedLevel = searchParams.level ? parseInt(searchParams.level, 10) : null;
  const isAdmin = me.profile.role === 'admin';
  const backHref = isAdmin
    ? `/admin/internships/${params.id}`
    : `/mentor/performance/${params.id}`;

  function getScore(studentId: string, levelNum: number) {
    return levelScoreMap.get(studentId)?.get(levelNum);
  }
  function ini(name: string | null | undefined, email: string) {
    return (name ?? email ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }
  const COLORS = ['#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6','#F97316','#6366F1'];

  return (
    <>
      <PageHeader
        eyebrow={`${isAdmin ? 'Admin' : 'Mentor'} · ${internship.title}`}
        title="Level standings"
        subtitle="Scores from the same formula as the leaderboard — due-date aware, weighted average of level assignments."
        actions={
          <Link href={backHref} className="btn btn-ghost"><ArrowLeft size={16}/> Back</Link>
        }
      />

      {/* Level tabs */}
      <div className="flex flex-wrap gap-2 mb-7">
        <Link href="?" className={`pill ${!selectedLevel ? 'pill-accent' : ''}`}>
          All levels
        </Link>
        {Array.from({ length: internship.total_levels }, (_, i) => i + 1).map(ln => {
          const lv = levels.find(l => l.level_number === ln);
          const count = enrollments.filter(e => e.current_level === ln).length;
          return (
            <Link key={ln} href={`?level=${ln}`}
              className={`pill ${selectedLevel === ln ? 'pill-accent' : ''}`}>
              <Layers size={10} className="inline mr-1"/>
              L{ln}{lv?.title ? ` · ${lv.title}` : ''}{' '}
              <span className="ml-1 opacity-70">({count})</span>
            </Link>
          );
        })}
      </div>

      {/* Level sections */}
      {Array.from({ length: internship.total_levels }, (_, i) => i + 1)
        .filter(ln => !selectedLevel || ln === selectedLevel)
        .map(ln => {
          const level = levels.find(l => l.level_number === ln);
          const threshold = level?.pass_threshold ?? 60;
          const returnUrl = `/admin/internships/${params.id}/levels${selectedLevel ? `?level=${selectedLevel}` : ''}`;

          // Split students into groups
          const atLevel     = enrollments.filter(e => e.current_level === ln && e.status !== 'filtered');
          const pastLevel   = enrollments.filter(e => e.current_level > ln);
          const notYet      = enrollments.filter(e => e.current_level < ln);
          const filtered    = enrollments.filter(e => e.status === 'filtered' && e.current_level === ln);

          // Sort atLevel by their score at THIS level desc
          const atLevelSorted = [...atLevel].sort((a, b) => {
            const sa = getScore(a.student_id, ln)?.level_score ?? 0;
            const sb = getScore(b.student_id, ln)?.level_score ?? 0;
            return sb - sa;
          });

          const eligible = atLevelSorted.filter(e => {
            const s = getScore(e.student_id, ln);
            return (s?.level_score ?? 0) >= threshold;
          });
          const avgScore = atLevel.length
            ? atLevel.reduce((sum, e) => sum + (getScore(e.student_id, ln)?.level_score ?? 0), 0) / atLevel.length
            : 0;

          return (
            <section key={ln} className="mb-8">
              {/* Level header */}
              <div className="rounded-2xl p-5 mb-4 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg,#0a0f1e,#1e1b4b)', boxShadow: 'var(--s-md)' }}>
                <div className="absolute inset-0 pointer-events-none opacity-[.04]"
                  style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,1) 1px,transparent 1px)', backgroundSize: '18px 18px' }}/>
                <div className="relative flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-xl"
                      style={{ background: 'linear-gradient(135deg,var(--accent),#818cf8)', boxShadow: '0 4px 16px rgba(99,102,241,.35)' }}>
                      {ln}
                    </div>
                    <div>
                      <p className="font-bold text-white text-xl">
                        Level {ln}{level?.title ? ` — ${level.title}` : ''}
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,.45)' }}>
                        Pass threshold: <strong className="text-white">{threshold}%</strong>
                        {' · '}{atLevel.length} student{atLevel.length !== 1 ? 's' : ''} here
                        {' · '}avg score: <strong className="text-white">{avgScore.toFixed(1)}%</strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pastLevel.length > 0 && <span className="pill pill-green">✓ {pastLevel.length} past</span>}
                    {atLevel.length > 0 && <span className="pill pill-accent">● {atLevel.length} here</span>}
                    {notYet.length > 0 && <span className="pill">🔒 {notYet.length} not yet</span>}
                    {eligible.length > 0 && ln < internship.total_levels && (
                      <span className="pill pill-amber">⚡ {eligible.length} eligible</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bulk promote banner */}
              {eligible.length > 0 && ln < internship.total_levels && (
                <div className="rounded-xl p-4 mb-4 flex items-center gap-4 flex-wrap"
                  style={{ background: 'linear-gradient(90deg,rgba(16,185,129,.1),rgba(16,185,129,.04))', border: '1.5px solid rgba(16,185,129,.3)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: 'var(--green-700)' }}>
                      {eligible.length} student{eligible.length !== 1 ? 's' : ''} scored ≥ {threshold}% — eligible to advance to Level {ln + 1}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--ink-500)' }}>
                      {eligible.map(e => (e as any).profiles?.full_name?.split(' ')[0] ?? (e as any).profiles?.email).join(', ')}
                    </p>
                  </div>
                  <form action={bulkPromote}>
                    <input type="hidden" name="level_number" value={ln}/>
                    <input type="hidden" name="return_url" value={returnUrl}/>
                    <input type="hidden" name="enrollment_ids" value={eligible.map(e => e.id).join(',')}/>
                    <button type="submit" className="btn btn-primary" style={{ fontSize: '.8rem' }}>
                      <ChevronsUp size={14}/> Promote all {eligible.length} → Level {ln + 1}
                    </button>
                  </form>
                </div>
              )}

              {/* Student table */}
              {atLevelSorted.length > 0 ? (
                <div className="card p-0 overflow-hidden table-wrap mb-3">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 52 }}>#</th>
                        <th>Student</th>
                        <th style={{ minWidth: 200 }}>Level {ln} score</th>
                        <th>Graded</th>
                        <th>Eligible</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atLevelSorted.map((e, idx) => {
                        const profile: any = (e as any).profiles;
                        const sc = getScore(e.student_id, ln);
                        const pct = sc?.level_score ?? 0;
                        const passed = pct >= threshold;
                        const scoreColor = passed ? '#10b981' : pct >= threshold * 0.8 ? '#f59e0b' : '#ef4444';
                        const isLastLevel = ln >= internship.total_levels;
                        const avatarColor = COLORS[idx % COLORS.length];
                        const initials = ini(profile?.full_name, profile?.email ?? '');
                        return (
                          <tr key={e.student_id}>
                            {/* Rank */}
                            <td style={{ padding: '10px 12px' }}>
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-sm"
                                style={{ background: idx < 3 ? `${scoreColor}18` : 'var(--ink-100)', color: idx < 3 ? scoreColor : 'var(--ink-600)' }}>
                                {idx + 1}
                              </div>
                            </td>
                            {/* Student */}
                            <td>
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                                  style={{ background: avatarColor, boxShadow: `0 2px 8px ${avatarColor}55` }}>
                                  {initials}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm">{profile?.full_name ?? '—'}</p>
                                  <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{profile?.email}</p>
                                </div>
                              </div>
                            </td>
                            {/* Score */}
                            <td style={{ minWidth: 200 }}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold font-mono" style={{ color: scoreColor, minWidth: 44 }}>
                                  {pct.toFixed(1)}%
                                </span>
                                <span className="text-xs" style={{ color: 'var(--ink-400)' }}>/ {threshold}% threshold</span>
                              </div>
                              <div className="relative h-2.5 rounded-full overflow-visible" style={{ background: 'var(--ink-100)' }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: scoreColor }}/>
                                {/* Threshold marker */}
                                <div className="absolute top-0 bottom-0 w-0.5 rounded" style={{ left: `${threshold}%`, background: 'var(--ink-400)', transform: 'translateX(-50%)' }}/>
                              </div>
                            </td>
                            {/* Graded */}
                            <td className="font-mono text-sm">
                              {sc?.graded_count ?? 0}/{sc?.total_count ?? 0}
                            </td>
                            {/* Eligible */}
                            <td>
                              {isLastLevel ? (
                                <span className="pill pill-accent">Final level</span>
                              ) : passed ? (
                                <span className="pill pill-green">✓ Eligible</span>
                              ) : (
                                <span className="pill pill-red">Below threshold</span>
                              )}
                            </td>
                            {/* Actions */}
                            <td>
                              <div className="flex gap-1.5 flex-wrap">
                                {!isLastLevel && (
                                  <form action={promoteOrFilter}>
                                    <input type="hidden" name="enrollment_id" value={e.id}/>
                                    <input type="hidden" name="action" value="promote"/>
                                    <input type="hidden" name="return_url" value={returnUrl}/>
                                    <button type="submit"
                                      className={`btn ${passed ? 'btn-primary' : 'btn-secondary'}`}
                                      style={{ fontSize: '.72rem', padding: '.35rem .65rem' }}>
                                      <ArrowUpCircle size={12}/> → L{ln + 1}
                                    </button>
                                  </form>
                                )}
                                {ln > 1 && (
                                  <form action={promoteOrFilter}>
                                    <input type="hidden" name="enrollment_id" value={e.id}/>
                                    <input type="hidden" name="action" value="demote"/>
                                    <input type="hidden" name="return_url" value={returnUrl}/>
                                    <button type="submit" className="btn btn-ghost"
                                      style={{ fontSize: '.72rem', padding: '.35rem .65rem' }}
                                      title="Move back to previous level">
                                      ← L{ln - 1}
                                    </button>
                                  </form>
                                )}
                                <form action={promoteOrFilter}>
                                  <input type="hidden" name="enrollment_id" value={e.id}/>
                                  <input type="hidden" name="action" value="filter"/>
                                  <input type="hidden" name="return_url" value={returnUrl}/>
                                  <button type="submit" className="btn btn-danger"
                                    style={{ fontSize: '.72rem', padding: '.35rem .55rem' }}
                                    title="Remove from cohort">
                                    <XCircle size={12}/>
                                  </button>
                                </form>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title={`No students at Level ${ln}`}
                  hint={pastLevel.length > 0 ? `${pastLevel.length} student${pastLevel.length !== 1 ? 's' : ''} already advanced past this level.` : 'Students will appear here once they reach this level.'}
                />
              )}

              {/* Past this level */}
              {pastLevel.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: 'var(--green-700)' }}>✓ Past Level {ln}:</span>
                  {pastLevel.map(e => {
                    const profile: any = (e as any).profiles;
                    const sc = getScore(e.student_id, ln);
                    return (
                      <span key={e.student_id} className="pill pill-green" style={{ fontSize: '.68rem' }}>
                        {profile?.full_name?.split(' ')[0] ?? profile?.email}
                        {sc && <span className="ml-1 opacity-70">{sc.level_score.toFixed(0)}%</span>}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Filtered */}
              {filtered.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--red-700)' }}>Removed:</span>
                  {filtered.map(e => {
                    const profile: any = (e as any).profiles;
                    return (
                      <div key={e.student_id} className="flex items-center gap-1">
                        <span className="pill pill-red" style={{ fontSize: '.68rem' }}>
                          {profile?.full_name?.split(' ')[0] ?? profile?.email}
                        </span>
                        <form action={promoteOrFilter} style={{ display: 'inline' }}>
                          <input type="hidden" name="enrollment_id" value={e.id}/>
                          <input type="hidden" name="action" value="restore"/>
                          <input type="hidden" name="return_url" value={returnUrl}/>
                          <button type="submit" className="text-xs" style={{ color: 'var(--accent)' }}>Restore</button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

      <div className="card text-xs" style={{ background: 'var(--accent-soft)', color: 'var(--ink-700)' }}>
        <strong>Score formula:</strong> Weighted average of assignments tagged to each level. Only past-due assignments count (due_at ≤ today or no due date). Unsubmitted and ungraded = 0. Same formula as the main leaderboard — scores are always consistent.
      </div>
    </>
  );
}
