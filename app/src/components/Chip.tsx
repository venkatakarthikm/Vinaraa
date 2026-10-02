import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';

interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: LucideIcon;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

export default function Chip({
  label,
  selected = false,
  icon: Icon,
  onRemove,
  onClick,
  className = '',
}: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={`h-[36px] px-4 rounded-[18px] inline-flex items-center gap-2 t-cap text-[14px] font-semibold transition-all duration-160 cursor-pointer select-none whitespace-nowrap ${
        selected
          ? 'bg-primary text-on-primary'
          : 'bg-surface-2 text-text hover:bg-surface-3'
      } ${className}`}
    >
      {Icon && <Icon size={16} className={selected ? 'text-on-primary' : 'text-text'} />}
      <span>{label}</span>
      {onRemove && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 -mr-1 rounded-full hover:bg-black/20"
        >
          <X size={14} />
        </span>
      )}
    </button>
  );
}
