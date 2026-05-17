import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, Stat, EmptyState } from '@/components/ui';
import { ArrowLeft, Layers, Trophy, Users } from 'lucide-react';
import PrintButton from '@/components/PrintButton';
import PrintHeader from '@/components/PrintHeader';

export const dynamic = 'force-dynamic';

interface StudentLevelRow {
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
    .select('id, level_number, title')
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

          return (
            <section key={ln} className="mb-10">
              <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
                <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                  <Layers size={18} style={{ color: 'var(--accent)' }} />
                  Level {ln}
                  {level?.title && (
                    <span
                      className="text-base font-normal"
                      style={{ color: 'var(--ink-500)' }}
                    >
                      · {level.title}
                    </span>
                  )}
                </h2>
                <div className="flex gap-2 flex-wrap">
                  <Pill tone="accent">
                    <Users size={10} className="inline" /> {atLevel.length} at this level
                  </Pill>
                  <Pill tone="green">
                    {past.length} past this level
                  </Pill>
                  <Pill>
                    Avg score: {avgAtLevel.toFixed(1)}%
                  </Pill>
                </div>
              </div>

              {atLevel.length > 0 ? (
                <div className="card p-0 overflow-hidden table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Rank</th>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Level {ln} score</th>
                        <th>Graded</th>
                        <th>Promotion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atLevel.map((r, idx) => {
                        const color =
                          r.level_score >= 70
                            ? 'green'
                            : r.level_score >= 40
                              ? 'amber'
                              : 'red';
                        return (
                          <tr key={r.student_id}>
                            <td>
                              {idx === 0 ? (
                                <span style={{ color: '#eab308' }}>
                                  <Trophy size={14} className="inline" /> 1
                                </span>
                              ) : (
                                <span
                                  className="font-mono text-sm"
                                  style={{ color: 'var(--ink-500)' }}
                                >
                                  {idx + 1}
                                </span>
                              )}
                            </td>
                            <td>
                              <p className="font-medium">{r.full_name ?? '—'}</p>
                              <p
                                className="text-xs"
                                style={{ color: 'var(--ink-500)' }}
                              >
                                {r.email}
                              </p>
                            </td>
                            <td>
                              <Pill
                                tone={
                                  r.status === 'active'
                                    ? 'blue'
                                    : r.status === 'promoted'
                                      ? 'green'
                                      : r.status === 'filtered'
                                        ? 'red'
                                        : undefined
                                }
                              >
                                {r.status}
                              </Pill>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold w-14">
                                  {r.level_score.toFixed(1)}%
                                </span>
                                <div
                                  className="h-2 rounded-full overflow-hidden flex-1"
                                  style={{
                                    background: 'var(--ink-100)',
                                    maxWidth: 120,
                                  }}
                                >
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${Math.min(100, r.level_score)}%`,
                                      background:
                                        color === 'green'
                                          ? '#10b981'
                                          : color === 'amber'
                                            ? '#f59e0b'
                                            : '#ef4444',
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="font-mono text-sm">
                              {r.level_graded} / {r.level_total_assignments}
                            </td>
                            <td>
                              {r.level_score >= 60 ? (
                                <Pill tone="green">eligible</Pill>
                              ) : (
                                <Pill tone="red">below threshold</Pill>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No students currently at this level"
                  hint={
                    past.length > 0
                      ? `${past.length} student${past.length === 1 ? '' : 's'} have already moved past this level.`
                      : 'Students will appear here once they reach this level.'
                  }
                />
              )}

              {past.length > 0 && (
                <p
                  className="text-xs mt-3"
                  style={{ color: 'var(--ink-500)' }}
                >
                  Past this level: {past.map((r) => r.full_name ?? r.email).join(', ')}
                </p>
              )}
            </section>
          );
        })}

      <div
        className="card mt-8 text-xs"
        style={{ background: 'var(--accent-soft)', color: 'var(--ink-700)' }}
      >
        <p>
          <strong>How level scores are computed:</strong> assignments tagged with a specific
          level count toward that level only; assignments tagged "any level" count toward every
          level. The score is a weighted average of (student score / max score) × assignment weight.
          A student is "eligible" for promotion when their level score is ≥ 60%.
        </p>
      </div>
    </>
  );
}
