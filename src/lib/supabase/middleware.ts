import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    role = profile?.role ?? null;
  }

  const url = request.nextUrl;
  const path = url.pathname;

  const isProtected =
    path.startsWith('/admin') ||
    path.startsWith('/mentor') ||
    path.startsWith('/student');

  // Not logged in but accessing protected route
  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in but profile not yet created (rare race condition)
  if (isProtected && user && !role) {
    // Let through; the layout's requireRole will handle gracefully
    return response;
  }

  if (user && role) {
    // Role-based gating
    if (path.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL(`/${role}`, request.url));
    }
    // Mentor routes: only mentor OR admin allowed
    if (path.startsWith('/mentor') && role !== 'mentor' && role !== 'admin') {
      return NextResponse.redirect(new URL(`/${role}`, request.url));
    }
    // Student routes: only student OR admin allowed
    if (path.startsWith('/student') && role !== 'student' && role !== 'admin') {
      return NextResponse.redirect(new URL(`/${role}`, request.url));
    }

    // If already signed in and visiting /login or /, send to your home portal
    if (path === '/login' || path === '/') {
      return NextResponse.redirect(new URL(`/${role}`, request.url));
    }
  }

  return response;
}
