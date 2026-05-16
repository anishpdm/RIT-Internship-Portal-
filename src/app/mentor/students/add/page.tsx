import { redirect } from 'next/navigation';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader } from '@/components/ui';
import { ArrowLeft, UserPlus } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function addStudent(formData: FormData) {
  'use server';
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();
  const admin = createAdminClient();

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const full_name = String(formData.get('full_name') ?? '').trim();
  const internship_id = String(formData.get('internship_id') ?? '');
  const passwordInput = String(formData.get('password') ?? '').trim();
  const password = passwordInput || 'rit12345';

  if (!email || !internship_id) {
    redirect('/mentor/students/add?error=missing');
  }

  // Verify mentor is assigned to this internship
  if (me.profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments')
      .select('id')
      .eq('mentor_id', me.userId)
      .eq('internship_id', internship_id)
      .maybeSingle();
    if (!ma) redirect('/mentor/students?error=forbidden');
  }

  // Look up existing user or create new one
  let userId: string | null = null;

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    userId = existing.id;
  } else {
    // Create new auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr || !created.user) {
      redirect(`/mentor/students/add?error=${encodeURIComponent(createErr?.message ?? 'create_failed')}`);
    }
    userId = created.user.id;

    // Force password change on first login
    await admin
      .from('profiles')
      .update({ full_name: full_name || null, must_change_password: true })
      .eq('id', userId);
  }

  // Enrol in internship (idempotent)
  if (userId) {
    const { data: existingEnr } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', userId)
      .eq('internship_id', internship_id)
      .maybeSingle();

    if (!existingEnr) {
      await admin.from('enrollments').insert({
        student_id: userId,
        internship_id,
        current_level: 1,
        status: 'active',
      });
    }

    await logAudit({
      actor_id: me.userId,
      actor_role: me.profile.role,
      action: 'student.add_and_enrol',
      entity_type: 'enrollment',
      entity_id: userId,
      details: { email, internship_id },
    });
  }

  revalidatePath('/mentor/students');
  redirect('/mentor/students');
}

export default async function MentorAddStudentPage() {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  let internshipsQuery = supabase
    .from('internships').select('id, title').neq('status', 'archived').order('created_at', { ascending: false });

  if (me.profile.role === 'mentor') {
    const { data: assignments } = await supabase
      .from('mentor_assignments').select('internship_id').eq('mentor_id', me.userId);
    const ids = assignments?.map((a: any) => a.internship_id) ?? [];
    if (ids.length === 0) {
      return (
        <>
          <PageHeader
            eyebrow="Mentor / Students"
            title="Add student"
            actions={<Link href="/mentor/students" className="btn btn-ghost"><ArrowLeft size={16} /> Back</Link>}
          />
          <div className="empty">You aren&apos;t assigned to any internships yet.</div>
        </>
      );
    }
    internshipsQuery = internshipsQuery.in('id', ids);
  }

  const { data: internships } = await internshipsQuery;

  return (
    <>
      <PageHeader
        eyebrow="Mentor / Students"
        title="Add student"
        subtitle="Create the account and enrol them in an internship in one step."
        actions={<Link href="/mentor/students" className="btn btn-ghost"><ArrowLeft size={16} /> Back</Link>}
      />

      <form action={addStudent} className="card max-w-xl space-y-5">
        <div>
          <label className="field-label">Email</label>
          <input type="email" name="email" required className="field" placeholder="student@rit.ac.in" />
        </div>
        <div>
          <label className="field-label">Full name</label>
          <input name="full_name" className="field" placeholder="Arjun Krishnan" />
        </div>
        <div>
          <label className="field-label">Initial password (optional)</label>
          <input type="text" name="password" minLength={6} className="field font-mono" placeholder="rit12345 (default)" />
          <p className="text-xs mt-1" style={{ color: 'var(--ink-500)' }}>
            Leave blank to use <code>rit12345</code>. Student must change it on first login.
          </p>
        </div>
        <div>
          <label className="field-label">Enrol in internship</label>
          <select name="internship_id" required className="field">
            <option value="">— Choose —</option>
            {internships?.map((i: any) => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/mentor/students" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary">
            <UserPlus size={14} /> Add student
          </button>
        </div>
      </form>
    </>
  );
}
