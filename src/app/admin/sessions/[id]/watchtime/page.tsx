import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, Clock, Eye, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

function fmtSec(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default async function WatchTimePage({ params }: { params: { id: string } }) {
  const me = await requireRole(['admin', 'mentor']);
  const admin = createAdminClient();
  const isAdmin = me.profile.role === 'admin';

  const { data: session } = await admin
    .from('sessions')
    .select('id, title, session_type, scheduled_at, internship_id, video_duration_sec, internships:internship_id (title)')
    .eq('id', params.id)
    .single();
  if (!session) notFound();

  if (me.profile.role === 'mentor') {
    const { data: ma } = await admin
      .from('mentor_assignments').select('id')
      .eq('mentor_id', me.userId).eq('internship_id', session.internship_id).maybeSingle();
    if (!ma) notFound();
  }

  // Only meaningful for recorded sessions
  const isRecorded = session.session_type === 'recorded' || session.session_type === 'self_learning';

  // Fetch all enrollments for context (total student count)
  const { data: enrollments } = await admin
    .from('enrollments')
    .select('student_id')
    .eq('internship_id', session.internship_id)
    .neq('status', 'filtered');

  // Fetch all attendance records with profiles
  const { data: records } = await admin
    .from('attendance')
    .select('*, profiles:student_id (full_name, email)')
    .eq('session_id', params.id)
    .order('active_seconds', { ascending: false });

  const duration    = session.video_duration_sec ?? 0;
  const required    = Math.floor(duration * 0.8);
  const totalEnrolled = enrollments?.length ?? 0;
  const present     = records?.filter((r: any) => r.status === 'present').length ?? 0;
  const partial     = records?.filter((r: any) => r.status === 'partial').length ?? 0;
  const notStarted  = totalEnrolled - (records?.length ?? 0);
  const avgWatch    = records?.length
    ? Math.round(records.reduce((s: number, r: any) => s + (r.active_seconds ?? 0), 0) / records.length)
    : 0;
  const basePath = isAdmin ? 'admin' : 'mentor';

  return (
    <>
      <PageHeader
        eyebrow={`${isAdmin ? 'Admin' : 'Mentor'} · ${(session as any).internships?.title}`}
        title={`Watch-time: ${session.title}`}
        subtitle={`${session.session_type.replace('_', ' ')} · ${formatDateTime(session.scheduled_at)}`}
        actions={
          <Link href={`/${basePath}/sessions/${session.id}`} className="btn btn-ghost">
            <ArrowLeft size={16}/> Back
          </Link>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Enrolled',    value: totalEnrolled,     color: 'var(--ink-700)',   icon: '👥' },
          { label: '✓ Attended',  value: present,           color: '#10b981',          icon: '✅' },
          { label: 'In progress', value: partial,           color: '#f59e0b',          icon: '⏳' },
          { label: 'Not started', value: notStarted,        color: 'var(--ink-500)',   icon: '💤' },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="font-black text-3xl" style={{ color: s.color }}>{s.value}</p>
            <p className="eyebrow mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Video stats */}
      {duration > 0 && (
        <div className="card mb-6" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.08),rgba(99,102,241,.03))', borderColor: 'rgba(99,102,241,.2)' }}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Clock size={16} style={{ color: 'var(--accent)' }}/>
              <div>
                <p className="text-xs" style={{ color: 'var(--ink-500)' }}>Video duration</p>
                <p className="font-bold">{fmtSec(duration)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Eye size={16} style={{ color: '#f59e0b' }}/>
              <div>
                <p className="text-xs" style={{ color: 'var(--ink-500)' }}>Required to attend</p>
                <p className="font-bold">{fmtSec(required)} (80%)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} style={{ color: '#10b981' }}/>
              <div>
                <p className="text-xs" style={{ color: 'var(--ink-500)' }}>Avg watch time</p>
                <p className="font-bold">{fmtSec(avgWatch)}</p>
              </div>
            </div>
            <div className="ml-auto">
              <p className="text-xs mb-1" style={{ color: 'var(--ink-500)' }}>
                Completion rate: <strong>{totalEnrolled > 0 ? Math.round((present / totalEnrolled) * 100) : 0}%</strong>
              </p>
              <div className="h-2 rounded-full overflow-hidden" style={{ width: 160, background: 'var(--ink-100)' }}>
                <div className="h-full rounded-full" style={{ width: `${totalEnrolled > 0 ? (present / totalEnrolled) * 100 : 0}%`, background: '#10b981' }}/>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full watch table */}
      {!records?.length ? (
        <EmptyState title="No watch data yet" hint="Students haven't started this recording yet."/>
      ) : (
        <div className="card p-0 overflow-hidden table-wrap">
          <div className="px-5 py-3.5 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg,#0a0f1e,#1e1b4b)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <Clock size={14} style={{ color: '#fbbf24' }}/>
            <p className="font-bold text-sm text-white">Per-student watch time</p>
            <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,.35)' }}>sorted by watch time desc</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Student</th>
                <th>Status</th>
                <th style={{ minWidth: 200 }}>Watch time</th>
                <th style={{ textAlign: 'right' }}>% watched</th>
                <th style={{ textAlign: 'right' }}>Last position</th>
                <th>Last active</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: any, idx: number) => {
                const active: number = r.active_seconds ?? 0;
                const pct    = duration > 0 ? Math.min(100, Math.round((active / duration) * 100)) : 0;
                const reqPct = required > 0 ? Math.min(100, Math.round((active / required) * 100)) : 0;
                const barColor = r.status === 'present' ? '#10b981' : r.status === 'partial' ? '#f59e0b' : '#ef4444';
                const lastPos: number = r.last_position ?? 0;
                const COLORS = ['#8B5CF6','#06B6D4','#10B981','#F59E0B','#EF4444','#3B82F6','#EC4899','#14B8A6'];
                const avatarColor = COLORS[idx % COLORS.length];
                const initials = (r.profiles?.full_name ?? r.profiles?.email ?? '?')
                  .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

                return (
                  <tr key={r.id}>
                    <td className="font-mono text-xs" style={{ color: 'var(--ink-500)' }}>{idx + 1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                          style={{ background: avatarColor }}>
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{r.profiles?.full_name ?? '—'}</p>
                          <p className="text-xs" style={{ color: 'var(--ink-500)' }}>{r.profiles?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Pill tone={r.status === 'present' ? 'green' : r.status === 'partial' ? 'amber' : 'red'}>
                        {r.status}
                      </Pill>
                    </td>
                    <td>
                      <div>
                        <span className="font-mono font-bold text-sm" style={{ color: barColor }}>
                          {fmtSec(active)}
                        </span>
                        {required > 0 && (
                          <span className="text-xs ml-1" style={{ color: 'var(--ink-400)' }}>/ {fmtSec(required)}</span>
                        )}
                      </div>
                      <div className="relative mt-1.5">
                        <div className="h-2 rounded-full overflow-hidden" style={{ width: 160, background: 'var(--ink-100)' }}>
                          <div className="h-full rounded-full" style={{ width: `${reqPct}%`, background: barColor }}/>
                        </div>
                        {/* Threshold marker at 100% of required */}
                        <div className="absolute top-0 h-2 w-0.5 rounded"
                          style={{ right: 0, background: 'var(--ink-400)' }}/>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono font-bold" style={{ color: barColor }}>
                        {duration > 0 ? `${pct}%` : fmtSec(active)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="font-mono text-sm">
                        {lastPos > 0 ? fmtSec(lastPos) : '—'}
                      </span>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--ink-500)' }}>
                      {r.last_heartbeat ? formatDateTime(r.last_heartbeat) : '—'}
                    </td>
                    <td>
                      {r.marked_manually_by ? (
                        <span className="pill" style={{ fontSize: '.6rem' }}>👤 Manual</span>
                      ) : r.code_entered_at ? (
                        <span className="pill pill-green" style={{ fontSize: '.6rem' }}>✓ Code</span>
                      ) : r.last_heartbeat ? (
                        <span className="pill pill-accent" style={{ fontSize: '.6rem' }}>📺 Watch</span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--ink-400)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Students who haven't started */}
      {notStarted > 0 && (() => {
        const watchedIds = new Set((records ?? []).map((r: any) => r.student_id));
        const notStartedStudents = (enrollments ?? []).filter((e: any) => !watchedIds.has(e.student_id));
        return (
          <div className="mt-4 card"
            style={{ background: 'var(--amber-soft)', borderColor: 'rgba(245,158,11,.2)' }}>
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--amber-700)' }}>
              💤 {notStarted} student{notStarted !== 1 ? 's' : ''} haven&apos;t started watching
            </p>
            <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
              These students have no watch record yet for this session.
            </p>
          </div>
        );
      })()}
    </>
  );
}
