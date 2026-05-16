interface BarDatum {
  label: string;
  value: number;
  /** Optional secondary metric shown right of the bar */
  meta?: string;
}

/**
 * Print-friendly horizontal bar chart. Renders pure SVG, scales by container width.
 * Colours bars green/amber/red by value relative to threshold for at-a-glance read.
 */
export function HorizontalBarChart({
  data,
  max = 100,
  unit = '%',
  height = 22,
  thresholds = { good: 70, warn: 40 },
}: {
  data: BarDatum[];
  max?: number;
  unit?: string;
  height?: number;
  thresholds?: { good: number; warn: number };
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
        No data to display.
      </p>
    );
  }

  const rowHeight = height + 12;
  const labelWidth = 180;
  const valueWidth = 80;
  const chartHeight = data.length * rowHeight;
  const labelMaxLen = 28;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 760 ${chartHeight}`}
        style={{ width: '100%', minWidth: 560, height: 'auto' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {data.map((d, i) => {
          const y = i * rowHeight;
          const ratio = Math.max(0, Math.min(1, d.value / max));
          const barW = (760 - labelWidth - valueWidth) * ratio;
          const color =
            d.value >= thresholds.good
              ? '#10b981'
              : d.value >= thresholds.warn
                ? '#f59e0b'
                : '#ef4444';
          const trimmed =
            d.label.length > labelMaxLen
              ? d.label.slice(0, labelMaxLen - 1) + '…'
              : d.label;
          return (
            <g key={i}>
              {/* Label */}
              <text
                x={0}
                y={y + height / 2 + 5}
                fontSize="12"
                fontFamily="Inter, sans-serif"
                fill="#334155"
              >
                {trimmed}
              </text>
              {/* Track */}
              <rect
                x={labelWidth}
                y={y}
                width={760 - labelWidth - valueWidth}
                height={height}
                fill="#e2e8f0"
                rx={4}
              />
              {/* Bar */}
              <rect
                x={labelWidth}
                y={y}
                width={barW}
                height={height}
                fill={color}
                rx={4}
              />
              {/* Value */}
              <text
                x={760 - valueWidth + 8}
                y={y + height / 2 + 5}
                fontSize="12"
                fontFamily="JetBrains Mono, monospace"
                fontWeight={600}
                fill="#0f172a"
              >
                {d.value.toFixed(1)}
                {unit}
              </text>
              {d.meta && (
                <text
                  x={760 - valueWidth + 8}
                  y={y + height / 2 + 20}
                  fontSize="9"
                  fontFamily="Inter, sans-serif"
                  fill="#64748b"
                >
                  {d.meta}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Simple donut chart for status breakdown.
 */
export function DonutChart({
  data,
  size = 180,
  thickness = 32,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
        No data.
      </p>
    );
  }

  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let accumulated = 0;
  const segments = data.map((d) => {
    const fraction = d.value / total;
    const dashOffset = accumulated * circumference;
    accumulated += fraction;
    return {
      ...d,
      dasharray: `${fraction * circumference} ${circumference}`,
      dashoffset: -dashOffset,
    };
  });

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg width={size} height={size}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {segments.map((s, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="transparent"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={s.dasharray}
              strokeDashoffset={s.dashoffset}
            />
          ))}
        </g>
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="22"
          fontWeight={700}
          fill="#0f172a"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10"
          fill="#64748b"
        >
          total
        </text>
      </svg>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: d.color }}
            />
            <span className="font-medium" style={{ color: 'var(--ink-900)' }}>
              {d.label}
            </span>
            <span className="font-mono text-xs" style={{ color: 'var(--ink-500)' }}>
              {d.value} ({((d.value / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
