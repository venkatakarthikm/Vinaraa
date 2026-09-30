// Reusable skeleton loader with shimmer
interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className = '', count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`shimmer rounded-xl ${className}`} />
      ))}
    </>
  );
}

export function SongRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="shimmer w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1">
        <div className="shimmer h-4 w-32 rounded mb-2" />
        <div className="shimmer h-3 w-20 rounded" />
      </div>
      <div className="shimmer h-3 w-8 rounded" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="w-40 flex-shrink-0">
      <div className="shimmer w-40 h-40 rounded-2xl mb-2" />
      <div className="shimmer h-4 w-28 rounded mb-1" />
      <div className="shimmer h-3 w-20 rounded" />
    </div>
  );
}
