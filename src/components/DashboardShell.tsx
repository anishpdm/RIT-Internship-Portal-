'use client';

import { useState, useEffect } from 'react';
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
  BookOpen,
  LogOut,
  FileCheck,
  FileText,
  ShieldCheck,
  TrendingUp,
  Trophy,
  Settings,
  Menu,
  X,
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
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ],
  mentor: [
    { href: '/mentor', label: 'Overview', icon: LayoutDashboard },
    { href: '/mentor/performance', label: 'Internships', icon: GraduationCap },
    { href: '/mentor/students', label: 'Students', icon: Users },
    { href: '/mentor/sessions', label: 'Sessions', icon: Calendar },
    { href: '/mentor/assignments', label: 'Assignments', icon: ClipboardCheck },
    { href: '/mentor/evaluate', label: 'Evaluate', icon: FileCheck },
    { href: '/mentor/logs', label: 'Activity', icon: ScrollText },
    { href: '/mentor/settings', label: 'Settings', icon: Settings },
  ],
  student: [
    { href: '/student', label: 'Overview', icon: LayoutDashboard },
    { href: '/student/sessions', label: 'Sessions', icon: Calendar },
    { href: '/student/assignments', label: 'Assignments', icon: BookOpen },
    { href: '/student/library', label: 'Library', icon: FileText },
    { href: '/student/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/student/profile', label: 'Account', icon: Settings },
  ],
};

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  mentor: 'Mentor',
  student: 'Student',
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
  const [open, setOpen] = useState(false);

  // Close drawer when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = (name || email || 'U')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 no-print"
        style={{
          background: 'var(--paper)',
          borderBottom: '1px solid var(--ink-200)',
        }}
      >
        <Link href="/" className="flex items-center gap-2">
          <span className="brand-mark" style={{ width: 28, height: 28, fontSize: '0.65rem' }}>
            RIT
          </span>
          <span className="font-display text-sm font-semibold">
            Internship Portal
          </span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="btn btn-ghost p-2"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Backdrop on mobile */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 no-print"
          style={{ background: 'rgba(15, 23, 42, 0.5)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'w-64 shrink-0 flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out no-print',
          'md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ background: 'var(--sidebar-bg)' }}
      >
        {/* Brand */}
        <div
          className="px-5 py-5 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Link href="/" className="flex items-center gap-3">
            <span className="brand-mark">RIT</span>
            <div>
              <p
                className="font-display text-sm font-semibold leading-tight"
                style={{ color: 'white' }}
              >
                Internship Portal
              </p>
              <p
                className="text-[10px]"
                style={{ color: 'var(--sidebar-text-muted)' }}
              >
                {ROLE_LABEL[role]} workspace
              </p>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden text-white p-1 rounded hover:bg-white/10"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
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
                  'flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-all',
                  active ? 'nav-active' : '',
                )}
                style={{
                  color: active ? 'white' : 'var(--sidebar-text)',
                }}
              >
                <Icon size={16} />
                <span className="font-medium">{it.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div
          className="px-3 py-4 mx-2 mb-3 rounded-lg"
          style={{ background: 'var(--sidebar-bg-hover)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, #818cf8 100%)',
                color: 'white',
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-medium truncate"
                style={{ color: 'white' }}
              >
                {name}
              </p>
              <p
                className="text-[11px] truncate"
                style={{ color: 'var(--sidebar-text-muted)' }}
              >
                {email}
              </p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 w-full text-xs px-2 py-1.5 rounded transition-colors"
            style={{ color: 'var(--sidebar-text)' }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                'rgba(255,255,255,0.05)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                'transparent')
            }
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-64 min-w-0 w-full">
        <div className="px-4 sm:px-6 md:px-10 lg:px-12 pt-16 md:pt-10 pb-10 max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  );
}
