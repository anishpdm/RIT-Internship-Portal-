import {
  SkeletonPageHeader,
  SkeletonStats,
  SkeletonTable,
  Skeleton,
} from '@/components/Loading';

export default function Loading() {
  return (
    <>
      <SkeletonPageHeader />
      <SkeletonStats count={4} />
      <div className="grid lg:grid-cols-2 gap-5 mb-8">
        <div className="card">
          <Skeleton width={140} height={11} style={{ marginBottom: 16 }} />
          <div className="space-y-3">
            {[60, 75, 50, 80, 65].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton width={120} height={14} />
                <Skeleton width={`${w}%`} height={18} />
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <Skeleton width={140} height={11} style={{ marginBottom: 16 }} />
          <div className="flex items-center justify-center" style={{ height: 180 }}>
            <Skeleton width={140} height={140} rounded={70} />
          </div>
        </div>
      </div>
      <SkeletonTable rows={6} cols={6} />
    </>
  );
}
