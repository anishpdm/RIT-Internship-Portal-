import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, Trash2, FileText, Link as LinkIcon, Pencil, Video, Zap, UserCheck, Clock } from 'lucide-react';
import ConfirmDeleteButton from '@/components/ConfirmDeleteButton';
import LiveCodePanel from './LiveCodePanel';

export const dynamic = 'force-dynamic';

async function updateRecording(formData: FormData) {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();
  const session_id = String(formData.get('session_id') ?? '');
  const recording_url = String(formData.get('recording_url') ?? '').trim();

  if (!session_id) return;

  await supabase
    .from('sessions')
    .update({ recording_url: recording_url || null })
    .eq('id', session_id);

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'session.recording_update',
    entity_type: 'session',
    entity_id: session_id,
    details: { has_recording: !!recording_url },
  });

  revalidatePath(`/admin/sessions/${session_id}`);
  revalidatePath(`/mentor/sessions/${session_id}`);
  revalidatePath(`/student/sessions/${session_id}`);
}

async function addMaterial(formData: FormData) {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();
  const session_id = String(formData.get('session_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const link_url = String(formData.get('link_url') ?? '').trim();
  const file_type = String(formData.get('file_type') ?? '').trim();

  if (!session_id || !title) redirect(`/admin/sessions/${session_id}?error=missing`);

  await supabase.from('session_materials').insert({
    session_id,
    title,
    link_url: link_url || null,
    file_type: file_type || null,
    added_by: me.userId,
  });

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'material.add',
    entity_type: 'session',
    entity_id: session_id,
    details: { title },
  });

  revalidatePath(`/admin/sessions/${session_id}`);
}

async function deleteMaterial(formData: FormData) {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const session_id = String(formData.get('session_id') ?? '');
  await supabase.from('session_materials').delete().eq('id', id);

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'material.delete',
    entity_type: 'session_material',
    entity_id: id,
  });

  revalidatePath(`/admin/sessions/${session_id}`);
}

async function updateStatus(formData: FormData) {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  await supabase.from('sessions').update({ status }).eq('id', id);

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'session.status',
    entity_type: 'session',
    entity_id: id,
    details: { status },
  });

  revalidatePath(`/admin/sessions/${id}`);
}

