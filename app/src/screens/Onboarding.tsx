import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { onboarding as onboardingApi } from '@/api/endpoints';
import { ChevronLeft, Search, Check, Sparkles } from 'lucide-react';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import { ArtistCircle } from '@/components/MediaCard';
import { useUIStore } from '@/store/ui';

interface OptionItem {
  id: string;
  code?: string;
  name: string;
  label?: string;
  image?: string;
}

const STEPS = [
  { key: 'languages', title: 'Which languages do you listen to?', sub: 'Pick up to 5. You can change this anytime.' },
  { key: 'movies', title: 'Pick a few movies you love', sub: 'We will recommend songs from these soundtracks.' },
  { key: 'heroes', title: 'Who are your favourite heroes?', sub: 'Follow your favourite actors.' },
  { key: 'singers', title: 'Which singers do you love?', sub: 'Voices that match your mood.' },
  { key: 'directors', title: 'Favourite music directors?', sub: 'Composers behind the magic.' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);

  const [stepIndex, setStepIndex] = useState(0);
  const [bundle, setBundle] = useState<any>(null);
  const [items, setItems] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Selections
  const [selections, setSelections] = useState<Record<string, OptionItem[]>>({
    languages: [],
    movies: [],
    heroes: [],
    singers: [],
    directors: [],
  });

  const [search, setSearch] = useState('');
  const [completing, setCompleting] = useState(false);
  const [finishStepText, setFinishStepText] = useState('Reading your taste…');

  const currentStep = STEPS[stepIndex];
  const currentSelections = selections[currentStep.key] || [];

  // Backend names for each wizard step (GET /onboarding/options?type=...)
  const STEP_TYPE: Record<string, string> = {
    movies: 'movies',
    heroes: 'actors',
    singers: 'singers',
    directors: 'directors',
  };
  const [loadError, setLoadError] = useState(false);
  const [searching, setSearching] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Language code used for the backend (codes are names such as "hindi", "telugu")
  const language = selections.languages[0]?.id || 'hindi';

  const mapItems = (raw: any[]): OptionItem[] =>
    (raw || [])
      .map((item: any) => ({
        id: String(item.id || item.code || item.name || ''),
        name: item.name || item.label || '',
        image: item.image,
      }))
      .filter((i) => i.id && i.name);

  // GET /onboarding/bundle returns { steps: [{ key, items }] }. Older shape: { movies, actors, singers, directors }.
  const pickFromBundle = (data: any, key: string): OptionItem[] => {
    const type = STEP_TYPE[key];
    const fromSteps = data?.steps?.find((st: any) => st.key === type)?.items;
    return mapItems(fromSteps || data?.[type] || []);
  };

  // Load languages (step 1) or the bundle (steps 2-5)
  useEffect(() => {
    let alive = true;
    setLoadError(false);
    setSearch('');

    if (stepIndex === 0) {
      setLoading(true);
      onboardingApi
        .languages()
        .then((res: any) => {
          if (!alive) return;
          const langs = (res?.languages || res || []).map((l: any) => ({
            id: l.code || l.id,
            code: l.code || l.id,
            name: l.label || l.name,
            label: l.nativeName || l.label || l.name,
          }));
          setItems(langs);
          setLoading(false);
        })
        .catch(() => {
          if (!alive) return;
          setLoading(false);
          setLoadError(true);
        });
    } else if (bundle) {
      setItems(pickFromBundle(bundle, currentStep.key));
      setLoading(false);
    } else {
      setLoading(true);
      onboardingApi
        .bundle(language)
        .then((data: any) => {
          if (!alive) return;
          setBundle(data);
          setItems(pickFromBundle(data, currentStep.key));
          setLoading(false);
        })
        .catch(() => {
          if (!alive) return;
          setLoading(false);
          setLoadError(true);
        });
    }

    return () => {
      alive = false;
    };
  }, [stepIndex, reloadKey]);

  // Live search: calls GET /onboarding/options?type=&language=&q= (debounced). Falls back to filtering the bundle.
  useEffect(() => {
    if (stepIndex === 0) return;
    const q = search.trim();
    if (q.length < 2) {
      setSearching(false);
      if (bundle) setItems(pickFromBundle(bundle, currentStep.key));
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(() => {
      onboardingApi
        .options({ type: STEP_TYPE[currentStep.key], language, q })
        .then((res: any) => {
          if (alive) setItems(mapItems(res?.items || []));
        })
        .catch(() => {
          if (!alive) return;
          const local = pickFromBundle(bundle, currentStep.key).filter((i) =>
            i.name.toLowerCase().includes(q.toLowerCase())
          );
          setItems(local);
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search, stepIndex, bundle]);

  const toggleSelect = (item: OptionItem) => {
    const key = currentStep.key;
    const current = selections[key] || [];
    const exists = current.some((i) => i.id === item.id);

    if (exists) {
      setSelections((prev) => ({
        ...prev,
        [key]: current.filter((i) => i.id !== item.id),
      }));
    } else {
      if (key === 'languages' && current.length >= 5) {
        addToast('You can pick up to 5 languages', 'info');
        return;
      }
      setSelections((prev) => ({
        ...prev,
        [key]: [...current, item],
      }));
    }
  };

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((s) => s + 1);
      setSearch('');
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    setCompleting(true);

    // Text rotation
    const textSequence = [
      'Reading your taste…',
      'Matching movies and heroes…',
      'Tuning your first mix…',
    ];
    let textIdx = 0;
    const interval = setInterval(() => {
      textIdx = (textIdx + 1) % textSequence.length;
      setFinishStepText(textSequence[textIdx]);
    }, 1200);

    const startTime = Date.now();

    try {
      const body = {
        languages: selections.languages.map((l) => l.id),
        singers: selections.singers.map((s) => ({ id: s.id, name: s.name })),
        musicDirectors: selections.directors.map((d) => ({ id: d.id, name: d.name })),
        actors: selections.heroes.map((h) => ({ id: h.id, name: h.name })),
        favouriteMovies: selections.movies.map((m) => ({ id: m.id, name: m.name, image: m.image })),
      };

      await onboardingApi.complete(body);

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 3600 - elapsed);

      setTimeout(() => {
        clearInterval(interval);
        navigate('/home', { replace: true });
      }, remaining);
    } catch (err: any) {
      clearInterval(interval);
      addToast(err?.message || 'Failed to complete onboarding', 'error');
      setCompleting(false);
    }
  };

  if (completing) {
    return (
      <div className="relative w-full h-full bg-bg flex flex-col items-center justify-center overflow-hidden">
        {/* Concentric Pulsing Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            className="w-[200px] h-[200px] rounded-full border border-primary/40"
            animate={{ scale: [0.6, 1.8], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="w-[200px] h-[200px] rounded-full border border-primary/30 absolute"
            animate={{ scale: [0.6, 1.8], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, delay: 0.6, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="w-[200px] h-[200px] rounded-full border border-primary/20 absolute"
            animate={{ scale: [0.6, 1.8], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, delay: 1.2, repeat: Infinity, ease: 'easeOut' }}
          />
        </div>

        {/* Center 72px Mark */}
        <div className="w-[72px] h-[72px] rounded-[24px] bg-primary flex items-center justify-center shadow-2xl z-10 mb-8">
          <Sparkles size={36} className="text-on-primary" />
        </div>

        {/* Status Text */}
        <AnimatePresence mode="wait">
          <motion.h2
            key={finishStepText}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="t-h2 text-[20px] font-bold text-text text-center px-6 z-10"
          >
            {finishStepText}
          </motion.h2>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-bg flex flex-col justify-between overflow-hidden">
      {/* Header Bar */}
      <div className="px-5 pt-[calc(var(--sat)+12px)] pb-3 flex items-center justify-between gap-3">
        {stepIndex > 0 ? (
          <button
            onClick={() => setStepIndex((s) => s - 1)}
            className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          <div className="w-10" />
        )}

        {/* 5 Segment Progress Bar */}
        <div className="flex-1 flex items-center gap-1.5 h-1 max-w-[240px]">
          {STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`flex-1 h-full rounded-full transition-colors duration-300 ${
                idx <= stepIndex ? 'bg-primary' : 'bg-surface-2'
              }`}
            />
          ))}
        </div>

        {stepIndex > 0 ? (
          <Button
            variant="ghost"
            onClick={handleNext}
            className="t-cap text-[14px] text-muted hover:text-text px-2"
          >
            Skip
          </Button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Title & Subtitle */}
      <div className="px-5 pt-2 pb-3">
        <h1 className="t-h1 text-[28px] font-bold text-text">{currentStep.title}</h1>
        <p className="t-cap text-[13px] text-muted mt-1">{currentStep.sub}</p>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-5 pb-[160px]">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-[72px] rounded-[20px] bg-surface-2 animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 pt-16 text-center">
            <p className="t-h3 text-text">Couldn't load options</p>
            <p className="t-cap text-muted">Check your connection and try again.</p>
            <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>
          </div>
        ) : (
          <>
            {stepIndex > 0 && !searching && items.length === 0 && (
              <p className="t-cap text-muted text-center pt-10">
                {search.trim().length >= 2 ? `No results for "${search.trim()}"` : 'Nothing to show yet'}
              </p>
            )}
            {/* Step 1: Languages Grid (2-column) */}
            {currentStep.key === 'languages' && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                {items.map((item) => {
                  const isSelected = currentSelections.some((i) => i.id === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleSelect(item)}
                      className={`relative h-[72px] rounded-[20px] p-4 flex flex-col justify-center text-left transition-all duration-160 border ${
                        isSelected
                          ? 'bg-primary/14 border-primary border-[2px]'
                          : 'bg-surface-2 border-line hover:bg-surface-3'
                      }`}
                    >
                      <span className="t-h3 text-[16px] font-bold text-text">
                        {item.label || item.name}
                      </span>
                      <span className="t-cap text-[12px] text-muted">{item.name}</span>

                      {isSelected && (
                        <div className="absolute top-3 right-3 w-[22px] h-[22px] rounded-full bg-primary flex items-center justify-center text-on-primary">
                          <Check size={14} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 2: Movies Grid (3-column) */}
            {currentStep.key === 'movies' && (
              <div className="grid grid-cols-3 gap-3 mt-2">
                {items.map((item) => {
                  const isSelected = currentSelections.some((i) => i.id === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleSelect(item)}
                      className={`relative flex flex-col items-center rounded-[16px] overflow-hidden p-1.5 transition-all border ${
                        isSelected ? 'bg-primary/14 border-primary border-[3px]' : 'bg-surface-2 border-transparent'
                      }`}
                    >
                      <div className="w-full aspect-square rounded-[12px] overflow-hidden bg-surface-3 mb-1.5">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted">🎬</div>
                        )}
                      </div>
                      <span className="t-cap text-[12px] font-semibold text-text text-center line-clamp-2 leading-tight">
                        {item.name}
                      </span>

                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-on-primary">
                          <Check size={12} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Steps 3, 4, 5: Heroes / Singers / Directors Grid (3-column ArtistCircle) */}
            {(currentStep.key === 'heroes' || currentStep.key === 'singers' || currentStep.key === 'directors') && (
              <div className="grid grid-cols-3 gap-y-4 gap-x-2 mt-2 justify-items-center">
                {items.map((item) => {
                  const isSelected = currentSelections.some((i) => i.id === item.id);
                  return (
                    <div key={item.id} className="relative">
                      <ArtistCircle
                        id={item.id}
                        name={item.name}
                        image={item.image}
                        size={96}
                        onClick={() => toggleSelect(item)}
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-on-primary border-2 border-bg shadow-md">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sticky Bottom CTA Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-bg via-bg/90 to-transparent pt-6 pb-[calc(var(--sab)+16px)] px-5 flex flex-col gap-3 max-w-[480px] mx-auto">
        {/* Selected Chips Row */}
        {currentSelections.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {currentSelections.map((item) => (
              <Chip
                key={item.id}
                label={item.name}
                selected
                onRemove={() => toggleSelect(item)}
              />
            ))}
          </div>
        )}

        {/* Search Pill (Steps 2-5) */}
        {stepIndex > 0 && (
          <div className="relative h-[48px] rounded-[24px] bg-surface-2 border border-line flex items-center px-4">
            <Search size={20} className="text-muted mr-3 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${currentStep.key}…`}
              className="w-full bg-transparent outline-none text-text t-body text-[15px]"
            />
            {searching && <span className="ml-2 text-[12px] text-muted flex-shrink-0">Searching…</span>}
          </div>
        )}

        {/* Primary Action Button */}
        <Button
          size="lg"
          onClick={handleNext}
          disabled={stepIndex === 0 && currentSelections.length === 0}
          className="w-full"
        >
          {stepIndex < STEPS.length - 1 ? (
            `Continue${currentSelections.length > 0 ? ` · ${currentSelections.length} picked` : ''}`
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles size={18} />
              <span>Finish{currentSelections.length > 0 ? ` · ${currentSelections.length} picked` : ''}</span>
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}