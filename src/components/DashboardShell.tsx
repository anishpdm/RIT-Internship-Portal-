'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';
import NotificationBell from '@/components/NotificationBell';
import {
  LayoutDashboard, GraduationCap, Users, Calendar,
  ClipboardCheck, ScrollText, BookOpen, LogOut,
  FileCheck, FileText, ShieldCheck, Trophy,
  Settings, Menu, X, ChevronLeft, ChevronRight,
  Search, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem { href: string; label: string; icon: LucideIcon; }

const NAV: Record<UserRole, NavItem[]> = {
  admin: [
    { href: '/admin',              label: 'Overview',    icon: LayoutDashboard },
    { href: '/admin/internships',  label: 'Internships', icon: GraduationCap },
    { href: '/admin/students',     label: 'Students',    icon: Users },
    { href: '/admin/mentors',      label: 'Mentors',     icon: ShieldCheck },
    { href: '/admin/sessions',     label: 'Sessions',    icon: Calendar },
    { href: '/admin/assignments',  label: 'Assignments', icon: ClipboardCheck },
    { href: '/admin/submissions',  label: 'Submissions', icon: FileCheck },
    { href: '/admin/logs',         label: 'Audit logs',  icon: ScrollText },
    { href: '/admin/settings',     label: 'Settings',    icon: Settings },
  ],
  mentor: [
    { href: '/mentor',             label: 'Overview',    icon: LayoutDashboard },
    { href: '/mentor/performance', label: 'Internships', icon: GraduationCap },
    { href: '/mentor/students',    label: 'Students',    icon: Users },
    { href: '/mentor/sessions',    label: 'Sessions',    icon: Calendar },
    { href: '/mentor/assignments', label: 'Assignments', icon: ClipboardCheck },
    { href: '/mentor/evaluate',    label: 'Evaluate',    icon: FileCheck },
    { href: '/mentor/logs',        label: 'Activity',    icon: ScrollText },
    { href: '/mentor/settings',    label: 'Settings',    icon: Settings },
  ],
  student: [
    { href: '/student',             label: 'Overview',    icon: LayoutDashboard },
    { href: '/student/sessions',    label: 'Sessions',    icon: Calendar },
    { href: '/student/assignments', label: 'Assignments', icon: BookOpen },
    { href: '/student/library',     label: 'Library',     icon: FileText },
    { href: '/student/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/student/profile',     label: 'Account',     icon: Settings },
  ],
};

const ROLE_META: Record<UserRole, {
  label: string; from: string; to: string; glow: string; badge: string;
}> = {
  admin:   { label: 'Admin',   from: '#f43f5e', to: '#fb923c', glow: 'rgba(244,63,94,.28)',  badge: '#fda4af' },
  mentor:  { label: 'Mentor',  from: '#f59e0b', to: '#fbbf24', glow: 'rgba(245,158,11,.28)', badge: '#fde68a' },
  student: { label: 'Student', from: '#6366f1', to: '#818cf8', glow: 'rgba(99,102,241,.28)', badge: '#c7d2fe' },
};

const SIDEBAR_W    = 272;
const SIDEBAR_MINI = 72;

export function DashboardShell({
  role, name, email, children,
}: {
  role: UserRole; name: string; email: string; children: React.ReactNode;
}) {
  const pathname  = usePathname();
  const router    = useRouter();
  const supabase  = createClient();
  const items     = NAV[role];
  const rm        = ROLE_META[role];

  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Update main margin imperatively — avoids <style> tag SSR mismatch
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.style.marginLeft =
        window.innerWidth >= 768
          ? `${collapsed ? SIDEBAR_MINI : SIDEBAR_W}px`
          : '0px';
    }
  }, [collapsed]);

  async function signOut() {
    let userId: string | null = null;
    try { const { data } = await supabase.auth.getUser(); userId = data.user?.id ?? null; } catch {}
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
    .split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const sidebarPx = collapsed ? SIDEBAR_MINI : SIDEBAR_W;

  return (
    <div className="app-bg min-h-screen flex">

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 no-print"
          onClick={() => setMobileOpen(false)}
          style={{ background: 'rgba(7,13,31,.70)', backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col no-print',
          'transition-all duration-300 ease-out',
          // mobile: show/hide via transform
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        style={{
          width: SIDEBAR_W,
          background: 'linear-gradient(180deg,#070d1f 0%,#0d1530 100%)',
          borderRight: '1px solid rgba(255,255,255,.05)',
          boxShadow: '4px 0 32px rgba(0,0,0,.28)',
        }}
      >
        {/* Scrollable inner wrapper — collapses on desktop */}
        <div
          className="flex flex-col flex-1 overflow-hidden transition-all duration-300 hidden md:flex"
          style={{ width: sidebarPx }}
        >
          <SidebarInner
            rm={rm} role={role} items={items} pathname={pathname}
            collapsed={collapsed} initials={initials} name={name} email={email}
            onCollapse={() => setCollapsed(c => !c)}
            onClose={() => setMobileOpen(false)}
            onSignOut={signOut}
          />
        </div>
        {/* Mobile always shows full width */}
        <div className="flex flex-col flex-1 overflow-hidden md:hidden" style={{ width: SIDEBAR_W }}>
          <SidebarInner
            rm={rm} role={role} items={items} pathname={pathname}
            collapsed={false} initials={initials} name={name} email={email}
            onCollapse={() => setCollapsed(c => !c)}
            onClose={() => setMobileOpen(false)}
            onSignOut={signOut}
          />
        </div>
      </aside>

      {/* ── Content area ── */}
      <div
        ref={mainRef}
        className="flex-1 min-w-0 flex flex-col transition-all duration-300"
        style={{ marginLeft: 0 }} // updated imperatively in useEffect
      >
        {/* ── Top navbar ── */}
        <header
          className="sticky top-0 z-30 no-print flex items-center gap-3 px-4 sm:px-6"
          style={{
            height: 64,
            background: 'rgba(242,244,251,.92)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderBottom: '1px solid rgba(226,232,240,.75)',
            boxShadow: '0 1px 12px rgba(15,23,42,.06)',
          }}
        >
          {/* Hamburger — mobile */}
          <button
            className="md:hidden flex items-center justify-center rounded-xl shrink-0"
            onClick={() => setMobileOpen(true)}
            style={{ width: 38, height: 38, background: 'var(--ink-100)', color: 'var(--ink-700)' }}
          >
            <Menu size={18} />
          </button>

          {/* Search bar */}
          <div
            className="hidden sm:flex items-center gap-2 rounded-xl px-3 py-2 flex-1 max-w-xs"
            style={{ background: 'white', border: '1.5px solid var(--ink-200)', boxShadow: 'var(--s-xs)', cursor: 'text' }}
          >
            <Search size={13} style={{ color: 'var(--ink-400)', flexShrink: 0 }} />
            <span className="text-sm flex-1" style={{ color: 'var(--ink-400)' }}>Quick search…</span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}
            >⌘K</span>
          </div>

          <div className="flex-1" />
          <NotificationBell />

          {/* Profile pill */}
          <div
            className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 shrink-0"
            style={{ background: 'white', border: '1.5px solid var(--ink-200)', boxShadow: 'var(--s-xs)', cursor: 'pointer' }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[10px] shrink-0"
              style={{ background: `linear-gradient(135deg,${rm.from},${rm.to})`, boxShadow: `0 2px 8px ${rm.glow}` }}
            >
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--ink-900)' }}>
                {name.split(' ')[0]}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--ink-500)' }}>{rm.label}</p>
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 px-4 sm:px-6 md:px-8 lg:px-10 pt-8 pb-12 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ─── Sidebar inner (extracted so it's not defined inside render) ─── */
function SidebarInner({
  rm, role, items, pathname, collapsed, initials, name, email,
  onCollapse, onClose, onSignOut,
}: {
  rm: typeof ROLE_META[UserRole];
  role: UserRole;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
  initials: string;
  name: string;
  email: string;
  onCollapse: () => void;
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      {/* Brand header */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-3 shrink-0" style={{ minHeight: 68 }}>
        <div
          className="shrink-0 rounded-xl flex items-center justify-center font-black text-white"
          style={{
            width: 38, height: 38, fontSize: '.68rem', letterSpacing: '.05em',
            background: `linear-gradient(135deg,${rm.from},${rm.to})`,
            boxShadow: `0 0 18px ${rm.glow}`,
          }}
        >
          RIT
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="font-bold text-sm leading-tight truncate" style={{ color: 'white', letterSpacing: '-.015em' }}>
              Internship Portal
            </p>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
              style={{ background: `${rm.from}28`, color: rm.badge, border: `1px solid ${rm.from}44`, letterSpacing: '.07em' }}
            >
              {rm.label.toUpperCase()}
            </span>
          </div>
        )}

        {/* Collapse toggle — desktop */}
        <button
          onClick={onCollapse}
          className="hidden md:flex shrink-0 items-center justify-center rounded-lg ml-auto"
          style={{ width: 26, height: 26, background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.4)' }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Close — mobile */}
        <button
          onClick={onClose}
          className="md:hidden shrink-0 flex items-center justify-center rounded-lg"
          style={{ width: 26, height: 26, background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.4)' }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Section label */}
      {!collapsed && (
        <p className="px-5 mb-1.5 text-[9px] font-bold" style={{ color: 'rgba(255,255,255,.20)', letterSpacing: '.12em' }}>
          NAVIGATION
        </p>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto pb-4 space-y-0.5" style={{ padding: collapsed ? '0 10px' : '0 10px' }}>
        {items.map(it => {
          const Icon = it.icon;
          const active =
            pathname === it.href ||
            (it.href !== `/${role}` && pathname.startsWith(it.href));

          return (
            <Link
              key={it.href}
              href={it.href}
              title={collapsed ? it.label : undefined}
              className={cn(
                'relative flex items-center rounded-xl transition-all duration-150 group',
                collapsed ? 'justify-center py-3 px-0' : 'gap-3 px-3 py-2.5',
              )}
              style={{
                background: active
                  ? `linear-gradient(90deg,${rm.from}28,${rm.to}14)`
                  : 'transparent',
                borderLeft: active && !collapsed
                  ? `2.5px solid ${rm.from}`
                  : '2.5px solid transparent',
                color: active ? 'white' : 'rgba(255,255,255,.52)',
              }}
            >
              <Icon
                size={16}
                style={{ color: active ? rm.from : 'rgba(255,255,255,.38)', flexShrink: 0 }}
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{it.label}</span>
              )}
              {active && !collapsed && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: rm.from, boxShadow: `0 0 8px ${rm.from}` }}
                />
              )}
              {/* Tooltip when collapsed */}
              {collapsed && (
                <span
                  className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,.88)', color: 'white' }}
                >
                  {it.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '0 12px 12px' }} />

      {/* User card */}
      <div className="pb-4 shrink-0" style={{ padding: collapsed ? '0 10px 16px' : '0 12px 16px' }}>
        <div
          className="rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <div className={cn('flex items-center gap-2.5', collapsed ? 'justify-center' : 'mb-2.5')}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 text-white"
              style={{
                background: `linear-gradient(135deg,${rm.from},${rm.to})`,
                boxShadow: `0 4px 14px ${rm.glow}`,
              }}
            >
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-sm font-semibold truncate" style={{ color: 'white' }}>{name}</p>
                <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,.35)' }}>{email}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 w-full text-xs px-2 py-1.5 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,.32)' }}
              onMouseEnter={e => {
                (e.currentTarget).style.background = 'rgba(239,68,68,.12)';
                (e.currentTarget).style.color = '#fca5a5';
              }}
              onMouseLeave={e => {
                (e.currentTarget).style.background = 'transparent';
                (e.currentTarget).style.color = 'rgba(255,255,255,.32)';
              }}
            >
              <LogOut size={11} /> Sign out
            </button>
          )}
        </div>
      </div>
    </>
  );
}
