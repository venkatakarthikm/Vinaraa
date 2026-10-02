import React, { useEffect } from 'react';
import type { PanInfo } from 'framer-motion';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/ui';
import { springs } from '@/motion';

interface SheetProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  headerAction?: React.ReactNode;
  maxHeight?: string;
  children: React.ReactNode;
}

export function Sheet({
  id,
  isOpen,
  onClose,
  title,
  headerAction,
  maxHeight = '88vh',
  children,
}: SheetProps) {
  const pushSheet = useUIStore((s) => s.pushSheet);
  const popSheet = useUIStore((s) => s.popSheet);

  useEffect(() => {
    if (isOpen) {
      pushSheet(id);
    } else {
      popSheet(id);
    }
    return () => {
      popSheet(id);
    };
  }, [isOpen, id, pushSheet, popSheet]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[50] flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springs.sheet}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            style={{ maxHeight }}
            className="relative z-[51] w-full max-w-[480px] mx-auto bg-surface surface-glass rounded-t-[32px] border-t border-line px-5 pt-3 pb-[calc(var(--sab)+16px)] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="w-[36px] h-[4px] bg-line rounded-[2px] mx-auto mb-4 flex-shrink-0 cursor-grab active:cursor-grabbing" />

            {title && (
              <div className="flex items-center justify-between pb-3 mb-2 flex-shrink-0 border-b border-line/40">
                <h2 className="t-h2 text-[20px] font-bold text-text">{title}</h2>
                {headerAction && <div>{headerAction}</div>}
              </div>
            )}

            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
