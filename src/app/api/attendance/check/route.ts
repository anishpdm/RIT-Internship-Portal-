import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * Diagnostic: check whether an attendance row exists.
 * Helps confirm that manual marking actually wrote to the DB.
 */
export async function GET(req: NextRequest) {
  const session_id = req.nextUrl.searchParams.get('session_id');
  const student_id = req.nextUrl.searchParams.get('student_id');

  if (!session_id || !student_id) {
    return NextResponse.json(
      { error: 'session_id and student_id required' },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin' && profile?.role !== 'mentor') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('attendance')
    .select('*')
    .eq('session_id', session_id)
    .eq('student_id', student_id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    exists: !!row,
    row: row ?? null,
  });
}
