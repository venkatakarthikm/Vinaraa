export const springs = {
  snappy: { type: 'spring' as const, stiffness: 420, damping: 34 },
  soft:   { type: 'spring' as const, stiffness: 240, damping: 28 },
  sheet:  { type: 'spring' as const, stiffness: 320, damping: 34 },
  press:  { type: 'spring' as const, stiffness: 500, damping: 30 },
};

export const durations = {
  micro: 0.12,
  fast: 0.20,
  base: 0.32,
  page: 0.42,
  hero: 0.60,
};

export const easeOut = [0.22, 1, 0.36, 1] as const;
export const easeInOut = [0.65, 0, 0.35, 1] as const;

export const tabDrawerUpVariants = {
  initial: {
    y: '100%',
    borderTopLeftRadius: '28px',
    borderTopRightRadius: '28px',
  },
  animate: {
    y: 0,
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    transition: {
      duration: durations.page,
      ease: easeOut,
    },
  },
  exit: {
    scale: 0.96,
    y: -12,
    opacity: 0.6,
    transition: {
      duration: durations.page,
      ease: easeOut,
    },
  },
};

export const tabTransitionVariants = tabDrawerUpVariants;

export const pagePushVariants = {
  initial: { opacity: 0, x: '28%' },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: durations.base, ease: easeOut },
  },
  exit: {
    opacity: 0,
    x: '-14%',
    transition: { duration: durations.base, ease: easeOut },
  },
};

export const pageTransitionVariants = pagePushVariants;

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
