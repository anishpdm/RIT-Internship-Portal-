import { createHmac } from 'crypto';

const SLOT_SECONDS = 90;

/**
 * Derive a 6-digit code that rotates every 90 seconds for a given session.
 * Server-side only — relies on ATTENDANCE_SECRET env var.
 */
export function codeForSlot(sessionId: string, slot: number): string {
  const secret = process.env.ATTENDANCE_SECRET ?? 'dev-secret-do-not-use-in-prod';
  const h = createHmac('sha256', secret)
    .update(`${sessionId}:${slot}`)
    .digest('hex');
  const n = parseInt(h.slice(0, 8), 16) % 1_000_000;
  return n.toString().padStart(6, '0');
}

export function currentSlot(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 1000 / SLOT_SECONDS);
}

export function currentCode(sessionId: string): {
  code: string;
  slot: number;
  expiresInSec: number;
} {
  const slot = currentSlot();
  const code = codeForSlot(sessionId, slot);
  const elapsedInSlot = Math.floor(Date.now() / 1000) % SLOT_SECONDS;
  return { code, slot, expiresInSec: SLOT_SECONDS - elapsedInSlot };
}

/**
 * Accept the code if it matches the current slot OR the previous slot
 * (1-slot grace period for network/announce lag).
 */
export function verifyCode(
  sessionId: string,
  submittedCode: string,
): { ok: boolean; slot?: number } {
  const slot = currentSlot();
  if (submittedCode === codeForSlot(sessionId, slot)) return { ok: true, slot };
  if (submittedCode === codeForSlot(sessionId, slot - 1))
    return { ok: true, slot: slot - 1 };
  return { ok: false };
}

/**
 * A session is "live for attendance" if either:
 *   - the mentor has explicitly set status = 'live', OR
 *   - the session is in scheduled state and we're within its time window
 *     (with a generous 30-minute grace before and 60-minute grace after).
 *
 * This avoids the timezone trap: even if scheduled_at is off by a few hours
 * because of TZ issues, the mentor's manual "Start session" still works.
 */
export function isSessionLive(
  status: string,
  scheduledAt: string | null,
  durationMinutes: number,
  graceBeforeMinutes: number = 30,
  graceAfterMinutes: number = 60,
): boolean {
  // Primary signal: explicit status
  if (status === 'live') return true;
  if (status === 'cancelled' || status === 'ended') return false;

  // Fallback: time-window check for sessions still in 'scheduled' status
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  const end = start + (durationMinutes + graceAfterMinutes) * 60 * 1000;
  const earliestEntry = start - graceBeforeMinutes * 60 * 1000;
  const now = Date.now();
  return now >= earliestEntry && now <= end;
}