export default async function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const { data: session } = await supabase
    .from('sessions')
    .select(
      '*, internships:internship_id (id, title), levels:level_id (level_number, title)',
    )
    .eq('id', params.id)
    .single();

  if (!session) notFound();

  const { data: materials } = await supabase
    .from('session_materials')
    .select('*')
    .eq('session_id', params.id)
    .order('created_at');

  const { data: attendance } = await supabase
    .from('attendance')
    .select(
      '*, profiles:student_id (full_name, email)',
    )
    .eq('session_id', params.id)
    .order('marked_at', { ascending: false });

  const presentCount = attendance?.filter((a: any) => a.status === 'present').length ?? 0;
  const partialCount = attendance?.filter((a: any) => a.status === 'partial').length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={`Admin / ${(session as any).internships?.title ?? 'Session'}`}
        title={session.title}
        subtitle={`${session.session_type.replace('_', ' ')} · ${formatDateTime(session.scheduled_at)}`}
        actions={
          <>
            <Link
              href={`/admin/sessions/${session.id}/attendance`}
              className="btn btn-secondary"
            >
              <UserCheck size={14} /> Attendance
            </Link>
            {session.session_type === 'recorded' && (
              <Link href={`/admin/sessions/${session.id}/watchtime`} className="btn btn-secondary">
                <Clock size={14}/> Watch-time
              </Link>
            )}
            <Link href={`/admin/sessions/${session.id}/quiz`} className="btn btn-secondary">
              <Zap size={14} /> Quiz
            </Link>
            <Link href={`/admin/sessions/${session.id}/quiz/results`} className="btn btn-secondary">
              <Clock size={14} /> Quiz results
            </Link>
            <Link href={`/admin/sessions/${session.id}/edit`} className="btn btn-secondary">
              <Pencil size={14} /> Edit
            </Link>
            <Link href="/admin/sessions" className="btn btn-ghost">
              <ArrowLeft size={16} /> Back
            </Link>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <p className="eyebrow">Type</p>
          <p className="font-display text-xl mt-1 capitalize">
            {session.session_type.replace('_', ' ')}
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">Status</p>
          <div className="mt-1">
            <Pill tone={session.status === 'live' ? 'accent' : session.status === 'ended' ? undefined : 'blue'}>
              {session.status}
            </Pill>
          </div>
          <form action={updateStatus} className="mt-3 flex gap-2">
            <input type="hidden" name="id" value={session.id} />
            <select name="status" defaultValue={session.status} className="field text-sm flex-1">
              <option value="scheduled">scheduled</option>
              <option value="live">live</option>
              <option value="ended">ended</option>
              <option value="cancelled">cancelled</option>
            </select>
            <button type="submit" className="btn btn-ghost text-sm">Save</button>
          </form>
        </div>
        <div className="card">
          <p className="eyebrow">Attendance</p>
          <p className="font-display text-xl mt-1">
            {presentCount} <span className="text-sm" style={{ color: 'var(--ink-500)' }}>present · {partialCount} partial</span>
          </p>
        </div>
      </div>

      {session.session_type === 'live' && (
        <div className="mb-8">
          <LiveCodePanel sessionId={session.id} />
        </div>
      )}

      <div className="card mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <Video size={16} />
          </div>
          <div>
            <p className="font-display font-semibold">Session recording</p>
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              Paste a Google Drive, YouTube, or other shareable link. Students will see this in their session view and Library.
            </p>
          </div>
        </div>

        {session.recording_url && (
          <div className="mb-3">
            {/* Inline YouTube preview if it's a YouTube link */}
            {/youtu(be\.com|\.be)/i.test(session.recording_url) && (() => {
              const m = session.recording_url.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ??
                        session.recording_url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
              const ytId = m?.[1];
              return ytId ? (
                <div className="rounded-xl overflow-hidden mb-3" style={{ aspectRatio: '16/9', background: '#000' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Session recording"
                  />
                </div>
              ) : null;
            })()}
            <a href={session.recording_url} target="_blank" rel="noreferrer"
              className="text-sm link block break-all flex items-center gap-1">
              <span>🔗</span> {session.recording_url}
            </a>
          </div>
        )}

        <form action={updateRecording} className="flex flex-col sm:flex-row gap-2">
          <input type="hidden" name="session_id" value={session.id} />
          <input
            name="recording_url"
            defaultValue={session.recording_url ?? ''}
            placeholder="https://drive.google.com/file/d/.../view"
            className="field flex-1"
          />
          <button type="submit" className="btn btn-primary">
            Save recording link
          </button>
        </form>
      </div>

      {session.description && (
        <div className="card mb-8">
          <p className="eyebrow">Description</p>
          <p className="mt-2 leading-relaxed">{session.description}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display text-2xl mb-4">Materials</h2>
          {materials && materials.length > 0 ? (
            <div className="space-y-2 mb-4">
              {materials.map((m: any) => (
                <div key={m.id} className="card flex items-center gap-3">
                  {m.link_url ? <LinkIcon size={16} /> : <FileText size={16} />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{m.title}</p>
                    {m.link_url && (
                      <a
                        href={m.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs truncate block"
                        style={{ color: 'var(--accent)' }}
                      >
                        {m.link_url}
                      </a>
                    )}
                  </div>
                  <ConfirmDeleteButton
                    action={deleteMaterial}
                    fields={[
                      { name: 'id', value: m.id },
                      { name: 'session_id', value: session.id },
                    ]}
                    itemName={m.title}
                    itemType="material"
                    iconOnly
                    buttonClass="btn btn-ghost text-sm"
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No materials yet" />
          )}

          <form action={addMaterial} className="card space-y-3">
            <input type="hidden" name="session_id" value={session.id} />
            <div>
              <label className="field-label">Title</label>
              <input name="title" className="field" required />
            </div>
            <div>
              <label className="field-label">Link URL</label>
              <input name="link_url" className="field" placeholder="https://..." />
            </div>
            <div>
              <label className="field-label">Type</label>
              <input name="file_type" className="field" placeholder="slides, notebook, dataset…" />
            </div>
            <button type="submit" className="btn btn-primary self-start">Add material</button>
          </form>
        </div>

        <div>
          <h2 className="font-display text-2xl mb-4">Attendance roster</h2>
          {attendance && attendance.length > 0 ? (
            <div className="card p-0 overflow-hidden table-wrap">
              <div className="px-5 py-3.5 flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg,#0a0f1e,#1e1b4b)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                <span style={{ color: '#fbbf24' }}>⏱</span>
                <p className="font-bold text-sm text-white">Watch-time & attendance</p>
                <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,.35)' }}>
                  {presentCount} present · {partialCount} partial
                </span>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th style={{ minWidth: 160 }}>Watch time</th>
                    <th style={{ textAlign: 'right' }}>Progress</th>
                    <th>Last seen</th>
                    <th>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance
                    .slice()
                    .sort((a: any, b: any) => (b.active_seconds ?? 0) - (a.active_seconds ?? 0))
                    .map((a: any) => {
                      const activeSec: number = a.active_seconds ?? 0;
                      const duration: number  = session.video_duration_sec ?? 0;
                      const required: number  = Math.floor(duration * 0.8);
                      const pct = required > 0 ? Math.min(100, Math.round((activeSec / required) * 100)) : 0;
                      const totalPct = duration > 0 ? Math.min(100, Math.round((activeSec / duration) * 100)) : 0;
                      const barColor = a.status === 'present' ? '#10b981' : a.status === 'partial' ? '#f59e0b' : '#ef4444';
                      const lastPos: number = a.last_position ?? 0;

                      function fmtSec(s: number) {
                        const m = Math.floor(s / 60); const sec = s % 60;
                        return `${m}:${String(sec).padStart(2,'0')}`;
                      }

                      return (
                        <tr key={a.id}>
                          <td>
                            <p className="font-medium text-sm">{a.profiles?.full_name ?? '—'}</p>
                            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{a.profiles?.email}</p>
                          </td>
                          <td>
                            <Pill tone={a.status === 'present' ? 'green' : a.status === 'partial' ? 'amber' : 'red'}>
                              {a.status}
                            </Pill>
                            {a.marked_manually_by && (
                              <p className="text-[10px] mt-1" style={{ color: 'var(--ink-400)' }}>manual</p>
                            )}
                          </td>
                          <td>
                            <div>
                              <span className="font-mono font-bold text-sm">{fmtSec(activeSec)}</span>
                              {duration > 0 && (
                                <span className="text-xs ml-1" style={{ color: 'var(--ink-500)' }}>
                                  / {fmtSec(required)} req.
                                </span>
                              )}
                            </div>
                            {duration > 0 && (
                              <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ width: 120, background: 'var(--ink-100)' }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }}/>
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {duration > 0 ? (
                              <span className="font-mono font-bold" style={{ color: barColor }}>
                                {totalPct}%
                              </span>
                            ) : (
                              <span className="font-mono text-sm">{fmtSec(activeSec)}</span>
                            )}
                          </td>
                          <td className="text-xs" style={{ color: 'var(--ink-500)' }}>
                            {a.last_heartbeat ? formatDateTime(a.last_heartbeat) : '—'}
                          </td>
                          <td className="font-mono text-xs">
                            {lastPos > 0 ? fmtSec(lastPos) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No watch data yet" hint="Records appear as students start watching the recording." />
          )}
        </div>
      </div>
    </>
  );
}
