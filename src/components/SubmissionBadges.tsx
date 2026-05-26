import { Clock, RefreshCw } from 'lucide-react';

/**
 * Renders "Late" and/or "Resubmitted" badges given a submission + assignment.
 * Pass null/undefined for missing fields — nothing renders if no badges apply.
 */
export default function SubmissionBadges({
  submittedAt,
  firstSubmittedAt,
  dueAt,
  resubmissionCount,
  size = 'md',
}: {
  submittedAt?: string | null;
  firstSubmittedAt?: string | null;
  dueAt?: string | null;
  resubmissionCount?: number | null;
  size?: 'sm' | 'md';
}) {
  const badges: React.ReactNode[] = [];

  const pad = size === 'sm'
    ? '0.18rem 0.5rem'
    : '0.25rem 0.65rem';
  const fs = size === 'sm' ? '0.7rem' : '0.75rem';
  const iconSize = size === 'sm' ? 10 : 12;

  // Late badge — compare FIRST submission against due date
  // (if they were late on first submit, they're late regardless of resubmissions)
  const compareAt = firstSubmittedAt ?? submittedAt;
  if (dueAt && compareAt) {
    const due = new Date(dueAt).getTime();
    const submitted = new Date(compareAt).getTime();
    if (submitted > due) {
      badges.push(
        <span
          key="late"
          className="inline-flex items-center gap-1 font-semibold rounded-full"
          style={{
            padding: pad,
            fontSize: fs,
            background: 'var(--red-soft)',
            color: 'var(--red-700)',
            border: '1px solid var(--red-500)',
          }}
        >
          <Clock size={iconSize} />
          Late
        </span>,
      );
    }
  }

  // Resubmitted badge
  if (resubmissionCount && resubmissionCount > 0) {
    badges.push(
      <span
        key="resub"
        className="inline-flex items-center gap-1 font-semibold rounded-full"
        style={{
          padding: pad,
          fontSize: fs,
          background: 'rgba(234, 179, 8, 0.12)',
          color: '#854d0e',
          border: '1px solid #eab308',
        }}
      >
        <RefreshCw size={iconSize} />
        Resubmitted{resubmissionCount > 1 ? ` ×${resubmissionCount}` : ''}
      </span>,
    );
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {badges}
    </div>
  );
}
