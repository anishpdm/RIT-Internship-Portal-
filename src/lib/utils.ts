import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Dense ranking with multi-key tiebreakers.
 *
 * Rows must already be sorted by the same keys (descending).
 * Two rows share a rank only when ALL keys are equal.
 *
 * Example with keys ['combined', 'graded_submissions', 'submitted_count']:
 *   Jaidev  combined=81 graded=4 submitted=5  → rank 1
 *   CHRISSAN combined=81 graded=4 submitted=4  → rank 2  (submitted less)
 *   Emil    combined=81 graded=4 submitted=5  → rank 1  (same as Jaidev)
 */
export function computeRanks<T extends Record<string, any>>(
  rows: T[],
  keys: (keyof T) | (keyof T)[],
): (T & { rank: number })[] {
  const keyList = Array.isArray(keys) ? keys : [keys];

  function sameRank(a: T, b: T): boolean {
    return keyList.every(k => Number(a[k]) === Number(b[k]));
  }

  let rank = 1;
  return rows.map((row, i) => {
    if (i === 0) return { ...row, rank: 1 };
    if (!sameRank(row, rows[i - 1])) rank++;
    return { ...row, rank };
  });
}

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

export function isoToISTLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
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

export function istLocalInputToISO(local: string): string | null {
  if (!local) return null;
  const match = local.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const utcMs = Date.UTC(
    Number(y), Number(mo) - 1, Number(d),
    Number(h), Number(mi), Number(s ?? 0),
  );
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  return new Date(utcMs - istOffsetMs).toISOString();
}
