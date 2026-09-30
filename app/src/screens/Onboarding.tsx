import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { onboarding as onboardingApi } from '@/api/endpoints';
import { Check, ChevronLeft, Search, Music2 } from 'lucide-react';

interface OnboardingItem {
  id?: string;
  code?: string;
  name?: string;
  label?: string;
  emoji?: string;
  image?: string;
}

interface StepData {
  key: string;
  title: string;
  items: OnboardingItem[];
}

const stepOrder = ['languages', 'movies', 'actors', 'singers', 'directors'];

export default function Onboarding() {
  const [bundle, setBundle] = useState<{ steps: StepData[] } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, Set<string>>>({
    languages: new Set(), movies: new Set(), actors: new Set(), singers: new Set(), directors: new Set(),
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const navigate = useNavigate();

  useState(() => {
    onboardingApi.bundle().then((data) => { setBundle(data); setLoading(false); }).catch(() => setLoading(false));
  });

  const step = bundle?.steps?.[currentStep];
  const stepKey = step?.key || stepOrder[currentStep];
  const currentSelections = selections[stepKey] || new Set<string>();

  const toggleItem = (itemId: string) => {
    setSelections((prev) => {
      const set = new Set(prev[stepKey]);
      if (set.has(itemId)) set.delete(itemId);
      else set.add(itemId);
      return { ...prev, [stepKey]: set };
    });
  };

  const filteredItems = (step?.items || []).filter((item) => {
    const text = item.label || item.name || '';
    return !search || text.toLowerCase().includes(search.toLowerCase());
  });

  const handleContinue = async () => {
    if (currentStep < stepOrder.length - 1) { setCurrentStep((s) => s + 1); setSearch(''); return; }
    setCompleting(true);
    try {
      const body = {
        languages: [...(selections.languages || [])],
        favouriteMovies: [...(selections.movies || [])].map((id) => {
          const item = bundle?.steps?.find((s) => s.key === 'movies')?.items?.find((i) => i.id === id || i.code === id);
          return item ? { id: item.id || item.code, name: item.name || item.label } : { id, name: id };
        }),
        actors: [...(selections.actors || [])].map((id) => { return { id, name: id }; }),
        singers: [...(selections.singers || [])].map((id) => { return { id, name: id }; }),
        musicDirectors: [...(selections.directors || [])].map((id) => { return { id, name: id }; }),
      };
      await onboardingApi.complete(body);
    } catch (_e) {}
    navigate('/home', { replace: true });
    setCompleting(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-bg items-center justify-center">
        <Music2 size={48} className="text-primary animate-pulse" />
        <p className="text-muted mt-4">Loading your music world…</p>
      </div>
    );
  }

  if (completing) {
    return (
      <motion.div className="flex flex-col h-full bg-bg items-center justify-center text-center px-8"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-end gap-1 mb-8 h-16">
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.div key={i} className="w-3 bg-primary rounded-t-full"
              animate={{ height: [12, 64, 12] }}
              transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.1 }} />
          ))}
        </div>
        <h2 className="text-2xl font-bold text-text mb-3">Building your mix…</h2>
        <p className="text-muted">Personalising Vinaraa just for you.</p>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        {currentStep > 0 && (
          <button onClick={() => { setCurrentStep((s) => s - 1); setSearch(''); }}
            className="p-2 rounded-full bg-surface-2 flex-shrink-0" aria-label="Back">
            <ChevronLeft size={22} className="text-text" />
          </button>
        )}
        <div className="flex-1 flex gap-1.5">
          {stepOrder.map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-pill transition-all duration-300 ${i <= currentStep ? 'bg-primary' : 'bg-surface-2'}`} />
          ))}
        </div>
        <button onClick={() => navigate('/home', { replace: true })} className="text-muted text-sm font-medium px-2">Skip</button>
      </div>

      <div className="px-5 pb-4">
        <motion.h1 key={currentStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-text">
          {step?.title || 'Pick your favourites'}
        </motion.h1>
        <p className="text-muted text-sm mt-1">{currentSelections.size > 0 ? `${currentSelections.size} selected` : 'Tap to select'}</p>
      </div>

      {stepKey !== 'languages' && (
        <div className="px-5 mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${stepKey}…`}
              className="w-full bg-surface-2 text-text rounded-2xl py-3 pl-10 pr-4 outline-none border border-border focus:border-primary-soft text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-y px-4 pb-4">
        <motion.div key={currentStep} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={stepKey === 'languages' ? 'flex flex-col gap-2' : 'grid grid-cols-3 gap-3'}>
          {filteredItems.map((item, idx) => {
            const itemId = item.id || item.code || '';
            const isSelected = currentSelections.has(itemId);
            return (
              <motion.button key={itemId} custom={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx * 0.04, 0.32) } }}
                whileTap={{ scale: 0.96 }}
                onClick={() => toggleItem(itemId)}
                className={`relative rounded-2xl transition-all duration-200 ${
                  stepKey === 'languages'
                    ? `flex items-center gap-4 px-4 py-4 ${isSelected ? 'bg-primary/20 border-primary border' : 'bg-surface-2 border border-border'}`
                    : `flex flex-col items-center p-3 aspect-square ${isSelected ? 'bg-primary/20 border-primary border' : 'bg-surface-2 border border-border'}`
                }`}
              >
                {stepKey === 'languages' ? (
                  <>
                    <span className="text-2xl">{item.emoji}</span>
                    <span className="text-text font-semibold flex-1">{item.label}</span>
                    {isSelected && <Check size={18} className="text-primary" />}
                  </>
                ) : (
                  <>
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full aspect-square rounded-xl object-cover mb-1" />
                    ) : (
                      <div className="w-full aspect-square rounded-xl bg-surface flex items-center justify-center mb-1">
                        <Music2 size={24} className="text-muted" />
                      </div>
                    )}
                    <span className="text-text text-xs font-medium text-center leading-tight line-clamp-2">{item.name}</span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      <div className="px-5 pb-10 pt-3 bg-gradient-to-t from-bg to-transparent">
        <button onClick={handleContinue}
          className="w-full bg-gradient-to-r from-primary to-primary-soft text-white font-bold rounded-pill py-4 shadow-colored">
          {currentStep < stepOrder.length - 1
            ? `Continue${currentSelections.size > 0 ? ` · ${currentSelections.size} picked` : ''}`
            : `Finish${currentSelections.size > 0 ? ` · ${currentSelections.size} picked` : ''}`}
        </button>
      </div>
    </div>
  );
}
