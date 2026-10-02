import { useState, useEffect } from 'react';
import { usePlayerStore } from '@/store/player';
import { usePrefsStore } from '@/store/prefs';
import { useDominantColor } from '@/utils/dominantColor';

export default function AmbientBackdrop() {
  const currentSong = usePlayerStore((s) => s.currentSong());
  const dominantColor = useDominantColor(currentSong?.image, currentSong?.id);
  const { theme, mode, ambientGlow, reduceEffects } = usePrefsStore();

  const [activeColor, setActiveColor] = useState(dominantColor);
  const [prevColor, setPrevColor] = useState(dominantColor);
  const [isCrossFading, setIsCrossFading] = useState(false);

  useEffect(() => {
    if (dominantColor !== activeColor) {
      setPrevColor(activeColor);
      setActiveColor(dominantColor);
      setIsCrossFading(true);
      const timer = setTimeout(() => setIsCrossFading(false), 600);
      return () => clearTimeout(timer);
    }
  }, [dominantColor, activeColor]);

  if (ambientGlow === 'off') {
    return <div className="fixed inset-0 -z-10 pointer-events-none bg-bg" />;
  }

  const isLowGlow = ambientGlow === 'low' || reduceEffects || (typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4);

  // Compute alphas based on theme/mode
  let alphaA = 0.1, alphaB = 0.07, alphaC = 0.05;
  if (theme === 'classic') {
    if (mode === 'light') {
      alphaA = 0.06; alphaB = 0.04; alphaC = 0.03;
    } else {
      alphaA = 0.10; alphaB = 0.07; alphaC = 0.05;
    }
  } else if (theme === 'glass') {
    if (mode === 'light') {
      alphaA = 0.35; alphaB = 0.28; alphaC = 0.20;
    } else {
      alphaA = 0.55; alphaB = 0.45; alphaC = 0.35;
    }
  } else {
    // Lagoon / Mint
    if (mode === 'light') {
      alphaA = 0.18; alphaB = 0.14; alphaC = 0.10;
    } else {
      alphaA = 0.30; alphaB = 0.22; alphaC = 0.16;
    }
  }

  const renderBlobs = (color: string) => {
    const colA = `color-mix(in srgb, ${color} ${Math.round(alphaA * 100)}%, transparent)`;
    const colB = `color-mix(in srgb, ${color} ${Math.round(alphaB * 100)}%, transparent)`;
    const colC = `color-mix(in srgb, ${color} ${Math.round(alphaC * 100)}%, transparent)`;

    return (
      <div className="absolute inset-0">
        {/* Blob A */}
        <div
          className={`absolute w-[90vw] h-[90vw] rounded-full left-[15%] top-[8%] -translate-x-1/2 -translate-y-1/2 ${
            !isLowGlow ? 'animate-drift-a' : ''
          }`}
          style={{
            background: `radial-gradient(circle, ${colA} 0%, transparent 70%)`,
          }}
        />
        {/* Blob B */}
        <div
          className={`absolute w-[80vw] h-[80vw] rounded-full left-[95%] top-[78%] -translate-x-1/2 -translate-y-1/2 ${
            !isLowGlow ? 'animate-drift-b' : ''
          }`}
          style={{
            background: `radial-gradient(circle, ${colB} 0%, transparent 70%)`,
          }}
        />
        {/* Blob C */}
        <div
          className={`absolute w-[70vw] h-[70vw] rounded-full left-[50%] top-[108%] -translate-x-1/2 -translate-y-1/2 ${
            !isLowGlow ? 'animate-drift-c' : ''
          }`}
          style={{
            background: `radial-gradient(circle, ${colC} 0%, transparent 70%)`,
          }}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-bg">
      {/* Previous Layer during cross-fade */}
      {isCrossFading && (
        <div className="absolute inset-0 transition-opacity duration-600 opacity-0">
          {renderBlobs(prevColor)}
        </div>
      )}

      {/* Active Layer */}
      <div className={`absolute inset-0 transition-opacity duration-600 opacity-100`}>
        {renderBlobs(activeColor)}
      </div>

      {/* Edge Glow */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: `inset 0 0 120px color-mix(in srgb, ${activeColor} 14%, transparent)`,
        }}
      />
    </div>
  );
}
