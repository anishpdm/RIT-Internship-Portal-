'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';
import {
  LayoutDashboard, GraduationCap, Users, Calendar,
  ClipboardCheck, ScrollText, BookOpen, LogOut,
  FileCheck, FileText, ShieldCheck, TrendingUp, Trophy,
  Settings, Menu, X, ChevronLeft, ChevronRight,
  Bell, Search, type LucideIcon,
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
    { href: '/student',            label: 'Overview',    icon: LayoutDashboard },
    { href: '/student/sessions',   label: 'Sessions',    icon: Calendar },
    { href: '/student/assignments',label: 'Assignments', icon: BookOpen },
    { href: '/student/library',    label: 'Library',     icon: FileText },
    { href: '/student/leaderboard',label: 'Leaderboard', icon: Trophy },
    { href: '/student/profile',    label: 'Account',     icon: Settings },
  ],
};

const ROLE_META: Record<UserRole, {
  label: string; from: string; to: string;
  glow: string; badge: string; navSection: string;
}> = {
  admin:   { label: 'Admin',   from: '#f43f5e', to: '#fb923c', glow: 'rgba(244,63,94,.30)',   badge: '#fda4af', navSection: 'Management' },
  mentor:  { label: 'Mentor',  from: '#f59e0b', to: '#fbbf24', glow: 'rgba(245,158,11,.30)',  badge: '#fde68a', navSection: 'Teaching' },
  student: { label: 'Student', from: '#6366f1', to: '#818cf8', glow: 'rgba(99,102,241,.30)',  badge: '#c7d2fe', navSection: 'Learning' },
};

const SIDEBAR_W    = 272;
const SIDEBAR_MINI = 72;

