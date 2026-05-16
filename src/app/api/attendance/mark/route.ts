import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { verifyCode, isSessionLive } from '@/lib/attendance';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const session_id = String(body.session_id ?? '');
  const code = String(body.code ?? '').trim();

  if (!session_id || code.length !== 6) {
    return NextResponse.json(
      { error: 'session_id and 6-digit code required' },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  // Load session
  const { data: session } = await supabase
    .from('sessions')
    .select(
      'id, internship_id, session_type, scheduled_at, duration_minutes, status',
    )
    .eq('id', session_id)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  if (session.session_type !== 'live') {
    return NextResponse.json(
      { error: 'not a live session' },
      { status: 400 },
    );
  }

  if (!isSessionLive(session.scheduled_at, session.duration_minutes)) {
    return NextResponse.json(
      { error: 'session not currently live' },
      { status: 403 },
    );
  }

  // Verify enrolled
  const { data: enr } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('student_id', user.id)
    .eq('internship_id', session.internship_id)
    .maybeSingle();
  if (!enr) {
    return NextResponse.json(
      { error: 'not enrolled in this internship' },
      { status: 403 },
    );
  }

  // Verify code
  const v = verifyCode(session_id, code);
  if (!v.ok) {
    await logAudit({
      actor_id: user.id,
      actor_role: 'student',
      action: 'attendance.code_failed',
      entity_type: 'session',
      entity_id: session_id,
      details: { code_attempted: code },
    });
    return NextResponse.json({ error: 'invalid or expired code' }, { status: 400 });
  }

  // Upsert attendance via admin client (RLS-safe)
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('attendance')
    .select('id')
    .eq('session_id', session_id)
    .eq('student_id', user.id)
    .maybeSingle();

  if (existing) {
    await admin
      .from('attendance')
      .update({
        status: 'present',
        marked_at: new Date().toISOString(),
        code_used: code,
      })
      .eq('id', existing.id);
  } else {
    await admin.from('attendance').insert({
      session_id,
      student_id: user.id,
      status: 'present',
      marked_at: new Date().toISOString(),
      code_used: code,
    });
  }

  await logAudit({
    actor_id: user.id,
    actor_role: 'student',
    action: 'attendance.mark_live',
    entity_type: 'session',
    entity_id: session_id,
    details: { slot: v.slot },
  });

  return NextResponse.json({ ok: true, status: 'present' });
}
