import { requireRole } from '@/lib/auth';
import { DashboardShell } from '@/components/DashboardShell';

export default async function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireRole(['mentor', 'admin']);
  return (
    <DashboardShell
      role="mentor"
      name={profile.full_name ?? 'Mentor'}
      email={profile.email}
    >
      {children}
    </DashboardShell>
  );
}
