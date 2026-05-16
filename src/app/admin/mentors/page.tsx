import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, EmptyState } from '@/components/ui';
import { logAudit } from '@/lib/audit';
import { UserPlus, Trash2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function addMentor(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const admin = createAdminClient();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const full_name = String(formData.get('full_name') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();
  if (!email || !password || !full_name) throw new Error('Missing fields');

  const { data: user, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: 'mentor' },
  });
  if (error || !user.user) throw new Error(error?.message ?? 'Failed');

  await admin
    .from('profiles')
    .update({ role: 'mentor', full_name, email })
    .eq('id', user.user.id);

  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: 'create_mentor',
    entity_type: 'profile',
    entity_id: user.user.id,
    details: { email, full_name },
  });

  redirect('/admin/mentors');
}

async function deleteMentor(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const admin = createAdminClient();
  const id = String(formData.get('id'));
  await admin.auth.admin.deleteUser(id);
  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: 'delete_mentor',
    entity_type: 'profile',
    entity_id: id,
  });
  redirect('/admin/mentors');
}

export default async function MentorsPage() {
  const supabase = createClient();
  const { data: mentors } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at')
    .eq('role', 'mentor')
    .order('created_at', { ascending: false });

  // Fetch their internship assignments
  const ids = mentors?.map((m) => m.id) ?? [];
  const { data: assignments } = await supabase
    .from('mentor_assignments')
    .select('mentor_id, internship_id, internships:internship_id (title)')
    .in('mentor_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  const byMentor = new Map<string, string[]>();
  (assignments ?? []).forEach((a: any) => {
    const list = byMentor.get(a.mentor_id) ?? [];
    if (a.internships?.title) list.push(a.internships.title);
    byMentor.set(a.mentor_id, list);
  });

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Mentors"
        subtitle="Create mentor accounts. Assign them to internships on the internship page."
        actions={
          <details>
            <summary
              className="btn btn-primary cursor-pointer"
              style={{ listStyle: 'none' }}
            >
              <UserPlus size={16} /> Add mentor
            </summary>
            <form
              action={addMentor}
              className="card absolute right-12 top-32 z-10 w-96 space-y-3"
              style={{ boxShadow: '0 10px 30px rgba(22,21,18,0.18)' }}
            >
              <div>
                <label className="label">Full name</label>
                <input name="full_name" required className="field" />
              </div>
              <div>
                <label className="label">Email</label>
                <input name="email" type="email" required className="field" />
              </div>
              <div>
                <label className="label">Initial password</label>
                <input
                  name="password"
                  type="text"
                  minLength={8}
                  required
                  className="field font-mono"
                />
              </div>
              <button type="submit" className="btn btn-primary w-full">
                Create mentor
              </button>
            </form>
          </details>
        }
      />

      {mentors && mentors.length > 0 ? (
        <div className="card p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Assigned internships</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mentors.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium">{m.full_name}</td>
                  <td className="font-mono text-xs">{m.email}</td>
                  <td className="text-sm">
                    {(byMentor.get(m.id) ?? []).join(', ') || '—'}
                  </td>
                  <td>
                    <form action={deleteMentor}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="btn btn-ghost text-xs" type="submit">
                        <Trash2 size={12} /> Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No mentors yet"
          hint="Add at least one before assigning to internships."
        />
      )}
    </>
  );
}
