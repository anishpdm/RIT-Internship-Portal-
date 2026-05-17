import { SkeletonPageHeader, Skeleton } from '@/components/Loading';

export default function Loading() {
  return (
    <>
      <SkeletonPageHeader />
      <div className="card mb-6">
        <Skeleton width="100%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="90%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="60%" height={14} />
      </div>
      <div className="card mb-8">
        <Skeleton width={180} height={20} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={200} />
      </div>
      <Skeleton width={140} height={22} style={{ marginBottom: 12 }} />
      <div className="grid lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card">
            <Skeleton width="80%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton width="50%" height={11} />
          </div>
        ))}
      </div>
    </>
  );
}
