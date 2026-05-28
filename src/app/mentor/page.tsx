import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { Stat, Pill } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { Video, ArrowRight, Users, ClipboardCheck, Calendar, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MentorHomePage() {
  const me = await requireRole(['mentor', 'admin']);
  const supabase = createClient();

  const { data: assignments } = await supabase
    .from('mentor_assignments')
    .select('internship_id, internships:internship_id (id, title, status, total_levels)')
    .eq('mentor_id', me.userId);

  const internshipIds = assignments?.map((a: any) => a.internship_id).filter(Boolean) ?? [];

  let pendingCount = 0;
  if (internshipIds.length) {
    const { count } = await supabase
      .from('submissions').select('id, assignments!inner(internship_id)', { count: 'exact', head: true })
      .in('assignments.internship_id', internshipIds).in('status', ['submitted', 'under_review']);
    pendingCount = count ?? 0;
  }

  let upcoming: any[] = [];
  if (internshipIds.length) {
    const { data } = await supabase
      .from('sessions').select('id,title,scheduled_at,duration_minutes,session_type,status,meeting_url,internships:internship_id(title)')
      .in('internship_id', internshipIds).gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true }).limit(5);
    upcoming = data ?? [];
  }

  let studentCount = 0;
  if (internshipIds.length) {
    const { count } = await supabase
      .from('enrollments').select('*', { count: 'exact', head: true }).in('internship_id', internshipIds);
    studentCount = count ?? 0;
  }

  const firstName = me.profile?.full_name?.split(' ')[0] ?? 'Mentor';

  return (
    <div className="fade-in">
      {/* ── Hero banner ── */}
      <div className="relative rounded-2xl overflow-hidden mb-8 p-7"
        style={{ background: 'linear-gradient(135deg, #1a0c00 0%, #2d1800 40%, #1a1000 100%)', boxShadow: '0 12px 48px rgba(245,158,11,.16)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 60% 100% at 95% 50%, rgba(245,158,11,.20) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 5% 80%, rgba(251,191,36,.08) 0%, transparent 60%)',
        }}/>
        <div className="absolute inset-0 pointer-events-none opacity-[.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}/>
        <div className="relative">
          <p className="text-xs font-bold tracking-[.15em] uppercase mb-2" style={{ color: '#fbbf24' }}>Mentor workspace</p>
          <h1 className="font-bold text-3xl text-white mb-1" style={{ letterSpacing: '-.03em' }}>
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,.45)' }}>
            {internshipIds.length} internship{internshipIds.length !== 1 ? 's' : ''} · {studentCount} students · {pendingCount} pending review
          </p>
          <div className="flex gap-3 mt-5 flex-wrap">
            <Link href="/mentor/evaluate" className="btn" style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', color: 'white', fontSize: '.8rem', boxShadow: '0 4px 14px rgba(245,158,11,.35)', border: 'none' }}>
              Review Submissions
            </Link>
            <Link href="/mentor/sessions/new" className="btn" style={{ fontSize: '.8rem', background: 'rgba(255,255,255,.1)', color: 'white', borderColor: 'rgba(255,255,255,.15)' }}>
              + New Session
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Internships"        value={internshipIds.length} icon={<TrendingUp    size={20} color="#f59e0b"/>} accent="#f59e0b"/>
        <Stat label="Students"           value={studentCount}         icon={<Users          size={20} color="#10b981"/>} accent="#10b981"/>
        <Stat label="Pending Review"     value={pendingCount}         icon={<ClipboardCheck size={20} color="#ef4444"/>} accent="#ef4444"/>
        <Stat label="Upcoming Sessions"  value={upcoming.length}      icon={<Calendar       size={20} color="#6366f1"/>} accent="#6366f1"/>
      </div>

      {/* ── Two-col ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming sessions */}
        <div className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow mb-0.5">Schedule</p>
              <h2 className="font-display font-bold text-lg">Upcoming sessions</h2>
            </div>
            <Link href="/mentor/sessions" className="btn btn-ghost text-xs gap-1">All <ArrowRight size={12}/></Link>
          </div>
          {upcoming.length ? (
            <div className="space-y-3">
              {upcoming.map((s) => {
                const startsAt = new Date(s.scheduled_at).getTime();
                const now = Date.now();
                const endsAt = startsAt + (s.duration_minutes ?? 60) * 60000;
                const isLive = now >= startsAt && now <= endsAt;
                const minsUntil = Math.round((startsAt - now) / 60000);
                return (
                  <div key={s.id} className="p-3.5 rounded-xl" style={{
                    background: isLive ? 'linear-gradient(135deg,rgba(16,185,129,.08),rgba(16,185,129,.03))' : 'var(--ink-50)',
                    border: `1.5px solid ${isLive ? 'rgba(16,185,129,.3)' : 'var(--ink-100)'}`,
                  }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-sm truncate">{s.title}</p>
                          {isLive && <span className="pill pill-green" style={{ fontSize: '.65rem' }}>● Live</span>}
                        </div>
                        <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                          {(s.internships as any)?.title} ·{' '}
                          {isLive ? 'Happening now' : minsUntil < 60 ? `in ${minsUntil}m` : formatDateTime(s.scheduled_at)}
                        </p>
                      </div>
                      {s.meeting_url && (
                        <a href={s.meeting_url} target="_blank" rel="noopener noreferrer"
                          className="btn shrink-0" style={{ fontSize: '.75rem', padding: '.4rem .7rem', background: isLive ? '#10b981' : 'var(--accent)', color: 'white', border: 'none' }}>
                          <Video size={12}/> {isLive ? 'Join' : 'Link'}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-500)' }}>No upcoming sessions scheduled.</p>
          )}
        </div>

        {/* Internships */}
        <div className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow mb-0.5">Programs</p>
              <h2 className="font-display font-bold text-lg">My internships</h2>
            </div>
            <Link href="/mentor/performance" className="btn btn-ghost text-xs gap-1">Leaderboard <ArrowRight size={12}/></Link>
          </div>
          {assignments?.length ? (
            <div className="space-y-3">
              {assignments.map((a: any) => {
                const i = a.internships;
                if (!i) return null;
                return (
                  <Link key={a.internship_id} href={`/mentor/performance/${a.internship_id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover-amber group"
                    style={{ border: '1.5px solid var(--ink-100)', textDecoration: 'none' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, rgba(245,158,11,.15), rgba(251,191,36,.08))' }}>
                      <span style={{ fontSize: '1.2rem' }}>🎓</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{i.title}</p>
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{i.total_levels} levels</p>
                    </div>
                    <Pill tone={i.status === 'active' ? 'green' : 'accent'}>{i.status}</Pill>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-500)' }}>No internships assigned yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
