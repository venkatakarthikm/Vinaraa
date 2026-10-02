import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
  size?: 'lg' | 'md' | 'sm';
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  children,
  className = '',
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 450);
  };

  let sizeClasses = 'h-[48px] px-6';
  if (size === 'lg') sizeClasses = 'h-[56px] px-6';
  if (size === 'sm') sizeClasses = 'h-[40px] px-4';

  let variantClasses = 'bg-primary text-on-primary font-bold t-h3 rounded-full';
  if (variant === 'secondary') {
    variantClasses = 'bg-surface-2 text-text border border-line font-bold t-h3 rounded-full';
  } else if (variant === 'ghost') {
    variantClasses = 'bg-transparent text-primary font-semibold t-body h-[44px] px-3 rounded-full';
  } else if (variant === 'danger') {
    variantClasses = 'bg-transparent text-danger font-semibold t-body h-[48px] px-4 rounded-full';
  } else if (variant === 'icon') {
    variantClasses = 'w-[44px] h-[44px] bg-surface-2 text-text flex items-center justify-center rounded-full';
    sizeClasses = '';
  }

  return (
    <button
      disabled={disabled || loading}
      onPointerDown={handlePointerDown}
      onClick={onClick}
      className={`relative overflow-hidden inline-flex items-center justify-center transition-transform active:scale-[0.96] duration-120 ${variantClasses} ${sizeClasses} ${
        disabled ? 'opacity-45 pointer-events-none' : ''
      } ${className}`}
      aria-busy={loading}
      {...props}
    >
      {/* Ripple elements */}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute bg-text/12 rounded-full pointer-events-none animate-ripple"
          style={{
            left: r.x,
            top: r.y,
            width: 0,
            height: 0,
          }}
        />
      ))}

      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 size={18} className="animate-spin text-current" />
          <span>{loadingText || children}</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
}
