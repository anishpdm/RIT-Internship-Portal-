import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// IST is UTC+05:30 — always use Asia/Kolkata for display.
// (Database storage stays in UTC via Postgres timestamptz, which is correct;
// this just controls how we render times to the user.)
const IST_TZ = 'Asia/Kolkata';

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: IST_TZ,
  });
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    dateStyle: 'medium',
    timeZone: IST_TZ,
  });
}

/** Just the time (e.g. "2:30 pm") — IST */
export function formatTimeOnly(value: string | Date | null | undefined) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', {
    timeStyle: 'short',
    timeZone: IST_TZ,
  });
}

export function relativeTime(value: string | Date | null | undefined) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  const diffMs = d.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const abs = Math.abs(diffMin);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60) return rtf.format(diffMin, 'minute');
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return rtf.format(diffH, 'hour');
  const diffD = Math.round(diffH / 24);
  return rtf.format(diffD, 'day');
}

// ─────────────────────────────────────────────────────────────────
// datetime-local input helpers
//
// Browsers render <input type="datetime-local"> in the user's local TZ.
// For users in India that's IST, but the value sent back is a NAÏVE string
// like "2026-05-19T14:30" (no timezone). To store correctly, we must treat
// the input as IST when converting to UTC for the DB.
// ─────────────────────────────────────────────────────────────────

/** Convert a UTC ISO string from the DB to the "YYYY-MM-DDTHH:MM" string that <input type="datetime-local"> expects, in IST. */
export function isoToISTLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  // Use en-CA which gives ISO-like YYYY-MM-DD; combine with hour/minute in IST
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Convert a naive datetime-local string ("YYYY-MM-DDTHH:MM") interpreted as IST into a UTC ISO string for the DB. */
export function istLocalInputToISO(local: string): string | null {
  if (!local) return null;
  // local looks like "2026-05-19T14:30"
  const match = local.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  // Build a Date from IST components: IST is UTC+5:30, so subtract 5h30m to get UTC
  const utcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? 0),
  );
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000; // +05:30
  return new Date(utcMs - istOffsetMs).toISOString();
}
