import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { logAudit } from '@/lib/audit';
import { Search, UserPlus, Trash2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function addStudent(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const admin = createAdminClient();

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const full_name = String(formData.get('full_name') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();
  const role = 'student';

  if (!email || !password || !full_name) {
    throw new Error('Missing fields');
  }

  // Create the auth user with admin client. handle_new_user trigger creates profile.
  const { data: user, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (userErr || !user.user) {
    throw new Error(userErr?.message ?? 'Failed to create user');
  }

  // Trigger sets role from raw_user_meta_data; force-confirm here too:
  await admin
    .from('profiles')
    .update({ role, full_name, email })
    .eq('id', user.user.id);

  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: 'create_student',
    entity_type: 'profile',
    entity_id: user.user.id,
    details: { email, full_name },
  });

  redirect('/admin/students');
}

async function deleteStudent(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const admin = createAdminClient();
  const id = String(formData.get('id'));
  await admin.auth.admin.deleteUser(id);
  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: 'delete_student',
    entity_type: 'profile',
    entity_id: id,
  });
  redirect('/admin/students');
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createClient();
  const q = (searchParams.q ?? '').trim();

  let query = supabase
    .from('profiles')
    .select('id, email, full_name, phone, created_at')
    .eq('role', 'student')
    .order('created_at', { ascending: false });

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: students } = await query;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Students"
        subtitle="Browse, search, and add students. Use the internship page to enrol them."
      />

      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <form className="flex gap-2 items-center">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--ink-500)' }}
            />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name or email…"
              className="field pl-9"
              style={{ width: '20rem' }}
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
          {q && (
            <Link href="/admin/students" className="btn btn-ghost">
              Clear
            </Link>
          )}
        </form>

        <details className="relative">
          <summary
            className="btn btn-primary cursor-pointer list-none"
            style={{ listStyle: 'none' }}
          >
            <UserPlus size={16} /> Add student
          </summary>
          <form
            action={addStudent}
            className="card absolute right-0 top-12 z-10 w-96 space-y-3 shadow-lg"
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
                required
                minLength={8}
                className="field font-mono"
                placeholder="≥ 8 characters"
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--ink-500)' }}>
                Share with the student. They can change it after first login.
              </p>
            </div>
            <button type="submit" className="btn btn-primary w-full">
              Create student
            </button>
          </form>
        </details>
      </div>

      {students && students.length > 0 ? (
        <div className="card p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.full_name}</td>
                  <td className="font-mono text-xs">{s.email}</td>
                  <td>{s.phone ?? '—'}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-500)' }}>
                    {new Date(s.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <form action={deleteStudent}>
                      <input type="hidden" name="id" value={s.id} />
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
          title={q ? `No students match "${q}"` : 'No students yet'}
          hint="Click ‘Add student’ to create accounts. They’ll appear here."
        />
      )}
    </>
  );
}
