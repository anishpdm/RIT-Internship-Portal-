import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, Stat } from '@/components/ui';
import { logAudit } from '@/lib/audit';
import { formatDate } from '@/lib/utils';
import { TrendingUp, Pencil, Upload, Trash2, Layers, Star, RefreshCw, Check, Settings2 } from 'lucide-react';
import ConfirmDeleteButton from '@/components/ConfirmDeleteButton';

export const dynamic = 'force-dynamic';

async function updateInternshipStatus(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const supabase = createClient();
  const id = String(formData.get('id'));
  const status = String(formData.get('status'));
  await supabase.from('internships').update({ status }).eq('id', id);
  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: 'update_internship_status',
    entity_type: 'internship',
    entity_id: id,
    details: { status },
  });
  revalidatePath(`/admin/internships/${id}`);
  redirect(`/admin/internships/${id}`);
}

async function toggleFeedbackVisibility(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const supabase = createClient();
  const id = String(formData.get('id'));
  const current = formData.get('current') === 'true';
  const next = !current;
  await supabase
    .from('internships')
    .update({ feedback_visible_to_mentors: next })
    .eq('id', id);
  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: 'feedback.visibility_toggle',
    entity_type: 'internship',
    entity_id: id,
    details: { visible_to_mentors: next },
  });
  revalidatePath(`/admin/internships/${id}`);
  redirect(`/admin/internships/${id}`);
}

async function deleteInternship(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const supabase = createClient();
  const id = String(formData.get('id'));
  await supabase.from('internships').delete().eq('id', id);
  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: 'delete_internship',
    entity_type: 'internship',
    entity_id: id,
  });
  redirect('/admin/internships');
}

async function enrollStudent(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const supabase = createClient();
  const internship_id = String(formData.get('internship_id'));
  const student_id = String(formData.get('student_id'));
  const { error } = await supabase.from('enrollments').insert({
    internship_id,
    student_id,
    enrolled_by: me.userId,
  });
  if (!error) {
    await logAudit({
      actor_id: me.userId,
      actor_role: 'admin',
      action: 'enroll_student',
      entity_type: 'enrollment',
      details: { internship_id, student_id },
    });
  }
  redirect(`/admin/internships/${internship_id}`);
}

async function promoteOrFilter(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const supabase = createClient();
  const studentId    = String(formData.get('enrollment_id')); // now student_id
  const action       = String(formData.get('action'));
  const internship_id = String(formData.get('internship_id'));

  // Look up the actual enrollment by student + internship
  const { data: enr } = await supabase
    .from('enrollments')
    .select('id, current_level, internship_id')
    .eq('student_id', studentId)
    .eq('internship_id', internship_id)
    .single();

  if (!enr) redirect(`/admin/internships/${internship_id}`);

  if (action === 'promote') {
    await supabase.from('enrollments')
      .update({ current_level: enr.current_level + 1, status: 'active' })
      .eq('id', enr.id);
  } else if (action === 'demote') {
    if (enr.current_level > 1) {
      await supabase.from('enrollments')
        .update({ current_level: enr.current_level - 1, status: 'active' })
        .eq('id', enr.id);
    }
  } else if (action === 'filter') {
    await supabase.from('enrollments')
      .update({ status: 'filtered' })
      .eq('id', enr.id);
  } else if (action === 'unfilter') {
    await supabase.from('enrollments')
      .update({ status: 'active' })
      .eq('id', enr.id);
  }

  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: `enrollment_${action}`,
    entity_type: 'enrollment',
    entity_id: enr.id,
  });
  revalidatePath(`/admin/internships/${internship_id}`);
  revalidatePath(`/admin/internships/${internship_id}/levels`);
  revalidatePath(`/admin/internships/${internship_id}/performance`);
  redirect(`/admin/internships/${internship_id}`);
}

async function assignMentor(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const supabase = createClient();
  const internship_id = String(formData.get('internship_id'));
  const mentor_id = String(formData.get('mentor_id'));
  await supabase
    .from('mentor_assignments')
    .insert({ internship_id, mentor_id, assigned_by: me.userId });
  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: 'assign_mentor',
    entity_type: 'mentor_assignment',
    details: { internship_id, mentor_id },
  });
  revalidatePath(`/admin/internships/${internship_id}`);
  redirect(`/admin/internships/${internship_id}`);
}

