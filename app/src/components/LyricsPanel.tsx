// app/src/components/LyricsPanel.tsx
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { useLyrics, type LyricsSong } from '@/hooks/useLyrics';
import { findActiveIndex, type LyricLine } from '@/utils/lyrics';

/* Colours: work with the new theme tokens and fall back safely. */
const C = {
  primary: 'var(--c-primary, var(--color-primary, #9b6bff))',
  onPrimary: 'var(--c-onp, var(--color-on-primary, #ffffff))',
  ink: 'var(--c-ink, var(--color-text, #ffffff))',
  muted: 'var(--c-ink2, var(--color-muted, #a9a5d1))',
  surface: 'var(--c-s2, var(--color-surface-2, rgba(255,255,255,.12)))',
};

const LEAD_MS = 200; // highlight slightly early to hide UI/native latency
const RESUME_FOLLOW_MS = 3500; // auto-follow resumes after the user stops touching

interface Props {
  song: LyricsSong | null | undefined;
  /** current playback position in MILLISECONDS (from your progress store) */
  positionMs: number;
  isPlaying: boolean;
  /** called with a position in MILLISECONDS when the user taps a synced line */
  onSeek?: (ms: number) => void;
  className?: string;
}

/**
 * Active line index, updated ~10x/second between the (slow) position updates,
 * and only triggers a re-render when the index actually changes.
 */
function useActiveIndex(
  lines: LyricLine[],
  synced: boolean,
  positionMs: number,
  isPlaying: boolean,
): number {
  const base = useRef({ ms: positionMs, at: performance.now() });
  const [idx, setIdx] = useState(-1);

  useEffect(() => {
    base.current = { ms: positionMs, at: performance.now() };
  }, [positionMs]);

  useEffect(() => {
    if (!synced || !lines.length) {
      setIdx(-1);
      return;
    }
    const compute = () => {
      const { ms, at } = base.current;
      const estimated = isPlaying ? ms + Math.min(performance.now() - at, 1200) : ms;
      const next = findActiveIndex(lines, estimated + LEAD_MS);
      setIdx((prev) => (prev === next ? prev : next));
    };
    compute();
    if (!isPlaying) return;
    const t = window.setInterval(compute, 100);
    return () => window.clearInterval(t);
  }, [lines, synced, isPlaying, positionMs]);

  return idx;
}

type LineState = 'past' | 'active' | 'future';

const Line = memo(function Line({
  index,
  text,
  state,
  seekable,
  onTap,
  register,
}: {
  index: number;
  text: string;
  state: LineState;
  seekable: boolean;
  onTap: (index: number) => void;
  register: (index: number, el: HTMLDivElement | null) => void;
}) {
  if (!text) {
    // instrumental gap
    return (
      <div
        ref={(el) => register(index, el)}
        style={{ minHeight: state === 'active' ? 44 : 16, display: 'flex', alignItems: 'center' }}
        aria-hidden={state !== 'active'}
      >
        {state === 'active' && (
          <span style={{ color: C.primary, fontSize: 22, letterSpacing: 6 }}>♪ ♪ ♪</span>
        )}
      </div>
    );
  }
  const active = state === 'active';
  return (
    <div
      ref={(el) => register(index, el)}
      role={seekable ? 'button' : undefined}
      tabIndex={seekable ? 0 : undefined}
      aria-current={active ? 'true' : undefined}
      onClick={seekable ? () => onTap(index) : undefined}
      style={{
        padding: '8px 10% 8px 0',
        fontSize: 22,
        lineHeight: '36px',
        fontWeight: 650,
        textAlign: 'left',
        color: active ? C.primary : C.ink,
        opacity: active ? 1 : state === 'past' ? 0.42 : 0.6,
        transform: active ? 'scale(1.08)' : 'scale(1)',
        transformOrigin: 'left center',
        transition: 'transform 260ms cubic-bezier(.16,1,.3,1), opacity 260ms, color 260ms',
        cursor: seekable ? 'pointer' : 'default',
        willChange: 'transform',
        overflowWrap: 'anywhere',
      }}
    >
      {text}
    </div>
  );
});

