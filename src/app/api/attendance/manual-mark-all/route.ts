import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const session_id = String(body.session_id ?? '');

  if (!session_id) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
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
    return NextResponse.json({ error: 'Unauthorised' }, { status: 403 });
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

  const { data: enrolled } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('internship_id', session.internship_id);

  const studentIds = (enrolled ?? []).map((e: any) => e.student_id);
  if (studentIds.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const now = new Date().toISOString();
  const rows = studentIds.map((sid) => ({
    session_id,
    student_id: sid,
    status: 'present' as const,
    marked_manually_by: user.id,
    marked_manually_at: now,
  }));

  const admin = createAdminClient();
  const { data: written, error } = await admin
    .from('attendance')
    .upsert(rows, { onConflict: 'session_id,student_id' })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const writtenCount = written?.length ?? 0;

  await logAudit({
    actor_id: user.id,
    actor_role: role,
    action: 'attendance.bulk_mark_present',
    entity_type: 'session',
    entity_id: session_id,
    details: { count: writtenCount, internship_id: session.internship_id },
  });

  return NextResponse.json({ ok: true, count: writtenCount });
}
