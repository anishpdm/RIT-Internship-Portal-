import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Stat, Pill } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { GraduationCap, Users, ShieldCheck, ClipboardCheck, ArrowRight, Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  const supabase = createClient();
  const [
    { count: internshipsCount },
    { count: studentsCount },
    { count: mentorsCount },
    { count: pendingSubsCount },
    { data: recentInternships },
    { data: recentLogs },
  ] = await Promise.all([
    supabase.from('internships').select('*', { count: 'exact', head: true }).neq('status', 'archived'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'mentor'),
    supabase.from('submissions').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'under_review']),
    supabase.from('internships').select('id,title,status,start_date,end_date,total_levels').order('created_at', { ascending: false }).limit(6),
    supabase.from('audit_logs').select('id,actor_role,action,entity_type,created_at').order('created_at', { ascending: false }).limit(8),
  ]);

  return (
    <div className="fade-in">
      {/* ── Hero banner ── */}
      <div className="relative rounded-2xl overflow-hidden mb-8 p-7"
        style={{ background: 'linear-gradient(135deg, #070d1f 0%, #1a1040 40%, #0c1630 100%)', boxShadow: '0 12px 48px rgba(99,102,241,.22)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 60% 100% at 95% 50%, rgba(99,102,241,.22) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 5% 80%, rgba(6,182,212,.12) 0%, transparent 60%)',
        }}/>
        {/* Grid pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}/>
        <div className="relative">
          <p className="text-xs font-bold tracking-[.15em] uppercase mb-2" style={{ color: '#818cf8' }}>Admin workspace</p>
          <h1 className="font-bold text-3xl text-white mb-1" style={{ letterSpacing: '-.03em' }}>RIT Internship Portal</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,.45)' }}>Manage cohorts, evaluate progress, and oversee the entire program</p>
          <div className="flex gap-3 mt-5 flex-wrap">
            <Link href="/admin/internships/new" className="btn btn-primary" style={{ fontSize: '.8rem' }}>
              + New Internship
            </Link>
            <Link href="/admin/students" className="btn" style={{ fontSize: '.8rem', background: 'rgba(255,255,255,.1)', color: 'white', borderColor: 'rgba(255,255,255,.15)' }}>
              View Students
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Active Internships" value={internshipsCount ?? 0} icon={GraduationCap} accent="#6366f1"/>
        <Stat label="Total Students"     value={studentsCount ?? 0}   icon={Users}          accent="#10b981"/>
        <Stat label="Mentors"            value={mentorsCount ?? 0}    icon={ShieldCheck}    accent="#06b6d4"/>
        <Stat label="Pending Review"     value={pendingSubsCount ?? 0} icon={ClipboardCheck} accent="#f59e0b"/>
      </div>

      {/* ── Two-col ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent internships */}
        <div className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow mb-0.5">Programs</p>
              <h2 className="font-display font-bold text-lg">Recent internships</h2>
            </div>
            <Link href="/admin/internships" className="btn btn-ghost text-xs gap-1">All <ArrowRight size={12}/></Link>
          </div>
          {recentInternships?.length ? (
            <div className="space-y-3">
              {recentInternships.map((i) => (
                <Link key={i.id} href={`/admin/internships/${i.id}`}
                  className="flex items-center justify-between gap-4 p-3 rounded-xl group transition-all"
                  style={{ border: '1.5px solid var(--ink-100)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(99,102,241,.25)'; (e.currentTarget as HTMLElement).style.background='var(--accent-soft)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--ink-100)'; (e.currentTarget as HTMLElement).style.background=''; }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--accent-soft), rgba(129,140,248,.15))' }}>
                      <GraduationCap size={15} style={{ color: 'var(--accent)' }}/>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{i.title}</p>
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{i.total_levels} levels · {i.start_date ?? '—'} → {i.end_date ?? '—'}</p>
                    </div>
                  </div>
                  <Pill tone={i.status === 'active' ? 'green' : 'accent'}>{i.status}</Pill>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-500)' }}>No internships yet.</p>
          )}
        </div>

        {/* Audit log */}
        <div className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow mb-0.5">Monitoring</p>
              <h2 className="font-display font-bold text-lg">Recent activity</h2>
            </div>
            <Link href="/admin/logs" className="btn btn-ghost text-xs gap-1">All <ArrowRight size={12}/></Link>
          </div>
          {recentLogs?.length ? (
            <div className="space-y-2.5">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'var(--ink-100)' }}>
                    <Activity size={12} style={{ color: 'var(--ink-500)' }}/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{log.action.replace(/\./g, ' › ')}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="pill" style={{ fontSize: '.65rem', padding: '.1rem .45rem' }}>{log.actor_role}</span>
                      <p className="text-xs" style={{ color: 'var(--ink-400)' }}>{formatDateTime(log.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-500)' }}>No recent activity.</p>
          )}
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Add Student',  href: '/admin/students',     icon: '👤', color: '#10b981' },
          { label: 'Add Mentor',   href: '/admin/mentors',      icon: '🎓', color: '#06b6d4' },
          { label: 'New Session',  href: '/admin/sessions/new', icon: '📅', color: '#6366f1' },
          { label: 'New Assignment', href: '/admin/assignments/new', icon: '📝', color: '#f59e0b' },
        ].map(q => (
          <Link key={q.href} href={q.href}
            className="card-hover card flex items-center gap-3 p-3.5"
            style={{ textDecoration: 'none' }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{ background: q.color + '18' }}>
              {q.icon}
            </div>
            <p className="font-semibold text-sm">{q.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
