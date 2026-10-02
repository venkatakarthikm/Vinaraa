import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleAlert, Eye, EyeOff, X } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  error?: string;
  isPassword?: boolean;
  onClear?: () => void;
}

export default function Input({
  label,
  icon: Icon,
  error,
  isPassword = false,
  onClear,
  value,
  onChange,
  className = '',
  type = 'text',
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const hasValue = value !== undefined && value !== null && String(value).length > 0;
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`relative h-[60px] rounded-[16px] bg-surface-2 border transition-colors flex items-center px-4 ${
          error
            ? 'border-danger border-[1.5px]'
            : focused
            ? 'border-primary border-[2px]'
            : 'border-line border-[1px]'
        }`}
      >
        {Icon && (
          <div className="w-[20px] flex items-center justify-center text-muted mr-3">
            <Icon size={20} />
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center h-full relative">
          <label
            className={`absolute left-0 transition-all duration-160 pointer-events-none ${
              focused || hasValue
                ? 'top-[8px] t-micro text-[11px] text-muted font-medium'
                : 'top-[18px] t-body text-[15px] text-muted'
            }`}
          >
            {label}
          </label>

          <input
            {...props}
            type={inputType}
            value={value}
            onChange={onChange}
            onFocus={(e) => {
              setFocused(true);
              if (props.onFocus) props.onFocus(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              if (props.onBlur) props.onBlur(e);
            }}
            className="w-full bg-transparent border-none outline-none text-text t-body text-[16px] font-medium pt-[20px] pb-[4px]"
          />
        </div>

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="w-11 h-11 flex items-center justify-center text-muted hover:text-text"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}

        {!isPassword && onClear && hasValue && (
          <button
            type="button"
            onClick={onClear}
            className="w-11 h-11 flex items-center justify-center text-muted hover:text-text"
            aria-label="Clear field"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 mt-1.5 px-2 text-danger">
          <CircleAlert size={14} />
          <span className="t-cap text-[12px] font-medium">{error}</span>
        </div>
      )}
    </div>
  );
}
