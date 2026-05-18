import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  // Sanity check: service role key must be configured for this endpoint
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is missing. Add it in Vercel → Project Settings → Environment Variables and redeploy.',
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

  // ───── Auth + permission check using user JWT ─────
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

  // ───── Service role check ─────
  // If this is missing on Vercel, every write below will silently fail via RLS.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          'Server is missing SUPABASE_SERVICE_ROLE_KEY. Set it in Vercel Project → Settings → Environment Variables, then redeploy.',
      },
      { status: 500 },
    );
  }

  const admin = createAdminClient();

  // ───── Clear path ─────
  if (status === 'clear') {
    const { error: delErr } = await admin
      .from('attendance')
      .delete()
      .eq('session_id', session_id)
      .eq('student_id', student_id);
    if (delErr) {
      return NextResponse.json(
        { error: `Delete failed: ${delErr.message}`, code: delErr.code },
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
    return NextResponse.json({ ok: true, cleared: true });
  }

  // ───── Find-then-INSERT-or-UPDATE (more debuggable than upsert) ─────
  const { data: existing, error: findErr } = await admin
    .from('attendance')
    .select('id')
    .eq('session_id', session_id)
    .eq('student_id', student_id)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json(
      { error: `Lookup failed: ${findErr.message}`, code: findErr.code },
      { status: 500 },
    );
  }

  const writePayload = {
    session_id,
    student_id,
    status,
    marked_manually_by: user.id,
    marked_manually_at: new Date().toISOString(),
  };

  if (existing) {
    // Update existing row
    const { error: updErr } = await admin
      .from('attendance')
      .update(writePayload)
      .eq('id', existing.id);
    if (updErr) {
      return NextResponse.json(
        {
          error: `Update failed: ${updErr.message}`,
          code: updErr.code,
          hint: updErr.code === '42703'
            ? 'Migration 007 not run? Missing column marked_manually_by or marked_manually_at on attendance table.'
            : undefined,
        },
        { status: 500 },
      );
    }
  } else {
    // Insert new row
    const { error: insErr } = await admin
      .from('attendance')
      .insert(writePayload);
    if (insErr) {
      return NextResponse.json(
        {
          error: `Insert failed: ${insErr.message}`,
          code: insErr.code,
          hint: insErr.code === '42703'
            ? 'Migration 007 not run? Missing column marked_manually_by or marked_manually_at on attendance table.'
            : undefined,
        },
        { status: 500 },
      );
    }
  }

  // ───── Verify by reading back ─────
  const { data: verified, error: verifyErr } = await admin
    .from('attendance')
    .select('id, status, marked_manually_by, marked_manually_at')
    .eq('session_id', session_id)
    .eq('student_id', student_id)
    .maybeSingle();

  if (verifyErr) {
    return NextResponse.json(
      { error: `Verify read failed: ${verifyErr.message}` },
      { status: 500 },
    );
  }
  if (!verified) {
    return NextResponse.json(
      {
        error:
          'Write reported success but verification read found no row. Service role may be misconfigured.',
      },
      { status: 500 },
    );
  }
  if (verified.status !== status) {
    return NextResponse.json(
      {
        error: `Wrote status="${status}" but verification reads status="${verified.status}". This should not happen.`,
      },
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

  return NextResponse.json({ ok: true, verified });
}