export function DashboardShell({ role, name, email, children }: {
  role: UserRole; name: string; email: string; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();
  const items    = NAV[role];
  const rm       = ROLE_META[role];

  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  async function signOut() {
    let userId: string | null = null;
    try { const { data } = await supabase.auth.getUser(); userId = data.user?.id ?? null; } catch {}
    try {
      await fetch('/api/auth/log-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'logout', user_id: userId }) });
    } catch {}
    await supabase.auth.signOut();
    router.push('/login'); router.refresh();
  }

  const initials = (name || email || 'U').split(' ').map(p => p[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
  const sidebarW = collapsed ? SIDEBAR_MINI : SIDEBAR_W;

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-3" style={{ minHeight: 72 }}>
        <div
          className="shrink-0 rounded-xl flex items-center justify-center font-black text-white text-xs"
          style={{
            width: 40, height: 40,
            background: `linear-gradient(135deg, ${rm.from}, ${rm.to})`,
            boxShadow: `0 0 20px ${rm.glow}`,
            fontSize: '0.7rem', letterSpacing: '.04em',
          }}
        >
          RIT
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm leading-tight" style={{ color: 'white', letterSpacing: '-.015em' }}>
              Internship Portal
            </p>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
              style={{ background: `${rm.from}28`, color: rm.badge, border: `1px solid ${rm.from}44`, letterSpacing: '.06em' }}
            >
              {rm.label.toUpperCase()}
            </span>
          </div>
        )}
        {/* Collapse toggle — desktop */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden md:flex shrink-0 items-center justify-center rounded-lg transition-all ml-auto"
          style={{
            width: 28, height: 28,
            background: 'rgba(255,255,255,.07)',
            color: 'rgba(255,255,255,.45)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.12)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.45)'; }}
        >
          {collapsed ? <ChevronRight size={13}/> : <ChevronLeft size={13}/>}
        </button>
        {/* Close on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden shrink-0 flex items-center justify-center rounded-lg"
          style={{ width: 28, height: 28, background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.5)' }}
        >
          <X size={14}/>
        </button>
      </div>

      {/* Section label */}
      {!collapsed && (
        <p className="px-5 mb-2 text-[9px] font-bold tracking-[.12em]" style={{ color: 'rgba(255,255,255,.22)' }}>
          {rm.navSection.toUpperCase()}
        </p>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-0.5">
        {items.map(it => {
          const Icon = it.icon;
          const active = pathname === it.href || (it.href !== `/${role}` && pathname.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              title={collapsed ? it.label : undefined}
              className={cn('flex items-center gap-3 rounded-xl transition-all group relative', collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5')}
              style={{
                background: active ? `linear-gradient(90deg, ${rm.from}28, ${rm.to}14)` : 'transparent',
                borderLeft: active && !collapsed ? `2.5px solid ${rm.from}` : '2.5px solid transparent',
                color: active ? 'white' : 'rgba(255,255,255,.55)',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.06)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Icon size={16} style={{ color: active ? rm.from : 'rgba(255,255,255,.4)', flexShrink: 0 }}/>
              {!collapsed && <span className="text-sm font-medium">{it.label}</span>}
              {active && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: rm.from, boxShadow: `0 0 8px ${rm.from}` }}/>
              )}
              {/* Tooltip when collapsed */}
              {collapsed && (
                <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                  style={{ background: 'rgba(0,0,0,.85)', color: 'white', backdropFilter: 'blur(8px)' }}>
                  {it.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '0 12px 12px' }}/>

      {/* User card */}
      <div className={cn('pb-4', collapsed ? 'px-2.5' : 'px-3')}>
        <div
          className="rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <div className={cn('flex items-center gap-2.5', collapsed ? 'justify-center' : 'mb-2.5')}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 text-white"
              style={{ background: `linear-gradient(135deg, ${rm.from}, ${rm.to})`, boxShadow: `0 4px 14px ${rm.glow}` }}
            >
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'white' }}>{name}</p>
                <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,.38)' }}>{email}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 w-full text-xs px-2 py-1.5 rounded-lg transition-all"
              style={{ color: 'rgba(255,255,255,.35)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,.12)'; (e.currentTarget as HTMLElement).style.color='#fca5a5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,.35)'; }}
            >
              <LogOut size={11}/> Sign out
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="app-bg min-h-screen flex" style={{ fontFamily: 'Inter,sans-serif' }}>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 no-print" onClick={() => setMobileOpen(false)}
          style={{ background: 'rgba(7,13,31,.70)', backdropFilter: 'blur(4px)' }}/>
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-out no-print',
          'md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        style={{
          width: SIDEBAR_W, // always full on mobile drawer; width controlled on desktop via collapsed class
          background: 'linear-gradient(180deg, #070d1f 0%, #0d1530 100%)',
          borderRight: '1px solid rgba(255,255,255,.05)',
          boxShadow: '4px 0 32px rgba(0,0,0,.28)',
        }}
      >
        {/* On desktop, the sidebar animates its width */}
        <div className="hidden md:flex flex-col flex-1 overflow-hidden transition-all duration-300"
          style={{ width: sidebarW }}>
          <SidebarContent/>
        </div>
        {/* On mobile, full-width drawer always shows */}
        <div className="flex md:hidden flex-col flex-1 overflow-hidden" style={{ width: SIDEBAR_W }}>
          <SidebarContent/>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div
        className="flex-1 min-w-0 flex flex-col transition-all duration-300"
        style={{ marginLeft: 0 }}
      >
        {/* Desktop margin */}
        <style>{`
          @media (min-width: 768px) {
            .main-content { margin-left: ${sidebarW}px !important; }
          }
        `}</style>

        <div className="main-content flex-1 flex flex-col">

          {/* ── Top navbar ── */}
          <header
            className="sticky top-0 z-30 no-print flex items-center gap-4 px-4 sm:px-6"
            style={{
              height: 'var(--topbar-h)',
              background: 'rgba(242,244,251,.88)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              borderBottom: '1px solid rgba(226,232,240,.7)',
              boxShadow: '0 1px 12px rgba(15,23,42,.06)',
            }}
          >
            {/* Mobile menu button */}
            <button
              className="md:hidden flex items-center justify-center rounded-xl"
              onClick={() => setMobileOpen(true)}
              style={{ width: 38, height: 38, background: 'var(--ink-100)', color: 'var(--ink-700)' }}
            >
              <Menu size={18}/>
            </button>

            {/* Search */}
            <div className="flex-1 max-w-sm hidden sm:flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
              style={{ background: 'white', border: '1.5px solid var(--ink-200)', boxShadow: 'var(--s-xs)' }}>
              <Search size={14} style={{ color: 'var(--ink-400)', flexShrink: 0 }}/>
              <span className="text-sm" style={{ color: 'var(--ink-400)' }}>Quick search…</span>
              <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'var(--ink-100)', color: 'var(--ink-500)' }}>⌘K</span>
            </div>

            <div className="flex-1"/>

            {/* Notifications */}
            <button
              className="relative flex items-center justify-center rounded-xl transition-all"
              style={{ width: 40, height: 40, background: 'white', border: '1.5px solid var(--ink-200)', boxShadow: 'var(--s-xs)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--ink-200)'; }}
            >
              <Bell size={16} style={{ color: 'var(--ink-600)' }}/>
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                style={{ background: 'linear-gradient(135deg, var(--accent), #818cf8)' }}>3</span>
            </button>

            {/* Profile pill */}
            <div
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 cursor-pointer transition-all"
              style={{ background: 'white', border: '1.5px solid var(--ink-200)', boxShadow: 'var(--s-xs)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--ink-200)'; }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[10px]"
                style={{ background: `linear-gradient(135deg, ${rm.from}, ${rm.to})`, boxShadow: `0 2px 8px ${rm.glow}` }}
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
    </div>
  );
}
