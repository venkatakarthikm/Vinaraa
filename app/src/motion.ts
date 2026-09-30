export const springs = {
  snappy: { type: 'spring' as const, stiffness: 420, damping: 34 },
  soft: { type: 'spring' as const, stiffness: 220, damping: 26 },
  sheet: { type: 'spring' as const, stiffness: 300, damping: 32 }
};

export const durations = {
  micro: 0.15,
  standard: 0.28,
  page: 0.42
};

export const easings = {
  standard: [0.2, 0.8, 0.2, 1] as [number, number, number, number]
};

export const pageTransitionVariants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] as [number,number,number,number] } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] as [number,number,number,number] } }
};

export const pageTransitionBackVariants = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] as [number,number,number,number] } },
  exit: { opacity: 0, x: 12, transition: { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] as [number,number,number,number] } }
};

export const tabTransitionVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] as [number,number,number,number] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] as [number,number,number,number] } }
};

export const listStaggerVariants = {
  initial: { opacity: 0, y: 10 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.04,
      duration: 0.28,
      ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number]
    }
  })
};
