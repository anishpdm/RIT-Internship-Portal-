import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, Trash2, FileText, Link as LinkIcon, Pencil } from 'lucide-react';
import ConfirmDeleteButton from '@/components/ConfirmDeleteButton';
import LiveCodePanel from './LiveCodePanel';

export const dynamic = 'force-dynamic';

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
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Marked</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a: any) => (
                    <tr key={a.id}>
                      <td>
                        <p className="font-medium">{a.profiles?.full_name ?? '—'}</p>
                        <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{a.profiles?.email}</p>
                      </td>
                      <td>
                        <Pill tone={a.status === 'present' ? 'green' : a.status === 'partial' ? 'accent' : 'red'}>
                          {a.status}
                        </Pill>
                      </td>
                      <td className="text-xs">{formatDateTime(a.marked_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No attendance yet" hint="Records appear as students join the session." />
          )}
        </div>
      </div>
    </>
  );
}
