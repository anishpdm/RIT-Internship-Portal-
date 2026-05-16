import { requireRole } from '@/lib/auth';
import { DashboardShell } from '@/components/DashboardShell';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireRole(['student', 'admin']);
  return (
    <DashboardShell
      role="student"
      name={profile.full_name ?? 'Student'}
      email={profile.email}
    >
      {children}
    </DashboardShell>
  );
}
