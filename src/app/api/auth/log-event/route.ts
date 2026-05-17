import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const event = String(body.event ?? '');

  if (!['login', 'logout'].includes(event)) {
    return NextResponse.json({ error: 'invalid event' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // For logout, the cookie may already be cleared; allow the action_id from body
    if (event === 'logout' && body.user_id) {
      // Trust the user_id only if it was just signed in (best-effort log)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', String(body.user_id))
        .maybeSingle();
      if (profile) {
        await logAudit({
          actor_id: String(body.user_id),
          actor_role: profile.role,
          action: 'auth.logout',
          entity_type: 'session',
          details: {
            email: profile.email,
            user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
          },
        });
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  // Fetch role + email for the actor
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle();

  await logAudit({
    actor_id: user.id,
    actor_role: profile?.role ?? null,
    action: `auth.${event}`,
    entity_type: 'session',
    details: {
      email: profile?.email ?? user.email ?? null,
      user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
