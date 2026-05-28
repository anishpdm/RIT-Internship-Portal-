'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

/* ─── PageHeader ─────────────────────────────────────── */
export function PageHeader({ eyebrow, title, subtitle, actions }: {
  eyebrow?: string; title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-10 flex-wrap">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 shrink-0 flex-wrap items-center">{actions}</div>}
    </div>
  );
}

/* ─── Stat ───────────────────────────────────────────── */
export function Stat({ label, value, icon, accent = '#6366f1', trend }: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  trend?: { value: string; up?: boolean };
}) {
  const soft = accent + '18';
  return (
    <div className="card relative overflow-hidden group" style={{ borderTop: `3px solid ${accent}`, transition: 'all 200ms' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow='var(--s-md)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow=''; }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-num mt-1.5">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.up !== false ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
              <p className="text-xs font-semibold" style={{ color: trend.up !== false ? '#10b981' : '#ef4444' }}>{trend.value}</p>
            </div>
          )}
        </div>
        {icon && (
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
            style={{ background: soft }}
          >
            {icon}
          </div>
        )}
      </div>
      {/* Corner glow */}
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent}10 0%, transparent 70%)` }}/>
    </div>
  );
}

/* ─── Pill ───────────────────────────────────────────── */
export function Pill({ children, tone }: {
  children: React.ReactNode;
  tone?: 'accent'|'green'|'red'|'blue'|'amber'|'cyan'|'violet'|'rose';
}) {
  return <span className={tone ? `pill pill-${tone}` : 'pill'}>{children}</span>;
}

/* ─── EmptyState ─────────────────────────────────────── */
export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: string; }) {
  return (
    <div className="empty fade-in">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg,var(--ink-100),var(--ink-200))' }}>
        <span style={{ fontSize: '1.5rem' }}>{icon ?? '📋'}</span>
      </div>
      <p className="font-display font-bold text-lg" style={{ color: 'var(--ink-700)' }}>{title}</p>
      {hint && <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-400)' }}>{hint}</p>}
    </div>
  );
}
