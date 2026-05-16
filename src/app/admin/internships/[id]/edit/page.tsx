import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader } from '@/components/ui';
import DateTimeField from '@/components/DateTimeField';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function updateInternship(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const supabase = createClient();

  const id = String(formData.get('id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const total_levels = parseInt(String(formData.get('total_levels') ?? '1'), 10);
  const status = String(formData.get('status') ?? 'draft');
  const start_date = String(formData.get('start_date') ?? '');
  const end_date = String(formData.get('end_date') ?? '');

  if (!id || !title) redirect(`/admin/internships/${id}/edit?error=missing`);

  await supabase
    .from('internships')
    .update({
      title,
      description: description || null,
      total_levels,
      status,
      start_date: start_date || null,
      end_date: end_date || null,
    })
    .eq('id', id);

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'internship.update',
    entity_type: 'internship',
    entity_id: id,
    details: { title, status, total_levels },
  });

  revalidatePath(`/admin/internships/${id}`);
  redirect(`/admin/internships/${id}`);
}

export default async function EditInternshipPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole('admin');
  const supabase = createClient();

  const { data: internship } = await supabase
    .from('internships')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!internship) notFound();

  // Convert ISO date strings to YYYY-MM-DD for date input
  const startStr = internship.start_date
    ? new Date(internship.start_date).toISOString().slice(0, 10)
    : '';
  const endStr = internship.end_date
    ? new Date(internship.end_date).toISOString().slice(0, 10)
    : '';

  return (
    <>
      <PageHeader
        eyebrow="Admin / Internships"
        title="Edit internship"
        subtitle="Update the basics. Levels are managed from the internship detail page."
        actions={
          <Link href={`/admin/internships/${params.id}`} className="btn btn-ghost">
            <ArrowLeft size={16} /> Back
          </Link>
        }
      />

      <form action={updateInternship} className="card max-w-2xl space-y-5">
        <input type="hidden" name="id" value={internship.id} />

        <div>
          <label className="field-label">Title</label>
          <input
            name="title"
            className="field"
            required
            defaultValue={internship.title}
          />
        </div>

        <div>
          <label className="field-label">Description</label>
          <textarea
            name="description"
            rows={4}
            className="field"
            defaultValue={internship.description ?? ''}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label">Total levels</label>
            <input
              type="number"
              name="total_levels"
              min={1}
              max={20}
              className="field"
              defaultValue={internship.total_levels}
            />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select name="status" className="field" defaultValue={internship.status}>
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="completed">completed</option>
              <option value="archived">archived</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Start date</label>
            <input
              type="date"
              name="start_date"
              className="field"
              defaultValue={startStr}
            />
          </div>
          <div>
            <label className="field-label">End date</label>
            <input
              type="date"
              name="end_date"
              className="field"
              defaultValue={endStr}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href={`/admin/internships/${params.id}`}
            className="btn btn-ghost"
          >
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
