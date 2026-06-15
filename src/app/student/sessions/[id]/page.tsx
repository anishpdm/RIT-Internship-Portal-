import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { PageHeader, Pill } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, ExternalLink, FileText, Link as LinkIcon, Video, Zap } from 'lucide-react';
import LiveAttendance from './LiveAttendance';
import VideoPlayer from '@/components/VideoPlayer';
import SelfLearningAttendance from './SelfLearningAttendance';

export const dynamic = 'force-dynamic';

export default async function StudentSessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireRole(['student', 'admin']);
  const supabase = createClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('*, internships:internship_id (id, title), levels:level_id (level_number, title)')
    .eq('id', params.id)
    .single();

  if (!session) notFound();

  // Block hidden sessions and level-gated sessions the student hasn't reached
  if (me.profile.role === 'student') {
    if (session.is_hidden) notFound();
    if (session.level_id) {
      const { getAccessibleLevelIds } = await import('@/lib/level-access');
      const access = await getAccessibleLevelIds(me.userId);
      if (!access || !access.levelIds.includes(session.level_id)) notFound();
    }
  }

  const { data: materials } = await supabase
    .from('session_materials')
    .select('*')
    .eq('session_id', params.id)
    .order('created_at');

  const { data: existingAtt } = await supabase
    .from('attendance')
    .select('*')
    .eq('session_id', params.id)
    .eq('student_id', me.userId)
    .maybeSingle();

  // Is there a quiz for this session?
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, status, title, mode, starts_at, ends_at')
    .eq('session_id', params.id)
      .or('is_hidden.is.null,is_hidden.eq.false')
    .maybeSingle();

  // Window state for self-paced quizzes
  const nowMs = Date.now();
  const startMs = quiz?.starts_at ? new Date(quiz.starts_at).getTime() : null;
  const endMs = quiz?.ends_at ? new Date(quiz.ends_at).getTime() : null;
  const quizScheduled = !!(quiz && startMs && endMs);
  const quizOpen = quizScheduled && nowMs >= (startMs as number) && nowMs <= (endMs as number);
  const quizClosed = quizScheduled && nowMs > (endMs as number);
  const quizBefore = quizScheduled && nowMs < (startMs as number);

  function fmt(ts: number) {
    return new Date(ts).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  return (
    <>
      <PageHeader
        eyebrow={(session as any).internships?.title ?? 'Session'}
        title={session.title}
        subtitle={`${session.session_type.replace('_', ' ')} · ${formatDateTime(session.scheduled_at)} · ${session.duration_minutes}m`}
        actions={
          <Link href="/student/sessions" className="btn btn-ghost">
            <ArrowLeft size={16} /> All sessions
          </Link>
        }
      />

      {session.description && (
        <div className="card mb-6">
          <p className="leading-relaxed">{session.description}</p>
        </div>
      )}

      {/* Quiz CTA */}
      {quiz && quizScheduled && (
        <Link
          href={`/student/sessions/${params.id}/quiz`}
          className="card card-hover block mb-6"
          style={{
            background: quizOpen
              ? 'linear-gradient(135deg, var(--accent-soft) 0%, rgba(79, 70, 229, 0.05) 100%)'
              : quizClosed
                ? 'var(--ink-100)'
                : 'var(--paper)',
            borderColor: quizClosed ? 'var(--ink-300)' : 'var(--accent)',
          }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  background: quizClosed ? 'var(--ink-500)' : 'var(--accent)',
                  color: 'white',
                }}
              >
                <Zap size={18} />
              </div>
              <div>
                <p className="font-display font-semibold">{quiz.title}</p>
                <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                  {quizOpen && <>🟢 Open · closes at {fmt(endMs as number)}</>}
                  {quizBefore && <>Opens at {fmt(startMs as number)}</>}
                  {quizClosed && <>Closed at {fmt(endMs as number)}</>}
                </p>
              </div>
            </div>
            <span className="btn btn-primary">
              <Zap size={14} />{' '}
              {quizOpen ? 'Take quiz' : quizBefore ? 'View details' : 'View result'}
            </span>
          </div>
        </Link>
      )}

      {/* Attendance UI by type */}
      <div className="mb-8">
        {session.session_type === 'live' && (
          <LiveAttendance
            sessionId={session.id}
            meetingUrl={session.meeting_url}
            scheduledAt={session.scheduled_at}
            durationMinutes={session.duration_minutes}
            existingStatus={existingAtt?.status ?? null}
          />
        )}
        {session.session_type === 'recorded' && (
          <VideoPlayer
            sessionId={session.id}
            recordingUrl={session.recording_url ?? null}
            videoDurationSec={session.video_duration_sec ?? 0}
            initialActiveSeconds={existingAtt?.active_seconds ?? 0}
            initialStatus={existingAtt?.status ?? null}
          />
        )}
        {session.session_type === 'self_learning' && (
          <SelfLearningAttendance
            sessionId={session.id}
            minDwellMinutes={session.min_dwell_minutes ?? 30}
            initialActiveSeconds={existingAtt?.active_seconds ?? 0}
            initialStatus={existingAtt?.status ?? null}
            initialNote={existingAtt?.reflection_note ?? ''}
          />
        )}
      </div>

      {/* Standalone recording link — for live sessions that were recorded after the fact, or any session with a non-mp4 recording link */}
      {session.recording_url && session.session_type !== 'recorded' && (
        <div className="card mb-8" style={{ borderColor: 'var(--accent)' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <Video size={18} />
              </div>
              <div>
                <p className="font-display font-semibold">Session recording available</p>
                <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                  Watch the recording of this session.
                </p>
              </div>
            </div>
            <a
              href={session.recording_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              <Video size={14} /> Watch recording
            </a>
          </div>
        </div>
      )}

      {/* Materials */}
      <h2 className="font-display text-2xl mb-4">Materials</h2>
      {materials && materials.length > 0 ? (
        <div className="space-y-2">
          {materials.map((m: any) => (
            <a
              key={m.id}
              href={m.link_url ?? m.file_url ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="card flex items-center gap-3 hover:border-amber-700/40"
            >
              {m.link_url ? <LinkIcon size={16} /> : <FileText size={16} />}
              <div className="flex-1 min-w-0">
                <p className="font-medium">{m.title}</p>
                {m.file_type && (
                  <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
                    {m.file_type}
                  </p>
                )}
              </div>
              <ExternalLink size={14} style={{ color: 'var(--accent)' }} />
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
          No materials posted yet.
        </p>
      )}
    </>
  );
}
