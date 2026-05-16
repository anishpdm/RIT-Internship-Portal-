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

async function updateSession(formData: FormData) {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const id = String(formData.get('id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const scheduled_at = String(formData.get('scheduled_at') ?? '');
  const duration_minutes = parseInt(String(formData.get('duration_minutes') ?? '60'), 10);
  const meeting_url = String(formData.get('meeting_url') ?? '').trim();
  const recording_url = String(formData.get('recording_url') ?? '').trim();
  const video_duration_sec = parseInt(String(formData.get('video_duration_sec') ?? '0'), 10);
  const min_dwell_minutes = parseInt(String(formData.get('min_dwell_minutes') ?? '30'), 10);
  const status = String(formData.get('status') ?? 'scheduled');
  const required = formData.get('required_for_progression') === 'on';

  if (!id || !title) redirect(`/mentor/sessions/${id}/edit?error=missing`);

  // Mentor must own the internship
  if (me.profile.role === 'mentor') {
    const { data: session } = await supabase
      .from('sessions')
      .select('internship_id')
      .eq('id', id)
      .single();
    if (session) {
      const { data: ma } = await supabase
        .from('mentor_assignments')
        .select('id')
        .eq('mentor_id', me.userId)
        .eq('internship_id', session.internship_id)
        .maybeSingle();
      if (!ma) redirect('/mentor/sessions');
    }
  }

  await supabase
    .from('sessions')
    .update({
      title,
      description: description || null,
      scheduled_at: scheduled_at || null,
      duration_minutes,
      meeting_url: meeting_url || null,
      recording_url: recording_url || null,
      video_duration_sec: video_duration_sec || null,
      min_dwell_minutes: min_dwell_minutes || null,
      status,
      required_for_progression: required,
    })
    .eq('id', id);

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'session.update',
    entity_type: 'session',
    entity_id: id,
    details: { title, status },
  });

  revalidatePath(`/mentor/sessions/${id}`);
  revalidatePath(`/mentor/sessions/${id}`);
  redirect(me.profile.role === 'mentor' ? `/mentor/sessions/${id}` : `/mentor/sessions/${id}`);
}

async function deleteSession(formData: FormData) {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');

  if (me.profile.role === 'mentor') {
    const { data: session } = await supabase
      .from('sessions')
      .select('internship_id')
      .eq('id', id)
      .single();
    if (session) {
      const { data: ma } = await supabase
        .from('mentor_assignments')
        .select('id')
        .eq('mentor_id', me.userId)
        .eq('internship_id', session.internship_id)
        .maybeSingle();
      if (!ma) redirect('/mentor/sessions');
    }
  }

  await supabase.from('sessions').delete().eq('id', id);

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'session.delete',
    entity_type: 'session',
    entity_id: id,
  });

  revalidatePath('/admin/sessions');
  revalidatePath('/mentor/sessions');
  redirect(me.profile.role === 'mentor' ? '/mentor/sessions' : '/admin/sessions');
}

export default async function EditSessionPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('*, internships:internship_id (title)')
    .eq('id', params.id)
    .single();

  if (!session) notFound();

  return (
    <>
      <PageHeader
        eyebrow={`Mentor / Edit session`}
        title={session.title}
        subtitle={`Internship: ${(session as any).internships?.title ?? '—'}`}
        actions={
          <Link href={`/mentor/sessions/${params.id}`} className="btn btn-ghost">
            <ArrowLeft size={16} /> Back
          </Link>
        }
      />

      <form action={updateSession} className="card max-w-3xl space-y-5">
        <input type="hidden" name="id" value={session.id} />

        <div>
          <label className="field-label">Title</label>
          <input name="title" className="field" required defaultValue={session.title} />
        </div>

        <div>
          <label className="field-label">Description</label>
          <textarea name="description" rows={3} className="field" defaultValue={session.description ?? ''} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Scheduled at</label>
            <DateTimeField name="scheduled_at" defaultValue={session.scheduled_at} />
          </div>
          <div>
            <label className="field-label">Duration (minutes)</label>
            <input type="number" name="duration_minutes" min={5} defaultValue={session.duration_minutes} className="field" />
          </div>
        </div>

        <div>
          <label className="field-label">Status</label>
          <select name="status" className="field" defaultValue={session.status}>
            <option value="scheduled">scheduled</option>
            <option value="live">live</option>
            <option value="ended">ended</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>

        {session.session_type === 'live' && (
          <div>
            <label className="field-label">Meeting URL</label>
            <input name="meeting_url" className="field" defaultValue={session.meeting_url ?? ''} placeholder="https://meet.google.com/..." />
          </div>
        )}

        {session.session_type === 'recorded' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Recording URL</label>
              <input name="recording_url" className="field" defaultValue={session.recording_url ?? ''} />
            </div>
            <div>
              <label className="field-label">Video duration (sec)</label>
              <input type="number" name="video_duration_sec" min={0} defaultValue={session.video_duration_sec ?? 0} className="field" />
            </div>
          </div>
        )}

        {session.session_type === 'self_learning' && (
          <div>
            <label className="field-label">Min dwell minutes</label>
            <input type="number" name="min_dwell_minutes" min={1} defaultValue={session.min_dwell_minutes ?? 30} className="field" />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="required_for_progression" defaultChecked={session.required_for_progression} />
          Required for level progression
        </label>

        <div className="flex justify-between items-center pt-2">
          <form action={deleteSession}>
            <input type="hidden" name="id" value={session.id} />
            <button type="submit" className="btn btn-danger text-sm">
              Delete session
            </button>
          </form>
          <div className="flex gap-2">
            <Link href={`/mentor/sessions/${params.id}`} className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary">Save changes</button>
          </div>
        </div>
      </form>
    </>
  );
}
