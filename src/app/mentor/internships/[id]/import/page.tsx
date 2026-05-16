import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import CsvImportForm from '@/components/CsvImportForm';

export const dynamic = 'force-dynamic';

async function importStudents(
  internshipId: string,
  rows: { email: string; full_name?: string; phone?: string }[],
): Promise<{ created: number; enrolled: number; skipped: number; errors: string[] }> {
  'use server';
  const me = await requireRole(['admin', 'mentor']);
  const supabase = createClient();
  const admin = createAdminClient();

  // Scope check for mentor
  if (me.profile.role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments')
      .select('id')
      .eq('mentor_id', me.userId)
      .eq('internship_id', internshipId)
      .maybeSingle();
    if (!ma) return { created: 0, enrolled: 0, skipped: 0, errors: ['Not authorised for this internship.'] };
  }

  let created = 0;
  let enrolled = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const email = (row.email ?? '').trim().toLowerCase();
    const full_name = (row.full_name ?? '').trim();
    const phone = (row.phone ?? '').trim();

    if (!email || !email.includes('@')) {
      skipped++;
      errors.push(`Skipped invalid email: "${row.email ?? ''}"`);
      continue;
    }

    let userId: string | null = null;

    // Existing user?
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      userId = existing.id;
    } else {
      const { data: u, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: 'rit12345',
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (cErr || !u.user) {
        errors.push(`Could not create ${email}: ${cErr?.message ?? 'unknown error'}`);
        continue;
      }
      userId = u.user.id;
      await admin
        .from('profiles')
        .update({
          full_name: full_name || null,
          phone: phone || null,
          must_change_password: true,
        })
        .eq('id', userId);
      created++;
    }

    // Enrol (idempotent)
    const { data: existingEnr } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', userId)
      .eq('internship_id', internshipId)
      .maybeSingle();

    if (!existingEnr) {
      const { error: enrErr } = await admin.from('enrollments').insert({
        student_id: userId,
        internship_id: internshipId,
        current_level: 1,
        status: 'active',
      });
      if (enrErr) {
        errors.push(`Could not enrol ${email}: ${enrErr.message}`);
      } else {
        enrolled++;
      }
    }
  }

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'student.bulk_import',
    entity_type: 'internship',
    entity_id: internshipId,
    details: { created, enrolled, skipped, errors: errors.length },
  });

  return { created, enrolled, skipped, errors };
}

export default async function ImportStudentsPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['admin', 'mentor']);
  const supabase = createClient();

  const { data: internship } = await supabase
    .from('internships')
    .select('id, title')
    .eq('id', params.id)
    .single();

  if (!internship) notFound();

  return (
    <>
      <PageHeader
        eyebrow={`Import students · ${internship.title}`}
        title="Bulk add students from CSV"
        subtitle="Upload a CSV file with columns: email, full_name, phone. Each new student gets the default password rit12345 and is forced to change it on first login."
        actions={
          <Link href={`/mentor/performance/${params.id}`} className="btn btn-ghost">
            <ArrowLeft size={16} /> Back
          </Link>
        }
      />

      <CsvImportForm internshipId={internship.id} importAction={importStudents} />
    </>
  );
}
