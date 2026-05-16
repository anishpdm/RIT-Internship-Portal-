import { redirect } from 'next/navigation';
import Link from 'next/link';
import DateTimeField from '@/components/DateTimeField';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function createAssignment(formData: FormData) {
  'use server';
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  const internship_id = String(formData.get('internship_id') ?? '');
  const level_id_raw = String(formData.get('level_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const kind = String(formData.get('kind') ?? 'daily');
  const max_score = parseInt(String(formData.get('max_score') ?? '100'), 10);
  const weight = parseFloat(String(formData.get('weight') ?? '1'));
  const due_at = String(formData.get('due_at') ?? '');
  const allow_github = formData.get('allow_github') === 'on';
  const allow_file_upload = formData.get('allow_file_upload') === 'on';
  const attachment_url = String(formData.get('attachment_url') ?? '').trim();

  if (!internship_id || !title) redirect('/mentor/assignments/new?error=missing');

  if (me.profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments')
      .select('id')
      .eq('mentor_id', me.userId)
      .eq('internship_id', internship_id)
      .maybeSingle();
    if (!ma) redirect('/mentor/assignments?error=forbidden');
  }

  const { data, error } = await supabase
    .from('assignments')
    .insert({
      internship_id,
      level_id: level_id_raw || null,
      title,
      description: description || null,
      kind,
      max_score,
      weight,
      due_at: due_at || null,
      allow_github,
      allow_file_upload,
      attachment_url: attachment_url || null,
      created_by: me.userId,
    })
    .select('id')
    .single();

  if (error || !data) redirect('/mentor/assignments/new?error=db');

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'assignment.create',
    entity_type: 'assignment',
    entity_id: data.id,
    details: { title, kind, internship_id },
  });

  revalidatePath('/mentor/assignments');
  redirect('/mentor/assignments');
}

export default async function MentorNewAssignmentPage() {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  let internshipsQuery = supabase
    .from('internships').select('id, title').neq('status', 'archived').order('created_at', { ascending: false });

  if (me.profile.role === 'mentor') {
    const { data: assignments } = await supabase
      .from('mentor_assignments').select('internship_id').eq('mentor_id', me.userId);
    const ids = assignments?.map((a: any) => a.internship_id) ?? [];
    if (ids.length === 0) {
      return (
        <>
          <PageHeader eyebrow="Mentor / Assignments" title="New assignment" actions={
            <Link href="/mentor/assignments" className="btn btn-ghost"><ArrowLeft size={16} /> Back</Link>
          } />
          <div className="empty">You aren&apos;t assigned to any internships yet.</div>
        </>
      );
    }
    internshipsQuery = internshipsQuery.in('id', ids);
  }

  const { data: internships } = await internshipsQuery;
  const internshipIds = internships?.map((i: any) => i.id) ?? [];
  const { data: levels } = internshipIds.length
    ? await supabase.from('levels').select('id, internship_id, level_number, title').in('internship_id', internshipIds).order('level_number')
    : { data: [] };

  return (
    <>
      <PageHeader
        eyebrow="Mentor / Assignments"
        title="New assignment"
        subtitle="Define a task, its weight, and which submission methods are allowed."
        actions={<Link href="/mentor/assignments" className="btn btn-ghost"><ArrowLeft size={16} /> Back</Link>}
      />

      <form action={createAssignment} className="card max-w-3xl space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Internship</label>
            <select name="internship_id" className="field" required>
              <option value="">— Choose —</option>
              {internships?.map((i: any) => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Level (optional)</label>
            <select name="level_id" className="field">
              <option value="">— Any —</option>
              {levels?.map((l: any) => <option key={l.id} value={l.id}>L{l.level_number} · {l.title}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label">Title</label>
          <input name="title" className="field" required />
        </div>

        <div>
          <label className="field-label">Description</label>
          <textarea name="description" rows={4} className="field" />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label">Kind</label>
            <select name="kind" className="field" defaultValue="daily">
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="assessment">assessment</option>
              <option value="milestone">milestone</option>
            </select>
          </div>
          <div>
            <label className="field-label">Max score</label>
            <input type="number" name="max_score" min={1} defaultValue={100} className="field" />
          </div>
          <div>
            <label className="field-label">Weight</label>
            <input type="number" name="weight" step={0.1} min={0.1} defaultValue={1} className="field" />
          </div>
        </div>

        <div>
          <label className="field-label">Due at</label>
          <DateTimeField name="due_at" />
        </div>

        <div>
          <label className="field-label">Reference attachment URL</label>
          <input name="attachment_url" className="field" placeholder="https://... (brief, dataset)" />
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allow_github" defaultChecked /> Allow GitHub URL submission
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allow_file_upload" defaultChecked /> Allow file upload submission
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/mentor/assignments" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary">Create assignment</button>
        </div>
      </form>
    </>
  );
}
