import { redirect } from 'next/navigation';
import Link from 'next/link';
import DateTimeField from '@/components/DateTimeField';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import AssignmentInternshipSelect from '@/components/AssignmentInternshipSelect';

export const dynamic = 'force-dynamic';

async function createAssignment(formData: FormData) {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const internship_id    = String(formData.get('internship_id')    ?? '');
  const level_id_raw     = String(formData.get('level_id')         ?? '');
  const title            = String(formData.get('title')            ?? '').trim();
  const description      = String(formData.get('description')      ?? '').trim();
  const kind             = String(formData.get('kind')             ?? 'daily');
  const max_score        = parseInt(String(formData.get('max_score')        ?? '100'), 10);
  const weight           = parseFloat(String(formData.get('weight')         ?? '1'));
  const due_at           = String(formData.get('due_at')           ?? '');
  const allow_github     = formData.get('allow_github')      === 'on';
  const allow_file_upload= formData.get('allow_file_upload') === 'on';
  const attachment_url   = String(formData.get('attachment_url')   ?? '').trim();

  if (!internship_id || !title) redirect('/admin/assignments/new?error=missing');

  const { data, error } = await supabase
    .from('assignments')
    .insert({
      internship_id,
      level_id:        level_id_raw || null,
      title,
      description:     description || null,
      kind,
      max_score,
      weight,
      due_at:          due_at || null,
      allow_github,
      allow_file_upload,
      attachment_url:  attachment_url || null,
      created_by:      me.userId,
    })
    .select('id')
    .single();

  if (error || !data) redirect('/admin/assignments/new?error=db');

  await logAudit({
    actor_id:    me.userId,
    actor_role:  me.profile.role,
    action:      'assignment.create',
    entity_type: 'assignment',
    entity_id:   data.id,
    details:     { title, kind, internship_id },
  });

  revalidatePath('/admin/assignments');
  redirect(`/admin/assignments/${data.id}`);
}

export default async function NewAssignmentPage() {
  await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const [{ data: internships }, { data: allLevels }, { data: allSessions }] = await Promise.all([
    supabase.from('internships').select('id, title').neq('status', 'archived').order('created_at', { ascending: false }),
    supabase.from('levels').select('id, internship_id, level_number, title').order('level_number'),
    supabase.from('sessions').select('id, internship_id, title, level_id, scheduled_at, session_type').order('scheduled_at', { ascending: false }),
  ]);

  // Group levels and sessions by internship_id for client-side filtering
  const levelsByInternship: Record<string, any[]> = {};
  for (const l of allLevels ?? []) {
    if (!levelsByInternship[l.internship_id]) levelsByInternship[l.internship_id] = [];
    levelsByInternship[l.internship_id].push(l);
  }

  const sessionsByInternship: Record<string, any[]> = {};
  for (const s of allSessions ?? []) {
    if (!sessionsByInternship[s.internship_id]) sessionsByInternship[s.internship_id] = [];
    sessionsByInternship[s.internship_id].push(s);
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin / Assignments"
        title="New assignment"
        subtitle="Define a task, its weight, and which submission methods are allowed."
        actions={<Link href="/admin/assignments" className="btn btn-ghost"><ArrowLeft size={16}/> Back</Link>}
      />

      <form action={createAssignment} className="card max-w-3xl space-y-5">

        {/* Dynamic internship → session → level selector */}
        <AssignmentInternshipSelect
          internships={internships ?? []}
          levelsByInternship={levelsByInternship}
          sessionsByInternship={sessionsByInternship}
        />

        <div>
          <label className="field-label">Title <span style={{ color: 'var(--red-500)' }}>*</span></label>
          <input name="title" className="field" required placeholder="e.g. Day 3 — EDA on Titanic dataset"/>
        </div>

        <div>
          <label className="field-label">Description</label>
          <textarea name="description" rows={4} className="field" placeholder="Task description, requirements, expected output…"/>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label">Kind</label>
            <select name="kind" className="field" defaultValue="daily">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="assessment">Assessment</option>
              <option value="milestone">Milestone</option>
            </select>
          </div>
          <div>
            <label className="field-label">Max score</label>
            <input type="number" name="max_score" min={1} defaultValue={100} className="field"/>
          </div>
          <div>
            <label className="field-label">Weight</label>
            <input type="number" name="weight" step={0.1} min={0.1} defaultValue={1} className="field"/>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>Affects leaderboard ranking</p>
          </div>
        </div>

        <div>
          <label className="field-label">Due date & time</label>
          <DateTimeField name="due_at"/>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
            Past-due assignments count as 0 if not submitted
          </p>
        </div>

        <div>
          <label className="field-label">Reference attachment URL</label>
          <input name="attachment_url" className="field" placeholder="https://… (problem statement, dataset, brief)"/>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allow_github" defaultChecked/> Allow GitHub URL submission
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allow_file_upload" defaultChecked/> Allow file upload submission
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/admin/assignments" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary">Create assignment</button>
        </div>
      </form>
    </>
  );
}
