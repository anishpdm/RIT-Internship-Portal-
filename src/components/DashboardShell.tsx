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
    // Capture user id so the audit endpoint can still attribute the event
    let userId: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {}

    // Log logout BEFORE signing out so the cookie is still valid
    try {
      await fetch('/api/auth/log-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'logout', user_id: userId }),
      });
    } catch {}

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

  const ROLE_COLORS: Record<UserRole, { from: string; to: string; badge: string }> = {
    admin: { from: '#f43f5e', to: '#fb7185', badge: '#fda4af' },
    mentor: { from: '#f59e0b', to: '#fbbf24', badge: '#fde68a' },
    student: { from: '#6366f1', to: '#818cf8', badge: '#c7d2fe' },
  };
  const rc = ROLE_COLORS[role];

  return (
    <div className="min-h-screen flex app-bg" style={{ background: undefined }}>
      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 no-print"
        style={{
          background: 'rgba(13,17,23,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg font-bold text-white text-xs"
            style={{ width: 30, height: 30, background: `linear-gradient(135deg, ${rc.from}, ${rc.to})`, boxShadow: `0 0 12px ${rc.from}55` }}
          >
            RIT
          </div>
          <span className="font-display text-sm font-semibold text-white">Internship Portal</span>
        </Link>
        <button onClick={() => setOpen(true)} className="p-2 rounded-lg text-white/70 hover:bg-white/10" aria-label="Open menu">
          <Menu size={20} />
        </button>
      </div>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 no-print"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'w-64 shrink-0 flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out no-print',
          'md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-5">
          <Link href="/" className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl font-bold text-white text-xs shrink-0"
              style={{
                width: 38, height: 38,
                background: `linear-gradient(135deg, ${rc.from}, ${rc.to})`,
                boxShadow: `0 0 20px ${rc.from}55`,
              }}
            >
              RIT
            </div>
            <div>
              <p className="font-display text-sm font-bold" style={{ color: 'white', lineHeight: 1.2 }}>
                Internship Portal
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: rc.badge + '22', color: rc.badge, border: `1px solid ${rc.badge}44`, letterSpacing: '0.04em' }}
                >
                  {ROLE_LABEL[role].toUpperCase()}
                </span>
              </div>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden absolute top-5 right-4 p-1 rounded-lg text-white/50 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav section label */}
        <p className="px-5 mb-2 text-[9px] font-semibold tracking-widest" style={{ color: 'var(--sidebar-text-muted)', letterSpacing: '0.12em' }}>
          NAVIGATION
        </p>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">
          {items.map((it) => {
            const Icon = it.icon;
            const active =
              pathname === it.href ||
              (it.href !== `/${role}` && pathname.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
                style={{
                  background: active ? `linear-gradient(90deg, ${rc.from}22, transparent)` : 'transparent',
                  borderLeft: active ? `2.5px solid ${rc.from}` : '2.5px solid transparent',
                  color: active ? 'white' : 'var(--sidebar-text)',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <Icon
                  size={16}
                  style={{ color: active ? rc.from : 'var(--sidebar-text-muted)', transition: 'color 150ms' }}
                />
                <span className="text-sm font-medium">{it.label}</span>
                {active && (
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: rc.from, boxShadow: `0 0 6px ${rc.from}` }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 12px 12px' }} />

        {/* User card */}
        <div className="px-3 pb-4">
          <div
            className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-3 mb-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 text-white"
                style={{
                  background: `linear-gradient(135deg, ${rc.from}, ${rc.to})`,
                  boxShadow: `0 4px 12px ${rc.from}55`,
                }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'white' }}>{name}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--sidebar-text-muted)' }}>{email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 w-full text-xs px-2.5 py-1.5 rounded-lg transition-all"
              style={{ color: 'var(--sidebar-text-muted)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)';
                (e.currentTarget as HTMLElement).style.color = '#fca5a5';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-muted)';
              }}
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>
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
