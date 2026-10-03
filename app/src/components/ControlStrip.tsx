import React, { useEffect } from 'react';
import { create } from 'zustand';

interface ControlStripState {
  content: React.ReactNode | null;
  setContent: (content: React.ReactNode | null) => void;
}

export const useControlStripStore = create<ControlStripState>((set) => ({
  content: null,
  setContent: (content) => set({ content }),
}));

export function ControlStrip({ children }: { children: React.ReactNode }) {
  const setContent = useControlStripStore((s) => s.setContent);

  useEffect(() => {
    setContent(children);
    return () => setContent(null);
  }, [children, setContent]);

  return null;
}

export function ControlStripSlot() {
  const content = useControlStripStore((s) => s.content);

  useEffect(() => {
    if (content) {
      document.documentElement.style.setProperty('--has-strip', '1');
    } else {
      document.documentElement.style.setProperty('--has-strip', '0');
    }
  }, [content]);

  if (!content) return null;

  return (
    <div
      className="fixed left-[12px] right-[12px] z-20 h-[52px] rounded-[26px] bg-surface/95 border border-line surface-glass flex items-center px-2 shadow-xl transition-all duration-200"
      style={{
        bottom: 'calc(var(--sab) + 64px + 12px)',
      }}
    >
      <div className="w-full flex items-center justify-between gap-2 px-1">
        {content}
      </div>
    </div>
  );
}
