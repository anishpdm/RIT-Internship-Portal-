import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Dense ranking — same score = same rank, no gaps.
 *   Scores 90, 85, 85, 70  →  ranks 1, 2, 2, 3
 * Rows MUST already be sorted descending by scoreKey.
 */
export function computeRanks<T extends Record<string, any>>(
  rows: T[],
  scoreKey: keyof T,
): (T & { rank: number })[] {
  let rank = 1;
  let lastScore: number | null = null;
  return rows.map((row, i) => {
    const score = Number(row[scoreKey]);
    if (i === 0) {
      lastScore = score;
      return { ...row, rank: 1 };
    }
    if (score !== lastScore) {
      rank++;
      lastScore = score;
    }
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
