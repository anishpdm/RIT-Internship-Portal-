import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { Stat, Pill } from '@/components/ui';
import { formatDateTime, relativeTime } from '@/lib/utils';
import { BookOpen, Calendar, Trophy, ArrowRight, Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function StudentHomePage() {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id,current_level,status,total_score,internship_id,internships:internship_id(id,title,status,total_levels)')
    .eq('student_id', me.userId);

  const internshipIds = enrollments?.map((e: any) => e.internship_id) ?? [];

  let upcoming: any[] = [];
  if (internshipIds.length) {
    const { data } = await supabase
      .from('sessions').select('id,title,session_type,scheduled_at,status,meeting_url,internships:internship_id(title)')
      .in('internship_id', internshipIds).gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true }).limit(5);
    upcoming = data ?? [];
  }

  let pending: any[] = [];
  if (internshipIds.length) {
    const { data: allA } = await supabase
      .from('assignments').select('id,title,kind,due_at,max_score,internships:internship_id(title)')
      .in('internship_id', internshipIds).order('due_at', { ascending: true, nullsFirst: false });
    const { data: mySubs } = await supabase
      .from('submissions').select('assignment_id').eq('student_id', me.userId);
    const submittedIds = new Set((mySubs ?? []).map((s: any) => s.assignment_id));
    pending = (allA ?? []).filter((a: any) => !submittedIds.has(a.id)).slice(0, 5);
  }

  const avgScore = enrollments?.length
    ? (enrollments.reduce((s: number, e: any) => s + Number(e.total_score ?? 0), 0) / enrollments.length).toFixed(1)
    : '0.0';

  const firstName = me.profile?.full_name?.split(' ')[0] ?? 'Student';

  const SCORE_COLOR = (s: number) =>
    s >= 85 ? '#10b981' : s >= 65 ? '#6366f1' : s >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="fade-in">
      {/* ── Hero banner ── */}
      <div className="relative rounded-2xl overflow-hidden mb-8 p-7"
        style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #1a1560 40%, #0c102e 100%)', boxShadow: '0 12px 48px rgba(99,102,241,.24)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 60% 100% at 100% 50%, rgba(99,102,241,.30) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 0% 80%, rgba(6,182,212,.12) 0%, transparent 60%)',
        }}/>
        <div className="absolute inset-0 pointer-events-none opacity-[.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}/>
        <div className="relative flex items-center justify-between flex-wrap gap-6">
          <div>
            <p className="text-xs font-bold tracking-[.15em] uppercase mb-2" style={{ color: '#818cf8' }}>Student portal</p>
            <h1 className="font-bold text-3xl text-white mb-1" style={{ letterSpacing: '-.03em' }}>
              Hello, {firstName} 👋
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,.45)' }}>
              {enrollments?.length ?? 0} internship{enrollments?.length !== 1 ? 's' : ''} · {pending.length} pending tasks
            </p>
            <div className="flex gap-3 mt-5 flex-wrap">
              <Link href="/student/assignments" className="btn btn-primary" style={{ fontSize: '.8rem' }}>
                My Assignments
              </Link>
              <Link href="/student/leaderboard" className="btn" style={{ fontSize: '.8rem', background: 'rgba(255,255,255,.1)', color: 'white', borderColor: 'rgba(255,255,255,.15)' }}>
                <Trophy size={14}/> Leaderboard
              </Link>
            </div>
          </div>
          {/* Score orb */}
          <div className="shrink-0 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full flex flex-col items-center justify-center relative"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,.3), rgba(129,140,248,.15))',
                border: '2px solid rgba(255,255,255,.15)',
                boxShadow: '0 0 40px rgba(99,102,241,.4)',
              }}>
              <p className="font-bold text-2xl text-white leading-none" style={{ letterSpacing: '-.03em' }}>{avgScore}%</p>
              <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,.55)' }}>avg score</p>
            </div>
            <p className="text-xs mt-2 font-medium" style={{ color: 'rgba(255,255,255,.4)' }}>Overall performance</p>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Stat label="Internships"   value={enrollments?.length ?? 0} icon={Star}     accent="#6366f1"/>
        <Stat label="Avg Score"     value={`${avgScore}%`}           icon={Trophy}   accent="#f59e0b"/>
        <Stat label="Pending Tasks" value={pending.length}           icon={BookOpen} accent="#ef4444"/>
      </div>

      {/* ── Internship progress ── */}
      {enrollments && enrollments.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl">My internships</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {enrollments.map((e: any) => {
              const score = Number(e.total_score ?? 0);
              const levelPct = ((e.current_level - 1) / Math.max(e.internships?.total_levels - 1, 1)) * 100;
              return (
                <div key={e.id} className="card" style={{ borderLeft: `4px solid ${SCORE_COLOR(score)}` }}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-base truncate">{e.internships?.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-500)' }}>
                        Level {e.current_level} of {e.internships?.total_levels}
                      </p>
                    </div>
                    <Pill tone={e.status === 'active' ? 'blue' : e.status === 'promoted' ? 'green' : 'accent'}>
                      {e.status}
                    </Pill>
                  </div>
                  {/* Score */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold" style={{ color: 'var(--ink-500)' }}>Score</p>
                    <p className="text-sm font-bold" style={{ color: SCORE_COLOR(score) }}>{score.toFixed(1)}%</p>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ink-100)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, score)}%`, background: `linear-gradient(90deg, ${SCORE_COLOR(score)}, ${SCORE_COLOR(score)}88)` }}/>
                  </div>
                  {/* Level progress */}
                  <div className="flex items-center justify-between mt-3 mb-1">
                    <p className="text-xs font-semibold" style={{ color: 'var(--ink-500)' }}>Level progress</p>
                    <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{e.current_level}/{e.internships?.total_levels}</p>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ink-100)' }}>
                    <div className="h-full rounded-full" style={{ width: `${levelPct}%`, background: 'var(--accent)' }}/>
                  </div>
                  <Link href="/student/leaderboard" className="inline-flex items-center gap-1 mt-4 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                    View leaderboard <ArrowRight size={11}/>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming sessions */}
        <div className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow mb-0.5">Schedule</p>
              <h2 className="font-display font-bold text-lg">Upcoming sessions</h2>
            </div>
            <Link href="/student/sessions" className="btn btn-ghost text-xs gap-1">All <ArrowRight size={12}/></Link>
          </div>
          {upcoming.length ? (
            <div className="space-y-3">
              {upcoming.map((s) => {
                const startsAt = new Date(s.scheduled_at).getTime();
                const now = Date.now();
                const endsAt = startsAt + 90 * 60000;
                const isLive = now >= startsAt && now <= endsAt;
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: isLive ? 'rgba(16,185,129,.08)' : 'var(--ink-50)', border: `1.5px solid ${isLive ? 'rgba(16,185,129,.25)' : 'var(--ink-100)'}` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: isLive ? 'rgba(16,185,129,.15)' : 'var(--accent-soft)' }}>
                      <Calendar size={16} style={{ color: isLive ? '#10b981' : 'var(--accent)' }}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{s.title}</p>
                      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                        {isLive ? '● Live now' : formatDateTime(s.scheduled_at)}
                      </p>
                    </div>
                    {isLive && s.meeting_url && (
                      <a href={s.meeting_url} target="_blank" rel="noopener noreferrer"
                        className="btn" style={{ fontSize: '.75rem', padding: '.35rem .65rem', background: '#10b981', color: 'white', border: 'none' }}>
                        Join
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-500)' }}>No upcoming sessions.</p>
          )}
        </div>

        {/* Pending assignments */}
        <div className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow mb-0.5">Pending</p>
              <h2 className="font-display font-bold text-lg">Assignments to submit</h2>
            </div>
            <Link href="/student/assignments" className="btn btn-ghost text-xs gap-1">All <ArrowRight size={12}/></Link>
          </div>
          {pending.length ? (
            <div className="space-y-3">
              {pending.map((a) => {
                const isOverdue = a.due_at && new Date(a.due_at) < new Date();
                return (
                  <Link key={a.id} href={`/student/assignments/${a.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover-border group"
                    style={{ background: isOverdue ? 'rgba(239,68,68,.05)' : 'var(--ink-50)', border: `1.5px solid ${isOverdue ? 'rgba(239,68,68,.2)' : 'var(--ink-100)'}`, textDecoration: 'none' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: isOverdue ? 'rgba(239,68,68,.1)' : 'var(--accent-soft)' }}>
                      <BookOpen size={15} style={{ color: isOverdue ? '#ef4444' : 'var(--accent)' }}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{a.title}</p>
                      <p className="text-xs" style={{ color: isOverdue ? '#ef4444' : 'var(--ink-500)' }}>
                        {isOverdue ? '⚠ Overdue · ' : ''}
                        {a.due_at ? `Due ${relativeTime(a.due_at)}` : 'No deadline'}
                      </p>
                    </div>
                    <Pill tone={a.kind === 'assessment' ? 'violet' : 'blue'}>{a.kind}</Pill>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="empty" style={{ padding: '2rem' }}>
              <span style={{ fontSize: '2rem' }}>✅</span>
              <p className="font-semibold mt-2" style={{ color: 'var(--green-700)' }}>All caught up!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-400)' }}>No pending assignments.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
