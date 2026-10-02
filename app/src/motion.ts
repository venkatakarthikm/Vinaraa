export const springs = {
  snappy: { type: 'spring' as const, stiffness: 420, damping: 34 },
  soft:   { type: 'spring' as const, stiffness: 240, damping: 28 },
  sheet:  { type: 'spring' as const, stiffness: 320, damping: 34 },
  press:  { type: 'spring' as const, stiffness: 500, damping: 30 },
};

export const durations = {
  micro: 0.12,
  fast: 0.20,
  base: 0.28,
  page: 0.32,
  hero: 0.60,
};

export const easeOut = [0.22, 1, 0.36, 1] as const;
export const easeInOut = [0.65, 0, 0.35, 1] as const;

export const tabTransitionVariants = {
  initial: { opacity: 0, scale: 0.985 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.18, ease: easeOut },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    transition: { duration: 0.12, ease: easeInOut },
  },
};

export const pageTransitionVariants = {
  initial: { opacity: 0, x: 24 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: easeOut },
  },
  exit: {
    opacity: 0,
    x: -16,
    transition: { duration: 0.18, ease: easeInOut },
  },
};

export const listStaggerVariants = {
  initial: { opacity: 0, y: 16 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: Math.min(i, 8) * 0.04,
      duration: durations.base,
      ease: easeOut,
    },
  }),
};

export const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: durations.fast, ease: easeOut } },
  exit:    { opacity: 0, transition: { duration: durations.micro, ease: easeInOut } },
};
