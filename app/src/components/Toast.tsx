import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/ui';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const iconMap = {
  success: <CheckCircle size={18} className="text-mint" />,
  error: <XCircle size={18} className="text-danger" />,
  info: <Info size={18} className="text-primary-soft" />,
};

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] flex flex-col gap-2 p-4 pt-safe pointer-events-none"
      style={{ paddingTop: `calc(env(safe-area-inset-top) + 16px)` }}>
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass rounded-2xl px-4 py-3 flex items-center gap-3 pointer-events-auto shadow-colored"
          >
            {iconMap[toast.type]}
            <span className="flex-1 text-sm text-text font-medium">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="text-muted">
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
