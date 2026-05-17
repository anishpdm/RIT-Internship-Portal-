/**
 * Skeleton placeholders for loading states.
 * Pure CSS animation via a shared keyframe defined in globals.css.
 */

export function Skeleton({
  className = '',
  style = {},
  width,
  height = 16,
  rounded = 6,
}: {
  className?: string;
  style?: React.CSSProperties;
  width?: number | string;
  height?: number | string;
  rounded?: number;
}) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{
        display: 'inline-block',
        width: width ?? '100%',
        height,
        borderRadius: rounded,
        ...style,
      }}
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={12}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card">
      <Skeleton width={120} height={10} style={{ marginBottom: 12 }} />
      <Skeleton width={200} height={28} style={{ marginBottom: 16 }} />
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <Skeleton width={80} height={10} style={{ marginBottom: 8 }} />
          <Skeleton width={60} height={32} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <Skeleton width={i === 0 ? 80 : 100} height={10} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  <Skeleton width={c === 0 ? '70%' : '50%'} height={12} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Page-level header skeleton matching PageHeader component */
export function SkeletonPageHeader() {
  return (
    <div className="mb-8">
      <Skeleton width={100} height={11} style={{ marginBottom: 10 }} />
      <Skeleton width={260} height={28} style={{ marginBottom: 10 }} />
      <Skeleton width={420} height={14} />
    </div>
  );
}

/**
 * Generic full-page skeleton — header + 4 stat cards + table.
 * Good default for `loading.tsx` files.
 */
export function PageSkeleton({
  stats = true,
  table = true,
  rows = 6,
}: {
  stats?: boolean;
  table?: boolean;
  rows?: number;
}) {
  return (
    <>
      <SkeletonPageHeader />
      {stats && <SkeletonStats count={4} />}
      {table && <SkeletonTable rows={rows} cols={5} />}
    </>
  );
}

/** Inline spinner — use inside buttons or for tiny async UIs */
export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size, display: 'inline-block' }}
      aria-hidden
    />
  );
}
