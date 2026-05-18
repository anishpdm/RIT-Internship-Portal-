import { type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run for all paths except static assets AND API routes (which auth themselves).
    // Skipping /api skips redundant auth.getUser() + profile lookup on every poll,
    // which matters a LOT during live quizzes where many clients poll the state endpoint.
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
