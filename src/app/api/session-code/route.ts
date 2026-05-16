import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { currentCode } from '@/lib/attendance';

export async function GET(req: NextRequest) {
  const session_id = req.nextUrl.searchParams.get('session_id');
  if (!session_id) {
    return NextResponse.json({ error: 'missing session_id' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  // Verify caller is mentor/admin for the internship of this session
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'no profile' }, { status: 403 });
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('internship_id')
    .eq('id', session_id)
    .single();
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }

  if (profile.role !== 'admin') {
    if (profile.role !== 'mentor') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const { data: ma } = await supabase
      .from('mentor_assignments')
      .select('id')
      .eq('mentor_id', user.id)
      .eq('internship_id', session.internship_id)
      .maybeSingle();
    if (!ma) {
      return NextResponse.json({ error: 'not assigned' }, { status: 403 });
    }
  }

  const { code, slot, expiresInSec } = currentCode(session_id);
  return NextResponse.json({ code, slot, expiresInSec });
}