export default function LyricsPanel({ song, positionMs, isPlaying, onSeek, className }: Props) {
  const { status, data, retry } = useLyrics(song);
  const lines = data?.lines ?? [];
  const synced = !!data?.synced;
  const activeIndex = useActiveIndex(lines, synced, positionMs, isPlaying);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lineEls = useRef<(HTMLDivElement | null)[]>([]);
  const [follow, setFollow] = useState(true);
  const [pad, setPad] = useState(160);
  const resumeTimer = useRef<number | undefined>(undefined);
  const firstScroll = useRef(true);

  const register = useCallback((i: number, el: HTMLDivElement | null) => {
    lineEls.current[i] = el;
  }, []);

  /* Keep top/bottom padding at ~42% of the panel so any line can sit in the middle */
  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const update = () => setPad(Math.round(c.clientHeight * 0.42));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(c);
    return () => ro.disconnect();
  }, [status]);

  /* New song: start from the top and follow again */
  useEffect(() => {
    firstScroll.current = true;
    lineEls.current = [];
    setFollow(true);
    window.clearTimeout(resumeTimer.current);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [song?.id]);

  const scrollToIndex = useCallback((i: number, smooth: boolean) => {
    const c = scrollRef.current;
    const el = lineEls.current[i];
    if (!c || !el) return;
    // offsetTop is relative to the positioned wrapper that lives inside the scroller
    const top = el.offsetTop - (c.clientHeight - el.offsetHeight) / 2;
    c.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  /* Follow the active line (only scrolls when the index changes) */
  useEffect(() => {
    if (status !== 'ready' || !synced || activeIndex < 0 || !follow) return;
    scrollToIndex(activeIndex, !firstScroll.current);
    firstScroll.current = false;
  }, [activeIndex, follow, status, synced, scrollToIndex]);

  /* User is touching/scrolling: stop auto-follow, resume a bit later */
  const pauseFollow = useCallback(() => {
    window.clearTimeout(resumeTimer.current);
    setFollow(false);
  }, []);
  const scheduleResume = useCallback(() => {
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setFollow(true), RESUME_FOLLOW_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(resumeTimer.current), []);

  const handleTap = useCallback(
    (i: number) => {
      const t = lines[i]?.timeMs;
      if (onSeek && t !== undefined && t >= 0) {
        setFollow(true);
        onSeek(t);
      }
    },
    [lines, onSeek],
  );

  /* ---------------------------- states ---------------------------- */
  if (status === 'loading') {
    return (
      <div className={className} style={{ padding: '24px 20px' }} aria-busy="true" aria-label="Loading lyrics">
        {[78, 62, 88, 54, 72, 66].map((w, i) => (
          <div
            key={i}
            style={{
              height: 22,
              width: `${w}%`,
              borderRadius: 11,
              background: C.surface,
              margin: '18px 0',
              opacity: 0.8,
            }}
          />
        ))}
        <p style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>Finding lyrics…</p>
      </div>
    );
  }

  if (status !== 'ready' || !lines.length) {
    const isError = status === 'error';
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 32,
          textAlign: 'center',
        }}
      >
        <p style={{ color: C.ink, fontSize: 18, fontWeight: 700 }}>
          {isError ? "Couldn't load lyrics" : 'No lyrics found'}
        </p>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: '22px' }}>
          {isError ? 'Check your connection and try again.' : "We couldn't find lyrics for this song yet."}
        </p>
        <button
          type="button"
          onClick={retry}
          style={{
            height: 44,
            padding: '0 24px',
            borderRadius: 22,
            background: C.primary,
            color: C.onPrimary,
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {isError ? 'Retry' : 'Search again'}
        </button>
      </div>
    );
  }

  /* ---------------------------- ready ---------------------------- */
  const mask = 'linear-gradient(to bottom, transparent 0, #000 12%, #000 88%, transparent 100%)';

  return (
    <div className={className} style={{ position: 'relative', minHeight: 0 }}>
      <div
        ref={scrollRef}
        role="region"
        aria-label="Lyrics"
        onPointerDown={pauseFollow}
        onPointerUp={scheduleResume}
        onPointerCancel={scheduleResume}
        onWheel={() => {
          pauseFollow();
          scheduleResume();
        }}
        style={{
          height: '100%',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
          scrollbarWidth: 'none',
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      >
        {/* positioned wrapper => children's offsetTop is measured from here */}
        <div style={{ position: 'relative', padding: `${pad}px 20px ${pad}px` }}>
          {!synced && (
            <p style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>
              These lyrics aren't time-synced.
            </p>
          )}
          {lines.map((l, i) => (
            <Line
              key={`${song?.id}-${i}`}
              index={i}
              text={l.text}
              state={!synced ? 'future' : i === activeIndex ? 'active' : i < activeIndex ? 'past' : 'future'}
              seekable={synced}
              onTap={handleTap}
              register={register}
            />
          ))}
        </div>
      </div>

      {synced && !follow && activeIndex >= 0 && (
        <button
          type="button"
          aria-label="Jump to current line"
          onClick={() => {
            setFollow(true);
            scrollToIndex(activeIndex, true);
          }}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            height: 40,
            padding: '0 16px',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: C.primary,
            color: C.onPrimary,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <LocateFixed size={16} /> Sync
        </button>
      )}
    </div>
  );
}