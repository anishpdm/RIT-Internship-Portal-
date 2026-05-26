import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import DateTimeField from '@/components/DateTimeField';
import { isoToISTLocalInput } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function updateAssignment(formData: FormData) {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const id = String(formData.get('id') ?? '');
  const level_id_raw = String(formData.get('level_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const kind = String(formData.get('kind') ?? 'daily');
  const max_score = parseInt(String(formData.get('max_score') ?? '100'), 10);
  const weight = parseFloat(String(formData.get('weight') ?? '1'));
  const due_at = String(formData.get('due_at') ?? '').trim();
  const allow_github = formData.get('allow_github') === 'on';
  const allow_file_upload = formData.get('allow_file_upload') === 'on';
  const attachment_url = String(formData.get('attachment_url') ?? '').trim();

  if (!id || !title) redirect(`/mentor/assignments/${id}/edit?error=missing`);

  const { error } = await supabase
    .from('assignments')
    .update({
      level_id: level_id_raw || null,
      title,
      description: description || null,
      kind,
      max_score: isNaN(max_score) ? 100 : max_score,
      weight: isNaN(weight) ? 1 : weight,
      due_at: due_at || null,
      allow_github,
      allow_file_upload,
      attachment_url: attachment_url || null,
    })
    .eq('id', id);

  if (error) redirect(`/mentor/assignments/${id}/edit?error=db`);

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'assignment.update',
    entity_type: 'assignment',
    entity_id: id,
    details: { title, kind },
  });

  revalidatePath(`/mentor/assignments/${id}`);
  revalidatePath('/admin/assignments');
  redirect(`/mentor/assignments/${id}`);
}

export default async function MentorEditAssignmentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const [assignmentRes, levelsRes] = await Promise.all([
    supabase
      .from('assignments')
      .select('*, internships:internship_id (id, title)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('levels')
      .select('id, internship_id, level_number, title')
      .order('level_number'),
  ]);

  if (!assignmentRes.data) notFound();
  const a = assignmentRes.data;
  const levels = (levelsRes.data ?? []).filter(
    (l: any) => l.internship_id === a.internship_id,
  );

  return (
    <>
      <PageHeader
        eyebrow={`Edit · ${(a as any).internships?.title ?? 'Assignment'}`}
        title={a.title}
        subtitle="Update assignment details, due date, scoring, and submission settings."
        actions={
          <Link href={`/mentor/assignments/${params.id}`} className="btn btn-ghost">
            <ArrowLeft size={16} /> Cancel
          </Link>
        }
      />

      {searchParams.error && (
        <div
          className="card mb-4 text-sm"
          style={{ background: 'var(--red-soft)', color: 'var(--red-700)' }}
        >
          {searchParams.error === 'missing'
            ? 'Title is required.'
            : 'Failed to save. Please try again.'}
        </div>
      )}

      <form action={updateAssignment} className="card max-w-3xl space-y-5">
        <input type="hidden" name="id" value={a.id} />

        {/* Internship — read-only (can't move an assignment to a different internship) */}
        <div>
          <label className="field-label">Internship</label>
          <input
            className="field"
            value={(a as any).internships?.title ?? '—'}
            readOnly
            style={{ background: 'var(--ink-100)', cursor: 'default' }}
          />
        </div>

        <div>
          <label className="field-label">Level (optional)</label>
          <select name="level_id" className="field" defaultValue={a.level_id ?? ''}>
            <option value="">— Any level —</option>
            {levels.map((l: any) => (
              <option key={l.id} value={l.id}>
                L{l.level_number} · {l.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Title</label>
          <input
            name="title"
            className="field"
            required
            defaultValue={a.title}
          />
        </div>

        <div>
          <label className="field-label">Description / Brief</label>
          <textarea
            name="description"
            rows={5}
            className="field"
            defaultValue={a.description ?? ''}
            placeholder="What students need to do, examples, hints…"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label">Kind</label>
            <select name="kind" className="field" defaultValue={a.kind}>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="assessment">assessment</option>
              <option value="milestone">milestone</option>
            </select>
          </div>
          <div>
            <label className="field-label">Max score</label>
            <input
              type="number"
              name="max_score"
              min={1}
              defaultValue={a.max_score}
              className="field"
            />
          </div>
          <div>
            <label className="field-label">Weight</label>
            <input
              type="number"
              name="weight"
              step={0.1}
              min={0.1}
              defaultValue={a.weight ?? 1}
              className="field"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
              Relative importance vs other assignments.
            </p>
          </div>
        </div>

        <div>
          <label className="field-label">Due at (IST)</label>
          <DateTimeField
            name="due_at"
            defaultValue={a.due_at ?? null}
          />
        </div>

        <div>
          <label className="field-label">Reference / Attachment URL</label>
          <input
            name="attachment_url"
            className="field"
            defaultValue={a.attachment_url ?? ''}
            placeholder="https://… (problem statement, dataset, brief)"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="allow_github"
              defaultChecked={a.allow_github ?? true}
            />
            Allow GitHub URL submission
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="allow_file_upload"
              defaultChecked={a.allow_file_upload ?? true}
            />
            Allow file upload submission
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link href={`/mentor/assignments/${params.id}`} className="btn btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary">
            Save changes
          </button>
        </div>
      </form>
    </>
  );
}
