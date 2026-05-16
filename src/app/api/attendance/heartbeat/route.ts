import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const HEARTBEAT_INCREMENT = 15; // seconds per heartbeat
const RECORDED_THRESHOLD = 0.8; // 80% active watch
const REFLECTION_MIN_LEN = 50;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const session_id = String(body.session_id ?? '');
  const visibility = String(body.visibility ?? 'hidden');
  const position = Number(body.position ?? 0);
  const last_position = Number(body.last_position ?? 0);
  const playing = !!body.playing;
  const self_learning = !!body.self_learning;
  const reflection_note = body.reflection_note ? String(body.reflection_note) : null;

  if (!session_id) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const { data: session } = await supabase
    .from('sessions')
    .select(
      'id, internship_id, session_type, video_duration_sec, min_dwell_minutes',
    )
    .eq('id', session_id)
    .single();
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  // Verify enrolled
  const { data: enr } = await supabase
    .from('enrollments')
    .select('id')
    .eq('student_id', user.id)
    .eq('internship_id', session.internship_id)
    .maybeSingle();
  if (!enr) {
    return NextResponse.json(
      { error: 'not enrolled in this internship' },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // Read existing row
  const { data: existing } = await admin
    .from('attendance')
    .select('*')
    .eq('session_id', session_id)
    .eq('student_id', user.id)
    .maybeSingle();

  let activeSeconds = existing?.active_seconds ?? 0;
  let status = existing?.status ?? 'absent';

  // Validation for credit:
  // - Tab must be visible
  // - Recorded: video must be playing AND position must have advanced
  // - Self-learning: visibility is enough
  const visible = visibility === 'visible';

  let creditable = false;
  if (session.session_type === 'recorded' && !self_learning) {
    creditable =
      visible &&
      playing &&
      position > last_position &&
      // not too big a jump (avoid 4× speed / skip-ahead abuse)
      position - last_position <= HEARTBEAT_INCREMENT + 5;
  } else if (session.session_type === 'self_learning' || self_learning) {
    creditable = visible;
  }

  if (creditable) {
    activeSeconds += HEARTBEAT_INCREMENT;
  }

  // Threshold checks
  if (session.session_type === 'recorded') {
    const required = Math.floor(
      (session.video_duration_sec ?? 0) * RECORDED_THRESHOLD,
    );
    if (required > 0 && activeSeconds >= required) status = 'present';
    else if (activeSeconds > 0) status = 'partial';
  } else if (session.session_type === 'self_learning') {
    const requiredSec = (session.min_dwell_minutes ?? 30) * 60;
    const hasNote =
      (reflection_note ?? existing?.reflection_note ?? '').length >=
      REFLECTION_MIN_LEN;
    if (activeSeconds >= requiredSec && hasNote) status = 'present';
    else if (activeSeconds > 0) status = 'partial';
  }

  const updateData: Record<string, unknown> = {
    active_seconds: activeSeconds,
    last_heartbeat: new Date().toISOString(),
    last_position: position || existing?.last_position || 0,
    status,
  };
  if (reflection_note !== null) updateData.reflection_note = reflection_note;
  if (status === 'present' && !existing?.marked_at) {
    updateData.marked_at = new Date().toISOString();
  }

  if (existing) {
    await admin.from('attendance').update(updateData).eq('id', existing.id);
  } else {
    await admin.from('attendance').insert({
      session_id,
      student_id: user.id,
      ...updateData,
    });
  }

  return NextResponse.json({
    ok: true,
    active_seconds: activeSeconds,
    status,
    creditable,
  });
}
