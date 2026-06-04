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
  const id = String(formData.get('enrollment_id'));
  const action = String(formData.get('action'));
  const internship_id = String(formData.get('internship_id'));

  if (action === 'promote') {
    const { data: enr } = await supabase
      .from('enrollments')
      .select('current_level, internship_id')
      .eq('id', id)
      .single();
    if (enr) {
      const { error: updErr } = await supabase
        .from('enrollments')
        .update({
          current_level: enr.current_level + 1,
          status: 'active',
          promoted_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (updErr) {
        console.error('Promote failed:', updErr);
        throw new Error('Promote failed: ' + updErr.message);
      }
    }
  } else if (action === 'filter') {
    const { error: updErr } = await supabase
      .from('enrollments')
      .update({ status: 'filtered', filtered_at: new Date().toISOString() })
      .eq('id', id);
    if (updErr) {
      console.error('Filter failed:', updErr);
      throw new Error('Filter failed: ' + updErr.message);
    }
  } else if (action === 'unfilter') {
    // Restore a filtered student back to active
    await supabase
      .from('enrollments')
      .update({ status: 'active', filtered_at: null })
      .eq('id', id);
  }
  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: `enrollment_${action}`,
    entity_type: 'enrollment',
    entity_id: id,
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
    { data: leaderboard },
    { data: students },
    { data: mentors },
  ] = await Promise.all([
    supabase
      .from('levels')
      .select('*')
      .eq('internship_id', params.id)
      .order('level_number'),
    supabase
      .from('enrollments')
      .select('id, student_id, current_level, status, total_score, profiles:student_id (full_name, email)')
      .eq('internship_id', params.id)
      .order('total_score', { ascending: false }),
    supabase
      .from('mentor_assignments')
      .select('id, mentor_id, profiles:mentor_id (full_name, email)')
      .eq('internship_id', params.id),
    supabase
      .from('v_internship_leaderboard')
      .select('*')
      .eq('internship_id', params.id)
      .order('avg_score', { ascending: false })
      .limit(10),
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
          </div>
          {enrollments?.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Current level</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e: any, idx: number) => (
                  <tr key={e.id}>
                    <td className="font-mono">{idx + 1}</td>
                    <td>
                      <p className="font-medium">{e.profiles?.full_name}</p>
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                        {e.profiles?.email}
                      </p>
                    </td>
                    <td>
                      <span className="font-mono">L{e.current_level}</span>
                    </td>
                    <td>
                      <Pill
                        tone={
                          e.status === 'active'
                            ? 'green'
                            : e.status === 'filtered'
                              ? 'red'
                              : 'blue'
                        }
                      >
                        {e.status}
                      </Pill>
                    </td>
                    <td className="font-mono">{e.total_score}</td>
                    <td>
                      <div className="flex gap-1">
                        {e.current_level < internship.total_levels && (
                          <form action={promoteOrFilter}>
                            <input type="hidden" name="enrollment_id" value={e.id} />
                            <input type="hidden" name="internship_id" value={internship.id} />
                            <input type="hidden" name="action" value="promote" />
                            <button type="submit" className="btn btn-ghost text-xs">
                              Promote ↑
                            </button>
                          </form>
                        )}
                        {e.status !== 'filtered' && (
                          <form action={promoteOrFilter}>
                            <input type="hidden" name="enrollment_id" value={e.id} />
                            <input type="hidden" name="internship_id" value={internship.id} />
                            <input type="hidden" name="action" value="filter" />
                            <button type="submit" className="btn btn-ghost text-xs">
                              Filter
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* Leaderboard */}
      <section className="mt-10">
        <div className="card">
          <div className="card-header">
            <h2 className="font-display text-xl font-semibold">
              Top 10 by average score
            </h2>
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              Use this view between milestones to decide promotions / filters.
            </p>
          </div>
          {leaderboard?.length ? (
            <ol className="space-y-2 text-sm font-mono">
              {leaderboard.map((row: any, i: number) => (
                <li key={row.student_id} className="flex items-center justify-between">
                  <span>
                    <span style={{ color: 'var(--ink-500)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="ml-3 font-sans">{row.full_name}</span>
                  </span>
                  <span>
                    L{row.current_level} · avg {row.avg_score} · {row.attended_sessions} sessions
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
              No graded submissions yet.
            </p>
          )}
        </div>
      </section>

      <div className="mt-10 flex gap-3">
        <Link href="/admin/internships" className="btn btn-secondary">
          ← All internships
        </Link>
        <Link
          href={`/admin/sessions?internship=${internship.id}`}
          className="btn btn-secondary"
        >
          Sessions for this internship
        </Link>
        <Link
          href={`/admin/assignments?internship=${internship.id}`}
          className="btn btn-secondary"
        >
          Assignments
        </Link>
      </div>
    </>
  );
}
