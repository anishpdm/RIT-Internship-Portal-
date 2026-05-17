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
      <SkeletonStats count={3} />
      <div className="mb-4">
        <Skeleton width={140} height={22} style={{ marginBottom: 12 }} />
      </div>
      <SkeletonTable rows={5} cols={6} />
    </>
  );
}
