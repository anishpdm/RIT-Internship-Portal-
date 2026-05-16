import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { UserPlus } from 'lucide-react';
import ResetPasswordButton from '@/components/ResetPasswordButton';

export const dynamic = 'force-dynamic';

async function resetStudentPassword(
  formData: FormData,
): Promise<{ ok: boolean; password?: string; error?: string }> {
  'use server';
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();
  const admin = createAdminClient();
  const target_id = String(formData.get('user_id'));
  const password = String(formData.get('password'));

  if (!target_id || !password || password.length < 8) {
    return { ok: false, error: 'Invalid input' };
  }

  // Mentor must share an internship with this student
  if (me.profile.role === 'mentor') {
    const { data: myAssign } = await supabase
      .from('mentor_assignments')
      .select('internship_id')
      .eq('mentor_id', me.userId);
    const internshipIds = (myAssign ?? []).map((a: any) => a.internship_id);

    const { data: studentEnr } = await supabase
      .from('enrollments')
      .select('internship_id')
      .eq('student_id', target_id);
    const studentIds = (studentEnr ?? []).map((e: any) => e.internship_id);

    const overlap = internshipIds.some((id) => studentIds.includes(id));
    if (!overlap) {
      return { ok: false, error: 'You can only reset passwords for students in your internships.' };
    }
  }

  const { error } = await admin.auth.admin.updateUserById(target_id, { password });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'password.reset',
    entity_type: 'profile',
    entity_id: target_id,
  });

  return { ok: true, password };
}

export default async function MentorStudentsPage({
  searchParams,
}: {
  searchParams: { internship?: string; q?: string };
}) {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  const { data: assignments } = await supabase
    .from('mentor_assignments')
    .select('internship_id, internships:internship_id (id, title)')
    .eq('mentor_id', me.userId);

  const allInternshipIds =
    assignments?.map((a: any) => a.internship_id) ?? [];

  let filterIds = allInternshipIds;
  if (searchParams.internship && allInternshipIds.includes(searchParams.internship)) {
    filterIds = [searchParams.internship];
  }

  let enrollments: any[] = [];
  if (filterIds.length) {
    let q = supabase
      .from('enrollments')
      .select(
        'id, current_level, status, total_score, enrolled_at, internship_id, internships:internship_id (title), profiles:student_id (id, full_name, email)',
      )
      .in('internship_id', filterIds)
      .order('total_score', { ascending: false });
    const { data } = await q;
    enrollments = data ?? [];
  }

  // Client-side filter for search (server-side fk filter is tricky)
  if (searchParams.q) {
    const needle = searchParams.q.toLowerCase();
    enrollments = enrollments.filter(
      (e) =>
        e.profiles?.full_name?.toLowerCase().includes(needle) ||
        e.profiles?.email?.toLowerCase().includes(needle),
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Mentor"
        title="Students"
        subtitle="Only the students enrolled in internships you mentor."
        actions={
          <Link href="/mentor/students/add" className="btn btn-primary">
            <UserPlus size={14} /> Add student
          </Link>
        }
      />

      <div className="flex gap-3 flex-wrap mb-6">
        <Link
          href="/mentor/students"
          className={`pill ${!searchParams.internship ? 'pill-accent' : ''}`}
        >
          All
        </Link>
        {assignments?.map((a: any) => (
          <Link
            key={a.internship_id}
            href={`/mentor/students?internship=${a.internship_id}`}
            className={`pill ${searchParams.internship === a.internship_id ? 'pill-accent' : ''}`}
          >
            {a.internships?.title}
          </Link>
        ))}
      </div>

      <form method="get" className="mb-6">
        {searchParams.internship && (
          <input type="hidden" name="internship" value={searchParams.internship} />
        )}
        <input
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Search name or email…"
          className="field max-w-md"
        />
      </form>

      {enrollments.length > 0 ? (
        <div className="card p-0 overflow-hidden table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Internship</th>
                <th>Level</th>
                <th>Status</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e: any) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/mentor/students/${e.profiles?.id}`} className="link font-medium">
                      {e.profiles?.full_name ?? '—'}
                    </Link>
                    <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                      {e.profiles?.email}
                    </p>
                  </td>
                  <td className="text-sm" style={{ color: 'var(--ink-500)' }}>
                    {e.internships?.title}
                  </td>
                  <td className="font-mono text-xs">L{e.current_level}</td>
                  <td>
                    <Pill
                      tone={
                        e.status === 'active'
                          ? 'blue'
                          : e.status === 'promoted'
                            ? 'green'
                            : e.status === 'filtered'
                              ? 'red'
                              : 'accent'
                      }
                    >
                      {e.status}
                    </Pill>
                  </td>
                  <td className="font-mono text-sm">
                    {Number(e.total_score).toFixed(1)}
                  </td>
                  <td>
                    <div className="flex gap-2 items-center">
                      <Link
                        href={`/mentor/students/${e.profiles?.id}`}
                        className="link text-sm"
                      >
                        View progress →
                      </Link>
                      <ResetPasswordButton
                        userId={e.profiles?.id}
                        userName={e.profiles?.full_name ?? e.profiles?.email}
                        action={resetStudentPassword}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No students match" />
      )}
    </>
  );
}
