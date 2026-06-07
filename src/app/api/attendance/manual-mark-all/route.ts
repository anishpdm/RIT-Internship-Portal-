import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing.' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const session_id  = String(body.session_id  ?? '');
  // student_ids passed from the page — already level-filtered
  const student_ids: string[] | undefined = Array.isArray(body.student_ids) ? body.student_ids : undefined;

  if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role;
  if (role !== 'admin' && role !== 'mentor') return NextResponse.json({ error: 'Unauthorised' }, { status: 403 });

  const admin = createAdminClient();

  // Fetch session with level_id
  const { data: session } = await admin
    .from('sessions')
    .select('id, internship_id, level_id')
    .eq('id', session_id)
    .single();
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (role === 'mentor') {
    const { data: ma } = await supabase
      .from('mentor_assignments').select('id')
      .eq('mentor_id', user.id).eq('internship_id', session.internship_id).maybeSingle();
    if (!ma) return NextResponse.json({ error: 'Not assigned as mentor for this internship' }, { status: 403 });
  }

  // Resolve session level number for server-side filtering
  let sessionLevelNumber: number | null = null;
  if (session.level_id) {
    const { data: lv } = await admin.from('levels').select('level_number').eq('id', session.level_id).single();
    sessionLevelNumber = lv?.level_number ?? null;
  }

  let studentIds: string[];

  if (student_ids && student_ids.length > 0) {
    // Client passed a pre-filtered list — use it, but verify they're actually enrolled
    const { data: enrolled } = await admin
      .from('enrollments')
      .select('student_id, current_level')
      .eq('internship_id', session.internship_id)
      .neq('status', 'filtered')
      .in('student_id', student_ids);

    // Server-side safety: also enforce level filter
    studentIds = (enrolled ?? [])
      .filter((e: any) => sessionLevelNumber === null || e.current_level >= sessionLevelNumber)
      .map((e: any) => e.student_id);
  } else {
    // Fallback: fetch from DB with level filter
    let q = admin
      .from('enrollments')
      .select('student_id, current_level')
      .eq('internship_id', session.internship_id)
      .neq('status', 'filtered');
    if (sessionLevelNumber !== null) q = q.gte('current_level', sessionLevelNumber);
    const { data: enrolled } = await q;
    studentIds = (enrolled ?? []).map((e: any) => e.student_id);
  }

  if (studentIds.length === 0) return NextResponse.json({ ok: true, count: 0 });

  const now = new Date().toISOString();

  const { error: probeErr } = await admin.from('attendance').select('marked_manually_by').limit(1);
  const hasManualColumns = !probeErr;

  const rows = studentIds.map(sid => {
    const r: Record<string, any> = { session_id, student_id: sid, status: 'present' };
    if (hasManualColumns) { r.marked_manually_by = user.id; r.marked_manually_at = now; }
    return r;
  });

  const { data: written, error } = await admin
    .from('attendance')
    .upsert(rows, { onConflict: 'session_id,student_id' })
    .select();

  if (error) return NextResponse.json({ error: `Bulk write failed: ${error.message}` }, { status: 500 });

  const count = written?.length ?? 0;

  await logAudit({
    actor_id: user.id, actor_role: role,
    action: 'attendance.bulk_mark_present',
    entity_type: 'session', entity_id: session_id,
    details: { count, internship_id: session.internship_id, level_filtered: sessionLevelNumber !== null },
  });

  return NextResponse.json({ ok: true, count });
}
