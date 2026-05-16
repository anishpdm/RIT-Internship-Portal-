import { requireRole } from '@/lib/auth';
import { DashboardShell } from '@/components/DashboardShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireRole('admin');
  return (
    <DashboardShell
      role="admin"
      name={profile.full_name ?? 'Admin'}
      email={profile.email}
    >
      {children}
    </DashboardShell>
  );
}