export default async function InternshipDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: internship } = await supabase
    .from('internships')
    .select('*')
    .eq('id', params.id)
    .single();
  if (!internship) notFound();

  const [
    { data: levels },
    { data: enrollments },
    { data: mentorAssignments },
    { data: quizAgg },
    { data: students },
    { data: mentors },
  ] = await Promise.all([
    supabase
      .from('levels')
      .select('*')
      .eq('internship_id', params.id)
      .order('level_number'),
    // Use leaderboard view for consistent scores (same formula everywhere)
    supabase
      .from('v_internship_leaderboard')
      .select('student_id, full_name, email, current_level, status, total_score, graded_submissions, submitted_count, attended_sessions')
      .eq('internship_id', params.id)
      .order('total_score', { ascending: false }),
    supabase
      .from('mentor_assignments')
      .select('id, mentor_id, profiles:mentor_id (full_name, email)')
      .eq('internship_id', params.id),
    // Quiz aggregates for combined score
    supabase
      .from('v_student_quiz_aggregate')
      .select('student_id, quiz_score_pct, total_questions')
      .eq('internship_id', params.id),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'student')
      .order('full_name'),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'mentor')
      .order('full_name'),
  ]);

  // Build combined score: assignment 95% + quiz 5%
  const quizMap = new Map<string, number>();
  for (const q of quizAgg ?? []) {
    quizMap.set((q as any).student_id, Number((q as any).quiz_score_pct ?? 0));
  }

  // Enrich enrollments with combined score, sort by combined desc
  const enrichedEnrollments = (enrollments ?? []).map((e: any) => {
    const asgmt  = Number(e.total_score ?? 0);
    const quiz   = quizMap.get(e.student_id) ?? 0;
    const combined = asgmt * 0.95 + quiz * 0.05;
    return { ...e, combined };
  }).sort((a: any, b: any) => b.combined - a.combined);

  // Check for new source content if this is a cloned internship
  let newContentCount = 0;
  let sourceName = '';
  if (internship.template_id) {
    const [{ data: src }, { data: clonedSessions }, { data: clonedAssignments }] = await Promise.all([
      supabase.from('internships').select('id, title').eq('id', internship.template_id).single(),
      supabase.from('sessions').select('cloned_from').eq('internship_id', params.id).not('cloned_from', 'is', null),
      supabase.from('assignments').select('cloned_from').eq('internship_id', params.id).not('cloned_from', 'is', null),
    ]);
    sourceName = src?.title ?? '';
    const syncedSessions    = new Set((clonedSessions    ?? []).map((s: any) => s.cloned_from));
    const syncedAssignments = new Set((clonedAssignments ?? []).map((a: any) => a.cloned_from));
    const [{ count: srcSessionCount }, { count: srcAssignmentCount }] = await Promise.all([
      supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('internship_id', internship.template_id),
      supabase.from('assignments').select('*', { count: 'exact', head: true }).eq('internship_id', internship.template_id),
    ]);
    const newSess = (srcSessionCount ?? 0) - syncedSessions.size;
    const newAsgn = (srcAssignmentCount ?? 0) - syncedAssignments.size;
    newContentCount = Math.max(0, newSess) + Math.max(0, newAsgn);
  }

  return (
    <>
      {/* Sync banner — only shown on cloned internships with new content */}
      {internship.template_id && newContentCount > 0 && (
        <div className="rounded-2xl p-4 mb-6 flex items-center gap-4 flex-wrap"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.12),rgba(6,182,212,.08))', border: '1.5px solid rgba(99,102,241,.25)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-soft)' }}>
            <RefreshCw size={18} style={{ color: 'var(--accent)' }}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: 'var(--accent)' }}>
              {newContentCount} new item{newContentCount !== 1 ? 's' : ''} available from "{sourceName}"
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              New sessions or assignments were added to the source internship after you cloned it
            </p>
          </div>
          <Link href={`/admin/internships/${params.id}/sync`} className="btn btn-primary shrink-0" style={{ fontSize: '.8rem' }}>
            <RefreshCw size={13}/> Sync now
          </Link>
        </div>
      )}

      {internship.template_id && newContentCount === 0 && (
        <div className="rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2 text-sm"
          style={{ background: 'var(--green-soft)', border: '1px solid rgba(16,185,129,.2)' }}>
          <Check size={14} style={{ color: 'var(--green-700)' }}/>
          <span style={{ color: 'var(--green-700)' }}>
            Synced with <strong>{sourceName}</strong> — no new content
          </span>
          <Link href={`/admin/internships/${params.id}/sync`} className="ml-auto text-xs link">
            Check again →
          </Link>
        </div>
      )}

      <PageHeader
        eyebrow={`Internship · ${internship.status}`}
        title={internship.title}
        subtitle={
          internship.description ??
          'No description set. Edit the internship to add one.'
        }
        actions={
          <>
            <Link
              href={`/admin/internships/${internship.id}/content`}
              className="btn btn-secondary"
            >
              <Settings2 size={14} /> Content control
            </Link>
            <Link
              href={`/admin/internships/${internship.id}/performance`}
              className="btn btn-secondary"
            >
              <TrendingUp size={14} /> Performance
            </Link>
            <Link
              href={`/admin/internships/${internship.id}/feedback`}
              className="btn btn-secondary"
            >
              <Star size={14} /> Feedback
            </Link>
            <Link
              href={`/admin/internships/${internship.id}/levels`}
              className="btn btn-secondary"
            >
              <Layers size={14} /> Levels
            </Link>
            <Link
              href={`/admin/internships/${internship.id}/feedback`}
              className="btn btn-secondary"
            >
              <Star size={14} /> Feedback
            </Link>
            <Link
              href={`/admin/internships/${internship.id}/edit`}
              className="btn btn-secondary"
            >
              <Pencil size={14} /> Edit
            </Link>
            <Link
              href={`/admin/internships/${internship.id}/import`}
              className="btn btn-secondary"
            >
              <Upload size={14} /> Import CSV
            </Link>
            <ConfirmDeleteButton
              action={deleteInternship}
              fields={[{ name: 'id', value: internship.id }]}
              itemName={internship.title}
              itemType="internship"
              warning="All levels, enrolments, sessions, assignments, submissions, attendance, and materials for this internship will be permanently lost."
              buttonLabel=" Delete"
              buttonClass="btn btn-danger"
            />
          </>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Levels" value={internship.total_levels} />
        <Stat label="Enrolled" value={enrollments?.length ?? 0} />
        <Stat label="Mentors" value={mentorAssignments?.length ?? 0} />
        <Stat
          label="Window"
          value={`${formatDate(internship.start_date)} → ${formatDate(internship.end_date)}`}
        />
      </section>

      {/* Levels */}
      <section className="mt-10">
        <div className="card">
          <div className="card-header">
            <h2 className="font-display text-xl font-semibold">Levels</h2>
          </div>
          {levels?.length ? (
            <ol className="space-y-3">
              {levels.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg">
                      <span className="font-mono text-sm mr-3" style={{ color: 'var(--accent)' }}>
                        L{l.level_number}
                      </span>
                      {l.title}
                    </p>
                    {l.description && (
                      <p className="text-sm mt-0.5" style={{ color: 'var(--ink-500)' }}>
                        {l.description}
                      </p>
                    )}
                  </div>
                  <Pill>Pass ≥ {l.pass_threshold}%</Pill>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
              No levels yet.
            </p>
          )}
        </div>
      </section>

      {/* Mentors */}
      <section className="mt-10">
        <div className="card">
          <div className="card-header">
            <h2 className="font-display text-xl font-semibold">Mentors</h2>
          </div>
          <ul className="space-y-2 mb-5">
            {mentorAssignments?.length ? (
              mentorAssignments.map((ma: any) => (
                <li key={ma.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{ma.profiles?.full_name}</p>
                    <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                      {ma.profiles?.email}
                    </p>
                  </div>
                </li>
              ))
            ) : (
              <li className="text-sm" style={{ color: 'var(--ink-500)' }}>
                No mentors assigned yet.
              </li>
            )}
          </ul>
          <form action={assignMentor} className="flex gap-2">
            <input
              type="hidden"
              name="internship_id"
              value={internship.id}
            />
            <select name="mentor_id" required className="field flex-1">
              <option value="">Choose a mentor to assign…</option>
              {mentors?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.email})
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary">
              Assign
            </button>
          </form>
        </div>
      </section>

      {/* Students */}
      <section className="mt-10">
        <div className="card p-0 overflow-hidden table-wrap">
          <div className="card-header px-6 pt-5">
            <h2 className="font-display text-xl font-semibold">
              Students &amp; level standings
            </h2>
            <div className="flex gap-2">
              <Link href={`/admin/internships/${params.id}/levels`} className="btn btn-secondary text-xs">
                <Layers size={13}/> Level view
              </Link>
              <Link href={`/admin/internships/${params.id}/performance`} className="btn btn-secondary text-xs">
                <TrendingUp size={13}/> Full performance
              </Link>
            </div>
          </div>
          {enrichedEnrollments?.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>#</th>
                  <th>Student</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Assignment</th>
                  <th style={{ textAlign: 'right' }}>Combined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {enrichedEnrollments.map((e: any, idx: number) => {
                  const combined  = Number(e.combined ?? 0);
                  const asgmt     = Number(e.total_score ?? 0);
                  const scoreColor = combined >= 90 ? '#10b981' : combined >= 70 ? '#3b82f6' : combined >= 50 ? '#f59e0b' : '#ef4444';
                  const COLORS = ['#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6'];
                  const initials = (e.full_name ?? e.email ?? '?').split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase();
                  return (
                    <tr key={e.student_id}>
                      <td className="font-mono text-sm" style={{ color: 'var(--ink-500)' }}>{idx + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0"
                            style={{ background: COLORS[idx % COLORS.length] }}>
                            {initials}
                          </div>
                          <div>
                            <Link href={`/admin/students/${e.student_id}`} className="link font-medium text-sm">
                              {e.full_name ?? '—'}
                            </Link>
                            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{e.email}</p>
                          </div>
                        </div>
                      </td>
                      <td><span className="font-mono text-sm font-bold">L{e.current_level}</span></td>
                      <td>
                        <Pill tone={e.status === 'active' ? 'green' : e.status === 'filtered' ? 'red' : 'blue'}>
                          {e.status}
                        </Pill>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-sm">{asgmt.toFixed(1)}%</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-bold font-mono" style={{ color: scoreColor }}>{combined.toFixed(2)}%</span>
                      </td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {e.current_level < internship.total_levels && (
                            <form action={promoteOrFilter}>
                              <input type="hidden" name="enrollment_id" value={e.student_id}/>
                              <input type="hidden" name="internship_id" value={internship.id}/>
                              <input type="hidden" name="action" value="promote"/>
                              <button type="submit" className="btn btn-ghost text-xs">↑ L{e.current_level + 1}</button>
                            </form>
                          )}
                          {e.current_level > 1 && (
                            <form action={promoteOrFilter}>
                              <input type="hidden" name="enrollment_id" value={e.student_id}/>
                              <input type="hidden" name="internship_id" value={internship.id}/>
                              <input type="hidden" name="action" value="demote"/>
                              <button type="submit" className="btn btn-ghost text-xs" style={{ color: 'var(--ink-500)' }}
                                title="Undo promotion — move back one level">
                                ↓ L{e.current_level - 1}
                              </button>
                            </form>
                          )}
                          {e.status !== 'filtered' && (
                            <form action={promoteOrFilter}>
                              <input type="hidden" name="enrollment_id" value={e.student_id}/>
                              <input type="hidden" name="internship_id" value={internship.id}/>
                              <input type="hidden" name="action" value="filter"/>
                              <button type="submit" className="btn btn-ghost text-xs" style={{ color: 'var(--red-700)' }}>Filter</button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="px-6 py-5 text-sm" style={{ color: 'var(--ink-500)' }}>
              No students enrolled yet.
            </p>
          )}

          <div className="p-5" style={{ borderTop: '1px solid var(--ink-100)' }}>
            <form action={enrollStudent} className="flex gap-2">
              <input type="hidden" name="internship_id" value={internship.id} />
              <select name="student_id" required className="field flex-1">
                <option value="">Enrol a student…</option>
                {students?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.email})
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary">
                Enrol
              </button>
            </form>
          </div>
        </div>
      </section>

      <div className="mt-6 flex gap-3 flex-wrap">
        <Link href="/admin/internships" className="btn btn-secondary">← All internships</Link>
        <Link href={`/admin/internships/${internship.id}/performance`} className="btn btn-secondary">
          <TrendingUp size={14}/> Full performance table
        </Link>
        <Link href={`/admin/internships/${internship.id}/levels`} className="btn btn-secondary">
          <Layers size={14}/> Level standings
        </Link>
        <Link href={`/admin/sessions?internship=${internship.id}`} className="btn btn-secondary">
          Sessions
        </Link>
        <Link href={`/admin/assignments?internship=${internship.id}`} className="btn btn-secondary">
          Assignments
        </Link>
      </div>
    </>
  );
}
