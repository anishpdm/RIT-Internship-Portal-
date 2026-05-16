import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader } from '@/components/ui';

async function createInternship(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const supabase = createClient();

  const total_levels = Number(formData.get('total_levels') ?? 1);
  const payload = {
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || null,
    total_levels,
    start_date: (formData.get('start_date') as string) || null,
    end_date: (formData.get('end_date') as string) || null,
    status: (formData.get('status') as string) || 'draft',
    created_by: me.userId,
  };

  const { data, error } = await supabase
    .from('internships')
    .insert(payload)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create internship');
  }

  // Auto-create level rows so the admin doesn't have to click again
  const levels = Array.from({ length: total_levels }, (_, idx) => ({
    internship_id: data.id,
    level_number: idx + 1,
    title: `Level ${idx + 1}`,
    pass_threshold: 60,
  }));
  await supabase.from('levels').insert(levels);

  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: 'create_internship',
    entity_type: 'internship',
    entity_id: data.id,
    details: { title: payload.title, total_levels },
  });

  redirect(`/admin/internships/${data.id}`);
}

export default function NewInternshipPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="New internship"
        subtitle="Define a cohort program. Levels are auto-created; you can edit them next."
      />

      <form action={createInternship} className="card max-w-2xl space-y-5">
        <div>
          <label className="label">Title</label>
          <input
            name="title"
            required
            className="field"
            placeholder="e.g. 45-Day AI/ML Practical Training"
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            name="description"
            className="field"
            placeholder="One paragraph describing the program."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Levels</label>
            <input
              name="total_levels"
              type="number"
              min={1}
              max={10}
              defaultValue={3}
              required
              className="field font-mono"
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue="draft" className="field">
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start date</label>
            <input name="start_date" type="date" className="field" />
          </div>
          <div>
            <label className="label">End date</label>
            <input name="end_date" type="date" className="field" />
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">
            Create internship
          </button>
          <Link href="/admin/internships" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
