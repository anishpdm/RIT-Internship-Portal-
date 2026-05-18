import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is missing on Vercel.',
      },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const session_id = String(body.session_id ?? '');
  const student_id = String(body.student_id ?? '');
  const status = String(body.status ?? '');

  if (!session_id || !student_id) {
    return NextResponse.json(
      { error: 'Missing session_id or student_id' },
      { status: 400 },
    );
  }
  if (!['present', 'partial', 'absent', 'clear'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = profile?.role;
  if (role !== 'admin' && role !== 'mentor') {
    return NextResponse.json(
      { error: 'Only admins and mentors can mark attendance' },
      { status: 403 },
    );
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('id, internship_id')
    .eq('id', session_id)
    .single();
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments')
      .select('id')
      .eq('mentor_id', user.id)
      .eq('internship_id', session.internship_id)
      .maybeSingle();
    if (!ma) {
      return NextResponse.json(
        { error: 'You are not assigned as a mentor for this internship' },
        { status: 403 },
      );
    }
  }

  const admin = createAdminClient();

  // ─────── Probe: does migration 007 exist? ───────
  const { error: probeErr } = await admin
    .from('attendance')
    .select('marked_manually_by')
    .limit(1);

  const hasManualColumns = !probeErr;

  if (probeErr && !probeErr.message?.match(/column .* does not exist/i)) {
    // Some other error reading attendance
    return NextResponse.json(
      { error: `Attendance read failed: ${probeErr.message}` },
      { status: 500 },
    );
  }

  // ─────── CLEAR ───────
  if (status === 'clear') {
    const { error: delErr, count } = await admin
      .from('attendance')
      .delete({ count: 'exact' })
      .eq('session_id', session_id)
      .eq('student_id', student_id);
    if (delErr) {
      return NextResponse.json(
        { error: `Delete failed: ${delErr.message}` },
        { status: 500 },
      );
    }
    await logAudit({
      actor_id: user.id,
      actor_role: role,
      action: 'attendance.clear_manual',
      entity_type: 'attendance',
      entity_id: `${session_id}:${student_id}`,
      details: { session_id, student_id },
    });
    return NextResponse.json({ ok: true, cleared: true, deletedCount: count });
  }

  // ─────── INSERT or UPDATE ───────
  const fullRow: Record<string, any> = {
    session_id,
    student_id,
    status,
  };
  if (hasManualColumns) {
    fullRow.marked_manually_by = user.id;
    fullRow.marked_manually_at = new Date().toISOString();
  }

  // Try to UPDATE existing row first
  const updateRes = await admin
    .from('attendance')
    .update(fullRow)
    .eq('session_id', session_id)
    .eq('student_id', student_id)
    .select()
    .maybeSingle();

  if (updateRes.error) {
    return NextResponse.json(
      { error: `Update failed: ${updateRes.error.message}` },
      { status: 500 },
    );
  }

  // If UPDATE returned a row, we're done
  if (updateRes.data) {
    await logAudit({
      actor_id: user.id,
      actor_role: role,
      action: 'attendance.mark_manual',
      entity_type: 'attendance',
      entity_id: `${session_id}:${student_id}`,
      details: { status, session_id, student_id, op: 'update' },
    });
    return NextResponse.json({
      ok: true,
      op: 'update',
      row: updateRes.data,
      schemaHasManualColumns: hasManualColumns,
    });
  }

  // No existing row — INSERT
  const insertRes = await admin
    .from('attendance')
    .insert(fullRow)
    .select()
    .single();

  if (insertRes.error) {
    return NextResponse.json(
      { error: `Insert failed: ${insertRes.error.message}` },
      { status: 500 },
    );
  }
  if (!insertRes.data) {
    return NextResponse.json(
      { error: 'Insert returned no row' },
      { status: 500 },
    );
  }

  await logAudit({
    actor_id: user.id,
    actor_role: role,
    action: 'attendance.mark_manual',
    entity_type: 'attendance',
    entity_id: `${session_id}:${student_id}`,
    details: { status, session_id, student_id, op: 'insert' },
  });

  return NextResponse.json({
    ok: true,
    op: 'insert',
    row: insertRes.data,
    schemaHasManualColumns: hasManualColumns,
  });
}
