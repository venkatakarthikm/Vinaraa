import { usePrefsStore } from '@/store/prefs';

interface EqBarsProps {
  isPlaying?: boolean;
  color?: 'primary' | 'white';
  className?: string;
}

export default function EqBars({ isPlaying = true, color = 'primary', className = '' }: EqBarsProps) {
  const reduceEffects = usePrefsStore((s) => s.reduceEffects);

  const barBg = color === 'white' ? 'bg-white' : 'bg-primary';

  if (reduceEffects || !isPlaying) {
    return (
      <div className={`flex items-end gap-[2px] h-[12px] ${className}`}>
        <div className={`w-[3px] h-full rounded-[2px] ${barBg} opacity-40`} style={{ transform: 'scaleY(0.4)', transformOrigin: 'bottom' }} />
        <div className={`w-[3px] h-full rounded-[2px] ${barBg} opacity-40`} style={{ transform: 'scaleY(0.6)', transformOrigin: 'bottom' }} />
        <div className={`w-[3px] h-full rounded-[2px] ${barBg} opacity-40`} style={{ transform: 'scaleY(0.4)', transformOrigin: 'bottom' }} />
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-[2px] h-[12px] ${className}`}>
      <div
        className={`w-[3px] h-full rounded-[2px] ${barBg} animate-eq-1`}
        style={{ transformOrigin: 'bottom' }}
      />
      <div
        className={`w-[3px] h-full rounded-[2px] ${barBg} animate-eq-2`}
        style={{ transformOrigin: 'bottom' }}
      />
      <div
        className={`w-[3px] h-full rounded-[2px] ${barBg} animate-eq-3`}
        style={{ transformOrigin: 'bottom' }}
      />
    </div>
  );
}
