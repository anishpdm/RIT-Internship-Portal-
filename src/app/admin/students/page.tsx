import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { logAudit } from '@/lib/audit';
import { Search, UserPlus, Trash2 } from 'lucide-react';
import ResetPasswordButton from '@/components/ResetPasswordButton';
import ConfirmDeleteButton from '@/components/ConfirmDeleteButton';

export const dynamic = 'force-dynamic';

async function addStudent(formData: FormData) {
  'use server';
  const me = await requireRole('admin');
  const admin = createAdminClient();

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const full_name = String(formData.get('full_name') ?? '').trim();
  const passwordInput = String(formData.get('password') ?? '').trim();
  const password = passwordInput || 'rit12345';
  const role = 'student';

  if (!email || !full_name) {
    throw new Error('Email and name are required');
  }

  const { data: user, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (userErr || !user.user) {
    throw new Error(userErr?.message ?? 'Failed to create user');
  }

  // Force password change on first login
  await admin
    .from('profiles')
    .update({ role, full_name, email, must_change_password: true })
    .eq('id', user.user.id);

  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: 'create_student',
    entity_type: 'profile',
    entity_id: user.user.id,
    details: { email, full_name, default_password: password === 'rit12345' },
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

async function resetStudentPassword(
  formData: FormData,
): Promise<{ ok: boolean; password?: string; error?: string }> {
  'use server';
  const me = await requireRole('admin');
  const admin = createAdminClient();
  const id = String(formData.get('user_id'));
  const password = String(formData.get('password'));

  if (!id || !password || password.length < 8) {
    return { ok: false, error: 'Invalid input' };
  }

  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actor_id: me.userId,
    actor_role: 'admin',
    action: 'password.reset',
    entity_type: 'profile',
    entity_id: id,
  });

  return { ok: true, password };
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
              <label className="label">Initial password (optional)</label>
              <input
                name="password"
                type="text"
                minLength={6}
                className="field font-mono"
                placeholder="rit12345 (default)"
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--ink-500)' }}>
                Leave blank to use <code>rit12345</code>. Student will be forced to change on first login.
              </p>
            </div>
            <button type="submit" className="btn btn-primary w-full">
              Create student
            </button>
          </form>
        </details>
      </div>

      {students && students.length > 0 ? (
        <div className="card p-0 overflow-hidden table-wrap">
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
                  <td className="font-medium">
                    <Link href={`/admin/students/${s.id}`} className="link">
                      {s.full_name}
                    </Link>
                  </td>
                  <td className="font-mono text-xs">{s.email}</td>
                  <td>{s.phone ?? '—'}</td>
                  <td className="text-xs" style={{ color: 'var(--ink-500)' }}>
                    {new Date(s.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <div className="flex gap-2 items-center">
                      <Link href={`/admin/students/${s.id}`} className="link text-xs">
                        View progress →
                      </Link>
                      <ResetPasswordButton
                        userId={s.id}
                        userName={s.full_name ?? s.email}
                        action={resetStudentPassword}
                      />
                      <ConfirmDeleteButton
                        action={deleteStudent}
                        fields={[{ name: 'id', value: s.id }]}
                        itemName={s.full_name ?? s.email}
                        itemType="student"
                        warning="The account, all submissions, attendance records, and enrolments will be removed."
                        iconOnly
                        buttonClass="btn btn-ghost text-xs"
                      />
                    </div>
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
