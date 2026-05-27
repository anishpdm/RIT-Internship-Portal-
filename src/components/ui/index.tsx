import { type LucideIcon } from 'lucide-react';

/* ─── PageHeader ──────────────────────────────────────── */
export function PageHeader({
  eyebrow, title, subtitle, actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-10 flex-wrap">
      <div>
        {eyebrow && (
          <p className="eyebrow mb-1.5" style={{ color: 'var(--accent)' }}>{eyebrow}</p>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex gap-2 shrink-0 flex-wrap items-center">{actions}</div>
      )}
    </div>
  );
}

/* ─── Stat ────────────────────────────────────────────── */
const STAT_ACCENTS = [
  { bar: '#6366f1', soft: '#eef2ff' },
  { bar: '#10b981', soft: '#ecfdf5' },
  { bar: '#06b6d4', soft: '#ecfeff' },
  { bar: '#f59e0b', soft: '#fffbeb' },
  { bar: '#ef4444', soft: '#fef2f2' },
  { bar: '#8b5cf6', soft: '#f5f3ff' },
];

let _statIdx = 0;

export function Stat({
  label, value, icon: Icon, accent, trend,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  accent?: string;
  trend?: { value: string; up?: boolean };
}) {
  const ac = accent
    ? { bar: accent, soft: accent + '18' }
    : STAT_ACCENTS[_statIdx++ % STAT_ACCENTS.length];
  return (
    <div
      className="card relative overflow-hidden"
      style={{ borderTop: `3px solid ${ac.bar}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-num mt-1">{value}</p>
          {trend && (
            <p
              className="text-xs mt-1.5 font-medium"
              style={{ color: trend.up !== false ? 'var(--green-700)' : 'var(--red-700)' }}
            >
              {trend.up !== false ? '▲' : '▼'} {trend.value}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: ac.soft }}
          >
            <Icon size={18} style={{ color: ac.bar }} />
          </div>
        )}
      </div>
      {/* Subtle background glow */}
      <div
        className="absolute bottom-0 right-0 w-20 h-20 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${ac.bar}12 0%, transparent 70%)`,
          transform: 'translate(30%, 30%)',
        }}
      />
    </div>
  );
}

/* ─── Pill ────────────────────────────────────────────── */
export function Pill({
  children, tone,
}: {
  children: React.ReactNode;
  tone?: 'accent' | 'green' | 'red' | 'blue' | 'amber' | 'cyan';
}) {
  const cls = tone ? `pill pill-${tone}` : 'pill';
  return <span className={cls}>{children}</span>;
}

/* ─── EmptyState ──────────────────────────────────────── */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty fade-in">
      <div
        className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: 'var(--ink-100)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-400)" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <path d="M9 12h6M12 9v6"/>
        </svg>
      </div>
      <p className="font-display font-semibold text-lg" style={{ color: 'var(--ink-700)' }}>{title}</p>
      {hint && <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-400)' }}>{hint}</p>}
    </div>
  );
}
