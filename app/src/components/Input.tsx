import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleAlert, Eye, EyeOff, X } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
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
  placeholder,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const hasValue = value !== undefined && value !== null && String(value).length > 0;
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const isFloating = focused || hasValue;

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`relative h-[60px] rounded-[16px] bg-surface-2 border transition-all flex items-center px-4 ${
          error
            ? 'border-danger border-[1.5px]'
            : focused
            ? 'border-primary border-[2px] shadow-sm'
            : 'border-line border-[1px]'
        }`}
      >
        {Icon && (
          <div className="w-[20px] flex items-center justify-center text-muted mr-3 flex-shrink-0">
            <Icon size={20} />
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center h-full relative min-w-0">
          {label && (
            <label
              className={`absolute left-0 transition-all duration-200 pointer-events-none ${
                isFloating
                  ? 'top-[6px] text-[11px] font-bold text-muted uppercase tracking-wider'
                  : 'top-[18px] text-[15px] font-medium text-muted'
              }`}
            >
              {label}
            </label>
          )}

          <input
            {...props}
            type={inputType}
            value={value}
            onChange={onChange}
            placeholder={isFloating || !label ? placeholder : ''}
            onFocus={(e) => {
              setFocused(true);
              if (props.onFocus) props.onFocus(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              if (props.onBlur) props.onBlur(e);
            }}
            className={`w-full bg-transparent border-none outline-none text-text t-body text-[16px] font-medium ${
              label ? 'pt-[20px] pb-[2px]' : 'py-2'
            }`}
          />
        </div>

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="w-10 h-10 flex items-center justify-center text-muted hover:text-text flex-shrink-0 ml-1"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}

        {!isPassword && onClear && hasValue && (
          <button
            type="button"
            onClick={onClear}
            className="w-10 h-10 flex items-center justify-center text-muted hover:text-text flex-shrink-0 ml-1"
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
