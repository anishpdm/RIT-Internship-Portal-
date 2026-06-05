import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, Stat, EmptyState } from '@/components/ui';
import { ArrowLeft, Layers, Trophy, Users, ChevronsUp, ArrowUpCircle, XCircle } from 'lucide-react';
import PrintButton from '@/components/PrintButton';
import PrintHeader from '@/components/PrintHeader';

export const dynamic = 'force-dynamic';

// ── Single promote / filter ──────────────────────────────────────
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
        .update({ current_level: enr.current_level + 1, status: 'active', promoted_at: new Date().toISOString() })
        .eq('id', enrollmentId);
    }
  } else if (action === 'filter') {
    await supabase.from('enrollments')
      .update({ status: 'filtered', filtered_at: new Date().toISOString() })
      .eq('id', enrollmentId);
  }
  revalidatePath(returnUrl);
  redirect(returnUrl);
}

// ── Bulk promote all eligible at a level ────────────────────────
async function bulkPromote(formData: FormData) {
  'use server';
  await requireRole(['admin', 'mentor']);
  const supabase = createAdminClient();
  const internshipId = String(formData.get('internship_id'));
  const levelNumber  = Number(formData.get('level_number'));
  const returnUrl    = String(formData.get('return_url'));

  // Find enrollment IDs at this level that are eligible (status = active, not filtered)
  const enrollmentIds = String(formData.get('enrollment_ids')).split(',').filter(Boolean);
  if (!enrollmentIds.length) { redirect(returnUrl); return; }

  await supabase.from('enrollments')
    .update({ current_level: levelNumber + 1, status: 'active', promoted_at: new Date().toISOString() })
    .in('id', enrollmentIds);

  revalidatePath(returnUrl);
  redirect(returnUrl + '&promoted=1');
}

interface StudentLevelRow {
  enrollment_id: string;
  student_id: string;
  full_name: string | null;
  email: string;
  current_level: number;
  status: string;
  level_score: number;
  level_graded: number;
  level_total_assignments: number;
}

