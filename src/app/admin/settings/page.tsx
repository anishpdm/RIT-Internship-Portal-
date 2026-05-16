import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader } from '@/components/ui';
import ChangePasswordForm from '@/components/ChangePasswordForm';

export const dynamic = 'force-dynamic';

async function updateProfile(formData: FormData) {
  'use server';
  const me = await requireRole(['admin']);
  const supabase = createClient();

  const full_name = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const bio = String(formData.get('bio') ?? '').trim();

  await supabase
    .from('profiles')
    .update({
      full_name: full_name || null,
      phone: phone || null,
      bio: bio || null,
    })
    .eq('id', me.userId);

  await logAudit({
    actor_id: me.userId,
    actor_role: me.profile.role,
    action: 'profile.update',
    entity_type: 'profile',
    entity_id: me.userId,
  });

  revalidatePath('/admin/settings');
}

export default async function AdminSettingsPage() {
  const me = await requireRole(['admin']);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Account settings"
        subtitle="Update your profile and change your password."
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <form action={updateProfile} className="card max-w-xl space-y-4">
          <p className="font-display font-semibold">Profile</p>
          <div>
            <label className="field-label">Email</label>
            <input className="field" value={me.profile.email} disabled />
          </div>
          <div>
            <label className="field-label">Full name</label>
            <input name="full_name" className="field" defaultValue={me.profile.full_name ?? ''} />
          </div>
          <div>
            <label className="field-label">Phone</label>
            <input name="phone" className="field" defaultValue={me.profile.phone ?? ''} />
          </div>
          <div>
            <label className="field-label">Bio</label>
            <textarea
              name="bio"
              rows={3}
              className="field"
              defaultValue={me.profile.bio ?? ''}
              placeholder="Short bio shown to your team."
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary">Save profile</button>
          </div>
        </form>

        <ChangePasswordForm />
      </div>
    </>
  );
}
