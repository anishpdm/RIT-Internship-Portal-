// LevelScoreBadges — inline level pills for use in tables
// LevelScoreBreakdown — full card breakdown for student view
export function LevelScoreBadges({
  levels,
}: {
  levels: Array<{
    level_number: number;
    level_title: string | null;
    level_score: number;
    pass_threshold: number;
    reached: boolean;
    graded_count: number;
    total_count: number;
  }>;
}) {
  if (!levels.length) return <span style={{ color: 'var(--ink-300)', fontSize: '.8rem' }}>—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {levels.map(l => {
        const pct = l.level_score;
        const passed = pct >= l.pass_threshold;
        const color = !l.reached
          ? '#94a3b8'
          : passed ? '#10b981' : pct >= l.pass_threshold * 0.75 ? '#f59e0b' : '#ef4444';
        return (
          <div
            key={l.level_number}
            title={`L${l.level_number}: ${pct.toFixed(1)}% (threshold ${l.pass_threshold}%) · ${l.graded_count}/${l.total_count} graded`}
            className="flex items-center gap-1 rounded-lg px-2 py-1"
            style={{
              background: l.reached ? `${color}18` : 'var(--ink-50)',
              border: `1.5px solid ${l.reached ? `${color}44` : 'var(--ink-200)'}`,
              fontSize: '.72rem',
            }}
          >
            <span className="font-bold" style={{ color: l.reached ? color : 'var(--ink-400)' }}>
              L{l.level_number}
            </span>
            <span className="font-mono" style={{ color: l.reached ? color : 'var(--ink-400)' }}>
              {l.reached ? `${pct.toFixed(0)}%` : '—'}
            </span>
            {l.reached && passed && (
              <span style={{ color, fontSize: '.65rem' }}>✓</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LevelScoreBreakdown({
  levels,
  currentLevel,
  totalLevels,
}: {
  levels: Array<{
    level_number: number;
    level_title: string | null;
    level_score: number;
    pass_threshold: number;
    reached: boolean;
    graded_count: number;
    total_count: number;
  }>;
  currentLevel: number;
  totalLevels: number;
}) {
  return (
    <div className="space-y-2.5">
      {levels.map(l => {
        const pct = l.level_score;
        const isCurrent = l.level_number === currentLevel;
        const passed = pct >= l.pass_threshold;
        const locked = !l.reached;
        const color = locked ? '#94a3b8'
          : passed ? '#10b981'
          : pct >= l.pass_threshold * 0.75 ? '#f59e0b' : '#ef4444';

        return (
          <div
            key={l.level_number}
            className="rounded-xl p-3.5"
            style={{
              background: isCurrent
                ? 'linear-gradient(135deg,rgba(99,102,241,.08),rgba(99,102,241,.03))'
                : locked ? 'var(--ink-50)' : 'white',
              border: `1.5px solid ${isCurrent ? 'var(--accent)' : locked ? 'var(--ink-100)' : `${color}33`}`,
              opacity: locked ? 0.7 : 1,
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                  style={{
                    background: locked ? 'var(--ink-200)' : `${color}22`,
                    color: locked ? 'var(--ink-400)' : color,
                  }}
                >
                  {l.level_number}
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    Level {l.level_number}
                    {l.level_title ? ` — ${l.level_title}` : ''}
                    {isCurrent && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--accent)', color: 'white' }}>
                        CURRENT
                      </span>
                    )}
                    {l.level_number < currentLevel && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--green-soft)', color: 'var(--green-700)', border: '1px solid rgba(16,185,129,.2)' }}>
                        ✓ PASSED
                      </span>
                    )}
                    {locked && (
                      <span className="ml-2 text-[10px]" style={{ color: 'var(--ink-400)' }}>🔒 locked</span>
                    )}
                  </p>
                  {!locked && (
                    <p className="text-xs" style={{ color: 'var(--ink-400)' }}>
                      {l.graded_count}/{l.total_count} assignments graded · pass at {l.pass_threshold}%
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold" style={{ color: locked ? 'var(--ink-300)' : color, fontSize: '1.05rem' }}>
                  {locked ? '—' : `${pct.toFixed(1)}%`}
                </p>
              </div>
            </div>

            {!locked && (
              <div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ink-100)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, pct)}%`, background: color }}
                  />
                </div>
                {/* Threshold marker */}
                <div className="relative h-3">
                  <div
                    className="absolute w-px h-3 rounded"
                    style={{ left: `${l.pass_threshold}%`, background: 'var(--ink-400)', transform: 'translateX(-50%)' }}
                  />
                  <span
                    className="absolute text-[9px] font-semibold"
                    style={{ left: `${l.pass_threshold}%`, transform: 'translateX(-50%)', color: 'var(--ink-400)', top: 2 }}
                  >
                    {l.pass_threshold}%
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