export default async function LevelWisePerformancePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { level?: string };
}) {
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const { data: internship } = await supabase
    .from('internships')
    .select('id, title, total_levels')
    .eq('id', params.id)
    .single();
  if (!internship) notFound();

  // Mentor scope check
  if (me.profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments')
      .select('id')
      .eq('mentor_id', me.userId)
      .eq('internship_id', params.id)
      .maybeSingle();
    if (!ma) notFound();
  }

  // Get all levels
  const { data: levels } = await supabase
    .from('levels')
    .select('id, level_number, title, pass_threshold')
    .eq('internship_id', params.id)
    .order('level_number');

  // All enrolments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, student_id, current_level, status, profiles:student_id (full_name, email)')
    .eq('internship_id', params.id);

  // All assignments with level_id
  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, level_id, max_score, weight')
    .eq('internship_id', params.id);

  // All graded submissions
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  let submissions: any[] = [];
  if (assignmentIds.length > 0) {
    const { data: subs } = await supabase
      .from('submissions')
      .select('assignment_id, student_id, score, status')
      .in('assignment_id', assignmentIds)
      .eq('status', 'graded');
    submissions = subs ?? [];
  }

  // Build level → assignments map
  const assignmentsByLevel = new Map<number | null, any[]>();
  for (const a of assignments ?? []) {
    const level = (a as any).level_id ? null : null; // placeholder
  }
  // Need to resolve level_id → level_number
  const levelNumByLevelId = new Map<string, number>();
  for (const l of levels ?? []) {
    levelNumByLevelId.set(l.id, l.level_number);
  }
  // Group assignments by level_number (null = whole internship)
  const assignmentsByLevelNum = new Map<number | 'all', any[]>();
  for (const a of assignments ?? []) {
    const ln = a.level_id ? levelNumByLevelId.get(a.level_id) : null;
    const key = ln ?? 'all';
    if (!assignmentsByLevelNum.has(key)) assignmentsByLevelNum.set(key, []);
    assignmentsByLevelNum.get(key)!.push(a);
  }

  // Per-(student, level) compute score:
  // score = weighted avg over: level-specific assignments + "all" assignments
  function computeLevelScore(studentId: string, levelNum: number) {
    const relevantAssignments = [
      ...(assignmentsByLevelNum.get(levelNum) ?? []),
      ...(assignmentsByLevelNum.get('all') ?? []),
    ];
    if (relevantAssignments.length === 0) {
      return { score: 0, graded: 0, total: 0 };
    }
    let totalWeight = 0;
    let weightedSum = 0;
    let gradedCount = 0;
    for (const a of relevantAssignments) {
      const sub = submissions.find(
        (s) => s.assignment_id === a.id && s.student_id === studentId,
      );
      if (sub && sub.score != null && a.max_score > 0) {
        const pct = (sub.score / a.max_score) * 100;
        weightedSum += pct * (a.weight ?? 1);
        totalWeight += a.weight ?? 1;
        gradedCount++;
      }
    }
    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return {
      score,
      graded: gradedCount,
      total: relevantAssignments.length,
    };
  }

  // For each level, build sorted list of students
  const levelRows: Record<number, StudentLevelRow[]> = {};
  for (let ln = 1; ln <= internship.total_levels; ln++) {
    const rows: StudentLevelRow[] = [];
    for (const e of enrollments ?? []) {
      const computed = computeLevelScore(e.student_id, ln);
      const profile: any = (e as any).profiles;
      rows.push({
        enrollment_id: e.id,
        student_id: e.student_id,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? '',
        current_level: e.current_level,
        status: e.status,
        level_score: computed.score,
        level_graded: computed.graded,
        level_total_assignments: computed.total,
      });
    }
    // Sort by score desc
    rows.sort((a, b) => b.level_score - a.level_score);
    levelRows[ln] = rows;
  }

  // Determine which levels to show
  const selectedLevel = searchParams.level
    ? parseInt(searchParams.level, 10)
    : null;

  const isAdmin = me.profile.role === 'admin';
  const baseHref = isAdmin
    ? `/admin/internships/${params.id}`
    : `/mentor/performance/${params.id}`;

  return (
    <>
      <PrintHeader
        title={`${internship.title} — Level-wise Performance`}
        subtitle={`${enrollments?.length ?? 0} enrolled · ${internship.total_levels} level${internship.total_levels === 1 ? '' : 's'}`}
      />

      <PageHeader
        eyebrow={`Levels · ${internship.title}`}
        title="Level-wise performance"
        subtitle="Per-level student scores computed from assignments at each level. Use this to make promotion decisions."
        actions={
          <>
            <PrintButton label="Print" />
            <Link href={baseHref} className="btn btn-ghost">
              <ArrowLeft size={16} /> Back
            </Link>
          </>
        }
      />

      {/* Level selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href={`?`}
          className={`pill ${!selectedLevel ? 'pill-accent' : ''}`}
        >
          All levels
        </Link>
        {Array.from({ length: internship.total_levels }, (_, i) => i + 1).map(
          (ln) => {
            const level = levels?.find((l) => l.level_number === ln);
            return (
              <Link
                key={ln}
                href={`?level=${ln}`}
                className={`pill ${selectedLevel === ln ? 'pill-accent' : ''}`}
              >
                <Layers size={10} className="inline" /> Level {ln}
                {level?.title ? ` · ${level.title}` : ''}
              </Link>
            );
          },
        )}
      </div>

      {Array.from({ length: internship.total_levels }, (_, i) => i + 1)
        .filter((ln) => !selectedLevel || ln === selectedLevel)
        .map((ln) => {
          const rows = levelRows[ln] ?? [];
          const level = levels?.find((l) => l.level_number === ln);
          const atLevel = rows.filter((r) => r.current_level === ln);
          const past = rows.filter((r) => r.current_level > ln);
          const notReached = rows.filter((r) => r.current_level < ln);
          const avgAtLevel =
            atLevel.length > 0
              ? atLevel.reduce((s, r) => s + r.level_score, 0) / atLevel.length
              : 0;

          const eligible = atLevel.filter((r) => r.level_score >= (level?.pass_threshold ?? 60) && r.status !== 'filtered');
          const notEligible = atLevel.filter((r) => r.level_score < (level?.pass_threshold ?? 60) || r.status === 'filtered');
          const returnUrl = `/admin/internships/${params.id}/levels?level=${selectedLevel ?? ''}`;

          return (
            <section key={ln} className="mb-8">
              {/* Level header */}
              <div className="rounded-2xl p-5 mb-4 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg,var(--ink-900),#1e1b4b)', boxShadow: 'var(--s-md)' }}>
                <div className="absolute inset-0 pointer-events-none opacity-[.04]"
                  style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '18px 18px' }}/>
                <div className="relative flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white"
                      style={{ background: 'linear-gradient(135deg,var(--accent),#818cf8)', fontSize: '1.1rem' }}>
                      {ln}
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg">
                        Level {ln}{level?.title ? ` — ${level.title}` : ''}
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,.45)' }}>
                        Pass threshold: {level?.pass_threshold ?? 60}% · {atLevel.length} students · avg {avgAtLevel.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="pill pill-green">{past.length} past</span>
                    <span className="pill pill-accent">{atLevel.length} here</span>
                    {eligible.length > 0 && ln < internship.total_levels && (
                      <span className="pill" style={{ background: 'rgba(245,158,11,.2)', color: '#fde68a', border: '1px solid rgba(245,158,11,.3)' }}>
                        ⚡ {eligible.length} eligible to promote
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {atLevel.length > 0 ? (
                <>
                  {/* Bulk promote banner */}
                  {eligible.length > 0 && ln < internship.total_levels && (
                    <div className="rounded-xl p-4 mb-4 flex items-center gap-4 flex-wrap"
                      style={{ background: 'linear-gradient(90deg,rgba(16,185,129,.1),rgba(16,185,129,.05))', border: '1.5px solid rgba(16,185,129,.3)' }}>
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color: 'var(--green-700)' }}>
                          {eligible.length} student{eligible.length !== 1 ? 's' : ''} scored ≥ {level?.pass_threshold ?? 60}% and can advance to Level {ln + 1}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-500)' }}>
                          {eligible.map(r => r.full_name?.split(' ')[0] ?? r.email).join(', ')}
                        </p>
                      </div>
                      <form action={bulkPromote}>
                        <input type="hidden" name="internship_id" value={params.id}/>
                        <input type="hidden" name="level_number" value={ln}/>
                        <input type="hidden" name="return_url" value={returnUrl}/>
                        <input type="hidden" name="enrollment_ids" value={eligible.map(r => r.enrollment_id).join(',')}/>
                        <button type="submit" className="btn btn-primary" style={{ fontSize: '.8rem' }}>
                          <ChevronsUp size={14}/> Promote all {eligible.length} to Level {ln + 1}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Student cards grid */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {atLevel.map((r) => {
                      const pct = r.level_score;
                      const threshold = level?.pass_threshold ?? 60;
                      const isEligible = pct >= threshold && r.status !== 'filtered';
                      const scoreColor = pct >= threshold ? '#10b981' : pct >= threshold * 0.75 ? '#f59e0b' : '#ef4444';
                      const isLastLevel = ln >= internship.total_levels;
                      const ini = (r.full_name ?? r.email ?? '?').split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase();

                      return (
                        <div key={r.student_id} className="card"
                          style={{ borderLeft: `4px solid ${scoreColor}`, opacity: r.status === 'filtered' ? 0.65 : 1 }}>
                          {/* Student info */}
                          <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0"
                              style={{ background: `linear-gradient(135deg,${scoreColor},${scoreColor}aa)` }}>
                              {ini}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{r.full_name ?? '—'}</p>
                              <p className="text-xs truncate" style={{ color: 'var(--ink-500)' }}>{r.email}</p>
                            </div>
                            <Pill tone={r.status === 'active' ? 'blue' : r.status === 'filtered' ? 'red' : 'green'}>
                              {r.status}
                            </Pill>
                          </div>

                          {/* Score bar */}
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs" style={{ color: 'var(--ink-500)' }}>Level {ln} score</span>
                              <span className="font-mono font-bold text-sm" style={{ color: scoreColor }}>{pct.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ink-100)' }}>
                              <div className="h-full rounded-full relative"
                                style={{ width: `${Math.min(100, pct)}%`, background: scoreColor }}>
                              </div>
                            </div>
                            {/* Threshold marker */}
                            <div className="relative h-1 mt-0.5">
                              <div className="absolute w-0.5 h-3 -top-0.5 rounded"
                                style={{ left: `${threshold}%`, background: 'var(--ink-400)', transform: 'translateX(-50%)' }}/>
                              <span className="absolute text-[9px]"
                                style={{ left: `${threshold}%`, transform: 'translateX(-50%)', color: 'var(--ink-400)', top: 2 }}>
                                {threshold}%
                              </span>
                            </div>
                          </div>

                          <p className="text-xs mb-3" style={{ color: 'var(--ink-500)' }}>
                            {r.level_graded}/{r.level_total_assignments} assignments graded
                            {isEligible && !isLastLevel && (
                              <span className="ml-2 font-semibold" style={{ color: 'var(--green-700)' }}>✓ Eligible</span>
                            )}
                          </p>

                          {/* Action buttons */}
                          {r.status !== 'filtered' && (
                            <div className="flex gap-2">
                              {!isLastLevel && (
                                <form action={promoteOrFilter} className="flex-1">
                                  <input type="hidden" name="enrollment_id" value={r.enrollment_id}/>
                                  <input type="hidden" name="action" value="promote"/>
                                  <input type="hidden" name="return_url" value={returnUrl}/>
                                  <button type="submit"
                                    className={`btn w-full ${isEligible ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ fontSize: '.75rem', padding: '.4rem .6rem' }}>
                                    <ArrowUpCircle size={13}/>
                                    {isEligible ? `→ Level ${ln + 1}` : `Force → L${ln + 1}`}
                                  </button>
                                </form>
                              )}
                              <form action={promoteOrFilter}>
                                <input type="hidden" name="enrollment_id" value={r.enrollment_id}/>
                                <input type="hidden" name="action" value="filter"/>
                                <input type="hidden" name="return_url" value={returnUrl}/>
                                <button type="submit" className="btn btn-danger"
                                  style={{ fontSize: '.75rem', padding: '.4rem .6rem' }}
                                  title="Remove from this cohort">
                                  <XCircle size={13}/>
                                </button>
                              </form>
                            </div>
                          )}
                          {r.status === 'filtered' && (
                            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>Removed from cohort</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <EmptyState
                  title={`No students at Level ${ln}`}
                  hint={past.length > 0 ? `${past.length} student${past.length !== 1 ? 's' : ''} already advanced past this level.` : 'Students will appear here once they enrol and reach this level.'}
                />
              )}

              {past.length > 0 && (
                <p className="text-xs mt-3 text-right" style={{ color: 'var(--ink-400)' }}>
                  Past this level: {past.map(r => r.full_name?.split(' ')[0] ?? r.email).join(', ')}
                </p>
              )}
            </section>
          );
        })}

      <div className="card mt-6 text-xs"
        style={{ background: 'var(--accent-soft)', color: 'var(--ink-700)' }}>
        <p>
          <strong>How promotion works:</strong> Students at Level N can access all content tagged for Levels 1 through N. Content with no level tag is visible to everyone. When you promote a student, they immediately gain access to the next level&apos;s sessions and assignments.
        </p>
      </div>
    </>
  );
}
