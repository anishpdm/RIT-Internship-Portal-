import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const session_id = String(body.session_id ?? '');
  const student_id = String(body.student_id ?? '');
  const status = String(body.status ?? '');

  if (!session_id || !student_id) {
    return NextResponse.json({ error: 'Missing session_id or student_id' }, { status: 400 });
  }
  if (!['present', 'partial', 'absent', 'clear'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Read with user auth — for permission check
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
      { error: 'Only admins and mentors can mark attendance manually' },
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

  // Verify student is enrolled in this internship
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('student_id', student_id)
    .eq('internship_id', session.internship_id)
    .maybeSingle();
  if (!enrollment) {
    return NextResponse.json(
      { error: 'Student is not enrolled in this internship' },
      { status: 400 },
    );
  }

  // ─────────────────────────────────────
  // Now do the actual write with admin client (bypasses RLS)
  // We've fully validated the caller's permission above.
  // ─────────────────────────────────────
  const admin = createAdminClient();

  if (status === 'clear') {
    const { error: delErr } = await admin
      .from('attendance')
      .delete()
      .eq('session_id', session_id)
      .eq('student_id', student_id);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
    await logAudit({
      actor_id: user.id,
      actor_role: role,
      action: 'attendance.clear_manual',
      entity_type: 'attendance',
      entity_id: `${session_id}:${student_id}`,
      details: { session_id, student_id },
    });
    return NextResponse.json({ ok: true, cleared: true });
  }

  // Use .select() so we definitely get a row back if the write succeeded
  const { data: written, error: writeErr } = await admin
    .from('attendance')
    .upsert(
      {
        session_id,
        student_id,
        status,
        marked_manually_by: user.id,
        marked_manually_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,student_id' },
    )
    .select()
    .single();

  if (writeErr) {
    return NextResponse.json(
      { error: `Write failed: ${writeErr.message}` },
      { status: 500 },
    );
  }
  if (!written) {
    return NextResponse.json(
      { error: 'Write returned no row — check unique constraint on attendance(session_id, student_id)' },
      { status: 500 },
    );
  }

  await logAudit({
    actor_id: user.id,
    actor_role: role,
    action: 'attendance.mark_manual',
    entity_type: 'attendance',
    entity_id: `${session_id}:${student_id}`,
    details: { status, session_id, student_id },
  });

  return NextResponse.json({ ok: true, row: written });
}
