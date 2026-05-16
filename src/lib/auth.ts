import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { Profile, UserRole } from './types';

export async function getCurrentUser(): Promise<{
  userId: string;
  profile: Profile;
} | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();
  if (!profile) return null;
  return { userId: user.id, profile };
}

export async function requireRole(allowed: UserRole | UserRole[]) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  const list = Array.isArray(allowed) ? allowed : [allowed];
  if (!list.includes(me.profile.role)) redirect(`/${me.profile.role}`);
  return me;
}
