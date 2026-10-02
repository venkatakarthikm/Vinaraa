import { usePrefsStore } from '@/store/prefs';

interface SkeletonProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  radius?: number | string;
}

export function Skeleton({ className = '', width, height, radius }: SkeletonProps) {
  const reduceEffects = usePrefsStore((s) => s.reduceEffects);

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
  };

  return (
    <div
      style={style}
      className={`relative overflow-hidden bg-surface-2 ${className}`}
    >
      {!reduceEffects && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent animate-shimmer" />
      )}
    </div>
  );
}

export function SongRowSkeleton() {
  return (
    <div className="w-full h-[64px] px-5 flex items-center justify-between gap-3">
      <Skeleton width={48} height={48} radius={12} />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton width="60%" height={16} radius={8} />
        <Skeleton width="40%" height={12} radius={6} />
      </div>
      <Skeleton width={32} height={12} radius={6} />
    </div>
  );
}

export function MediaCardSkeleton() {
  return (
    <div className="w-[132px] flex flex-col gap-2 flex-shrink-0">
      <Skeleton width={132} height={132} radius={20} />
      <Skeleton width="80%" height={14} radius={6} />
      <Skeleton width="50%" height={12} radius={6} />
    </div>
  );
}

export { MediaCardSkeleton as CardSkeleton };
