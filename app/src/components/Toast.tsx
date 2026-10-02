import { motion, AnimatePresence } from 'framer-motion';
import { CircleCheck, CircleAlert, Info } from 'lucide-react';
import { useUIStore } from '@/store/ui';

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div
      className="fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 pointer-events-none px-4"
      style={{ bottom: 'calc(var(--bottom-chrome) + 8px)' }}
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          let Icon = Info;
          let iconColor = 'text-primary';
          if (toast.type === 'success') {
            Icon = CircleCheck;
            iconColor = 'text-success';
          } else if (toast.type === 'error') {
            Icon = CircleAlert;
            iconColor = 'text-danger';
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.x) > 60) {
                  removeToast(toast.id);
                }
              }}
              className="pointer-events-auto max-w-[320px] w-full min-h-[48px] rounded-[24px] bg-surface-3 surface-glass border border-line px-4 py-3 flex items-center justify-between gap-3 shadow-xl"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Icon size={20} className={`${iconColor} flex-shrink-0`} />
                <span className="t-cap text-[14px] font-medium text-text truncate">
                  {toast.message}
                </span>
              </div>

              {toast.action && (
                <button
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                  className="t-cap text-[14px] font-semibold text-primary hover:underline flex-shrink-0"
                >
                  {toast.action.label}
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
