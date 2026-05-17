import {
  SkeletonPageHeader,
  SkeletonTable,
  Skeleton,
} from '@/components/Loading';

export default function Loading() {
  return (
    <>
      <SkeletonPageHeader />
      <div className="space-y-10">
        {[1, 2].map((i) => (
          <section key={i}>
            <Skeleton width={220} height={26} style={{ marginBottom: 16 }} />
            <div className="card mb-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton width={48} height={48} rounded={24} />
                  <div>
                    <Skeleton width={120} height={14} style={{ marginBottom: 6 }} />
                    <Skeleton width={200} height={10} />
                  </div>
                </div>
                <Skeleton width={70} height={28} />
              </div>
            </div>
            <Skeleton width={140} height={20} style={{ marginBottom: 12 }} />
            <SkeletonTable rows={5} cols={6} />
          </section>
        ))}
      </div>
    </>
  );
}
