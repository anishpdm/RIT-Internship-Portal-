'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  Calendar,
  ClipboardCheck,
  ScrollText,
  UserCircle2,
  BookOpen,
  LogOut,
  FileCheck,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: Record<UserRole, NavItem[]> = {
  admin: [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/internships', label: 'Internships', icon: GraduationCap },
    { href: '/admin/students', label: 'Students', icon: Users },
    { href: '/admin/mentors', label: 'Mentors', icon: ShieldCheck },
    { href: '/admin/sessions', label: 'Sessions', icon: Calendar },
    { href: '/admin/assignments', label: 'Assignments', icon: ClipboardCheck },
    { href: '/admin/submissions', label: 'Submissions', icon: FileCheck },
    { href: '/admin/logs', label: 'Audit logs', icon: ScrollText },
  ],
  mentor: [
    { href: '/mentor', label: 'Overview', icon: LayoutDashboard },
    { href: '/mentor/students', label: 'Students', icon: Users },
    { href: '/mentor/sessions', label: 'Sessions', icon: Calendar },
    { href: '/mentor/assignments', label: 'Assignments', icon: ClipboardCheck },
    { href: '/mentor/evaluate', label: 'Evaluate', icon: FileCheck },
  ],
  student: [
    { href: '/student', label: 'Overview', icon: LayoutDashboard },
    { href: '/student/sessions', label: 'Sessions', icon: Calendar },
    { href: '/student/assignments', label: 'Assignments', icon: BookOpen },
    { href: '/student/profile', label: 'Profile', icon: UserCircle2 },
  ],
};

export function DashboardShell({
  role,
  name,
  email,
  children,
}: {
  role: UserRole;
  name: string;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const items = NAV[role];

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen paper flex">
      {/* Sidebar */}
      <aside
        className="w-64 shrink-0 flex flex-col"
        style={{
          background: 'var(--paper)',
          borderRight: '1px solid var(--ink-100)',
        }}
      >
        <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--ink-100)' }}>
          <Link href="/" className="font-display text-xl font-semibold inline-flex items-center gap-2">
            <span
              className="w-7 h-7 inline-flex items-center justify-center text-white text-sm"
              style={{ background: 'var(--ink-900)' }}
            >
              F
            </span>
            ForgeML
          </Link>
          <p className="mt-3 text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
            {role} portal
          </p>
        </div>

        <nav className="flex-1 py-4">
          {items.map((it) => {
            const Icon = it.icon;
            const active =
              pathname === it.href ||
              (it.href !== `/${role}` && pathname.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  'flex items-center gap-3 px-5 py-2.5 text-sm transition-colors',
                  active ? 'nav-active font-medium' : 'text-ink-700 hover:bg-ink-100'
                )}
                style={{
                  color: active ? 'var(--ink-900)' : 'var(--ink-700)',
                  background: active ? 'var(--bg)' : 'transparent',
                }}
              >
                <Icon size={16} />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div
          className="px-5 py-4 text-xs"
          style={{ borderTop: '1px solid var(--ink-100)' }}
        >
          <p className="font-medium" style={{ color: 'var(--ink-900)' }}>{name}</p>
          <p style={{ color: 'var(--ink-500)' }} className="truncate">{email}</p>
          <button onClick={signOut} className="btn btn-ghost mt-3 -ml-3">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-auto">
        <div className="px-8 md:px-12 py-10 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
