export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6 mb-10">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title mt-1">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="card">
      <p className="stat-num">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}

export function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'accent' | 'green' | 'red' | 'blue';
}) {
  const cls = tone ? `pill pill-${tone}` : 'pill';
  return <span className={cls}>{children}</span>;
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="empty">
      <p className="font-display text-xl">{title}</p>
      {hint && <p className="mt-2 text-sm">{hint}</p>}
    </div>
  );
}
