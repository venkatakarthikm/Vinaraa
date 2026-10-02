import { Sheet } from './SheetHost';
import { usePrefsStore } from '@/store/prefs';
import type { ThemeId, ThemeMode, AmbientLevel } from '@/store/prefs';
import { Check, SunMoon, Sun, Moon } from 'lucide-react';

interface ThemeSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEMES: { id: ThemeId; name: string; bg: string; primary: string }[] = [
  { id: 'classic', name: 'Classic', bg: '#000000', primary: '#FFFFFF' },
  { id: 'glass', name: 'Glass', bg: '#070914', primary: '#9DB8FF' },
  { id: 'lagoon', name: 'Lagoon', bg: '#06121A', primary: '#2DD4E0' },
  { id: 'mint', name: 'Mint Pulse', bg: '#07110D', primary: '#34E08A' },
];

export default function ThemeSheet({ isOpen, onClose }: ThemeSheetProps) {
  const {
    theme, setTheme,
    mode, setMode,
    ambientGlow, setAmbientGlow,
    reduceEffects, setReduceEffects,
  } = usePrefsStore();

  return (
    <Sheet id="theme-mode-sheet" isOpen={isOpen} onClose={onClose} title="Appearance">
      <div className="flex flex-col gap-6 py-3">
        <div className="flex flex-col gap-2">
          <span className="t-micro text-[11px] font-bold text-muted uppercase tracking-wider">
            Theme
          </span>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((t) => {
              const isSelected = theme === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  style={{ backgroundColor: t.bg }}
                  className={`relative h-[112px] rounded-[20px] p-4 flex flex-col justify-between border-2 cursor-pointer transition-all shadow-md ${
                    isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-line'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="t-h3 text-[15px] font-bold text-white">{t.name}</span>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-on-primary">
                        <Check size={12} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-12 rounded-full"
                      style={{ backgroundColor: t.primary }}
                    />
                    <div className="h-3 w-6 rounded-full bg-white/20" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="t-micro text-[11px] font-bold text-muted uppercase tracking-wider">
            Mode
          </span>
          <div className="h-[48px] bg-surface-2 p-1 rounded-[24px] flex items-center">
            {[
              { id: 'system' as ThemeMode, label: 'System', icon: SunMoon },
              { id: 'light' as ThemeMode, label: 'Light', icon: Sun },
              { id: 'dark' as ThemeMode, label: 'Dark', icon: Moon },
            ].map((m) => {
              const Icon = m.icon;
              const isSelected = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex-1 h-full rounded-[20px] flex items-center justify-center gap-2 t-cap text-[13px] font-bold transition-all ${
                    isSelected ? 'bg-primary text-on-primary shadow-sm' : 'text-muted'
                  }`}
                >
                  <Icon size={16} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="t-micro text-[11px] font-bold text-muted uppercase tracking-wider">
            Ambient glow
          </span>
          <div className="h-[48px] bg-surface-2 p-1 rounded-[24px] flex items-center">
            {['off', 'low', 'normal'].map((level) => {
              const isSelected = ambientGlow === level;
              return (
                <button
                  key={level}
                  onClick={() => setAmbientGlow(level as AmbientLevel)}
                  className={`flex-1 h-full rounded-[20px] t-cap text-[13px] font-bold capitalize transition-all ${
                    isSelected ? 'bg-primary text-on-primary shadow-sm' : 'text-muted'
                  }`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="t-body text-[15px] font-semibold text-text">Reduce effects</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={reduceEffects}
              onChange={(e) => setReduceEffects(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-[52px] h-[32px] bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[24px] after:w-[24px] after:transition-all peer-checked:bg-primary" />
          </label>
        </div>
      </div>
    </Sheet>
  );
}
