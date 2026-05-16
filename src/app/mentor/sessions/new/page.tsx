import { redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function createSession(formData: FormData) {
  'use server';
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  const internship_id = String(formData.get('internship_id') ?? '');
  const level_id_raw = String(formData.get('level_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const session_type = String(formData.get('session_type') ?? 'live') as
    | 'live'
    | 'recorded'
    | 'self_learning';
  const scheduled_at = String(formData.get('scheduled_at') ?? '');
  const duration_minutes = parseInt(String(formData.get('duration_minutes') ?? '60'), 10);
  const meeting_url = String(formData.get('meeting_url') ?? '').trim();
  const recording_url = String(formData.get('recording_url') ?? '').trim();
  const video_duration_sec = parseInt(String(formData.get('video_duration_sec') ?? '0'), 10);
  const min_dwell_minutes = parseInt(String(formData.get('min_dwell_minutes') ?? '30'), 10);
  const required = formData.get('required_for_progression') === 'on';

  if (!internship_id || !title) redirect('/mentor/sessions/new?error=missing');

  // Mentors can only create sessions in internships they're assigned to
  if (me.profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments')
      .select('id')
      .eq('mentor_id', me.userId)
      .eq('internship_id', internship_id)
      .maybeSingle();
    if (!ma) redirect('/mentor/sessions?error=forbidden');
  }

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      internship_id,
      level_id: level_id_raw || null,
      title,
      description: description || null,
      session_type,
      status: 'scheduled',
      scheduled_at: scheduled_at || null,
      duration_minutes,
      meeting_url: session_type === 'live' ? meeting_url || null : null,
      recording_url: session_type === 'recorded' ? recording_url || null : null,
      video_duration_sec: session_type === 'recorded' ? video_duration_sec || null : null,
      min_dwell_minutes: session_type === 'self_learning' ? min_dwell_minutes : null,
      required_for_progression: required,
      created_by: me.userId,
    })
    .select('id')
    .single();

  if (error || !session) redirect('/mentor/sessions/new?error=db');

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'session.create',
    entity_type: 'session',
    entity_id: session.id,
    details: { title, session_type, internship_id },
  });

  revalidatePath('/mentor/sessions');
  redirect('/mentor/sessions');
}

export default async function MentorNewSessionPage() {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  // Only show internships this mentor is assigned to (admins see all)
  let internshipsQuery = supabase
    .from('internships')
    .select('id, title')
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  if (me.profile.role === 'mentor') {
    const { data: assignments } = await supabase
      .from('mentor_assignments')
      .select('internship_id')
      .eq('mentor_id', me.userId);
    const ids = assignments?.map((a: any) => a.internship_id) ?? [];
    if (ids.length === 0) {
      return (
        <>
          <PageHeader
            eyebrow="Mentor / Sessions"
            title="New session"
            actions={
              <Link href="/mentor/sessions" className="btn btn-ghost">
                <ArrowLeft size={16} /> Back
              </Link>
            }
          />
          <div className="empty">
            You aren&apos;t assigned to any internships yet. Ask an administrator to assign you.
          </div>
        </>
      );
    }
    internshipsQuery = internshipsQuery.in('id', ids);
  }

  const { data: internships } = await internshipsQuery;
  const internshipIds = internships?.map((i: any) => i.id) ?? [];

  const { data: levels } = internshipIds.length
    ? await supabase
        .from('levels')
        .select('id, internship_id, level_number, title')
        .in('internship_id', internshipIds)
        .order('level_number')
    : { data: [] };

  return (
    <>
      <PageHeader
        eyebrow="Mentor / Sessions"
        title="New session"
        subtitle="Schedule a live, recorded, or self-learning session."
        actions={
          <Link href="/mentor/sessions" className="btn btn-ghost">
            <ArrowLeft size={16} /> Back
          </Link>
        }
      />

      <form action={createSession} className="card max-w-3xl space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Internship</label>
            <select name="internship_id" className="field" required>
              <option value="">— Choose —</option>
              {internships?.map((i: any) => (
                <option key={i.id} value={i.id}>{i.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Level (optional)</label>
            <select name="level_id" className="field">
              <option value="">— Any —</option>
              {levels?.map((l: any) => (
                <option key={l.id} value={l.id}>L{l.level_number} · {l.title}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label">Title</label>
          <input name="title" className="field" required placeholder="e.g. Linear Regression — Foundations" />
        </div>

        <div>
          <label className="field-label">Description</label>
          <textarea name="description" rows={3} className="field" />
        </div>

        <div>
          <label className="field-label">Session type</label>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { v: 'live', t: 'Live', d: 'Real-time with rotating code' },
              { v: 'recorded', t: 'Recorded', d: 'Video with watch heartbeat' },
              { v: 'self_learning', t: 'Self-learning', d: 'Dwell + reflection' },
            ].map((opt, i) => (
              <label key={opt.v} className="card card-hover cursor-pointer p-4">
                <input type="radio" name="session_type" value={opt.v} defaultChecked={i === 0} className="mr-2" />
                <span className="font-display font-semibold text-sm">{opt.t}</span>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>{opt.d}</p>
              </label>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Scheduled at</label>
            <input type="datetime-local" name="scheduled_at" className="field" />
          </div>
          <div>
            <label className="field-label">Duration (minutes)</label>
            <input type="number" name="duration_minutes" min={5} defaultValue={60} className="field" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Meeting URL (live)</label>
            <input name="meeting_url" className="field" placeholder="https://meet.google.com/..." />
          </div>
          <div>
            <label className="field-label">Recording URL (recorded)</label>
            <input name="recording_url" className="field" placeholder="https://... .mp4" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Video duration (sec) — recorded</label>
            <input type="number" name="video_duration_sec" min={0} defaultValue={0} className="field" />
          </div>
          <div>
            <label className="field-label">Min dwell (min) — self-learning</label>
            <input type="number" name="min_dwell_minutes" min={1} defaultValue={30} className="field" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="required_for_progression" />
          Required for level progression
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/mentor/sessions" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary">Create session</button>
        </div>
      </form>
    </>
  );
}
