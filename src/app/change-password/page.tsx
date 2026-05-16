import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ForceChangePasswordForm from './ForceChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background: `radial-gradient(60% 50% at 50% 0%, rgba(79, 70, 229, 0.08), transparent 70%), var(--bg)`,
      }}
    >
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <span className="brand-mark">RIT</span>
          <div>
            <p className="font-display text-lg font-semibold leading-tight">
              Internship Portal
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              Rajiv Gandhi Institute of Technology
            </p>
          </div>
        </div>

        <ForceChangePasswordForm
          email={me.profile.email}
          name={me.profile.full_name ?? ''}
          role={me.profile.role}
        />
      </div>
    </main>
  );
}
