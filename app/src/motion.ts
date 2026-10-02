// ─── Spring presets ──────────────────────────────────────────────────────────
export const springs = {
  snappy: { type: 'spring' as const, stiffness: 480, damping: 38, mass: 0.8 },
  soft:   { type: 'spring' as const, stiffness: 240, damping: 28, mass: 0.9 },
  sheet:  { type: 'spring' as const, stiffness: 340, damping: 34, mass: 0.85 },
};

// ─── Durations / easings ─────────────────────────────────────────────────────
export const durations = {
  micro:    0.12,
  standard: 0.22,
  page:     0.30,
};

// Smooth-in, quick-out — feels instant on tap
export const easeOut  = [0.0, 0.0, 0.2, 1.0] as [number, number, number, number];
export const easeIn   = [0.4, 0.0, 1.0, 1.0] as [number, number, number, number];
export const easeStd  = [0.22, 0.84, 0.34, 1.0] as [number, number, number, number];

// ─── Tab transitions (no x-shift — pure fade + micro-scale) ──────────────────
// AnimatePresence mode="sync" + these variants give seamless, jank-free tab switches.
export const tabTransitionVariants = {
  initial: {
    opacity: 0,
    scale: 0.985,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: durations.standard, ease: easeOut },
  },
  exit: {
    opacity: 0,
    scale: 1.005,
    transition: { duration: durations.micro, ease: easeIn },
  },
};

// ─── Page (detail) transitions — slide in from the right ─────────────────────
// Use only for /album, /artist, /playlist, /player, /settings etc.
export const pageTransitionVariants = {
  initial: { opacity: 0, x: 20, scale: 0.99 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: durations.page, ease: easeStd },
  },
  exit: {
    opacity: 0,
    x: -12,
    scale: 0.99,
    transition: { duration: durations.micro, ease: easeIn },
  },
};

export const pageTransitionBackVariants = {
  initial: { opacity: 0, x: -20, scale: 0.99 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: durations.page, ease: easeStd },
  },
  exit: {
    opacity: 0,
    x: 12,
    scale: 0.99,
    transition: { duration: durations.micro, ease: easeIn },
  },
};

// ─── Staggered list items ─────────────────────────────────────────────────────
export const listStaggerVariants = {
  initial: { opacity: 0, y: 12 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.035,
      duration: durations.standard,
      ease: easeStd,
    },
  }),
};

// ─── Fade only (for overlays, sheets, toasts) ────────────────────────────────
export const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: durations.standard, ease: easeOut } },
  exit:    { opacity: 0, transition: { duration: durations.micro, ease: easeIn } },
};
