import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface PageProps {
  children: React.ReactNode;
  title?: string;
  isTabRoot?: boolean;
  headerActions?: React.ReactNode;
  onScroll?: (scrollTop: number) => void;
  className?: string;
}

export default function Page({
  children,
  title,
  isTabRoot = false,
  headerActions,
  onScroll,
  className = '',
}: PageProps) {
  const navigate = useNavigate();
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    setScrollTop(top);
    if (onScroll) onScroll(top);
  };

  const isScrolledTab = isTabRoot && scrollTop > 16;
  const isScrolledDetail = !isTabRoot && scrollTop > 120;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={`absolute inset-0 overflow-y-auto overscroll-contain pb-[var(--bottom-chrome)] ${className}`}
    >
      {/* Header for Tab Root */}
      {isTabRoot && title && (
        <header
          className={`sticky top-0 z-20 flex items-center justify-between px-5 transition-all duration-180 bg-bg/95 backdrop-blur-md ${
            isScrolledTab ? 'border-b border-line shadow-sm' : ''
          }`}
          style={{ paddingTop: 'calc(var(--sat) + 8px)', paddingBottom: '8px' }}
        >
          <h1
            className="t-h1 transition-transform origin-left duration-180"
            style={{
              transform: isScrolledTab ? 'scale(0.85)' : 'scale(1)',
            }}
          >
            {title}
          </h1>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </header>
      )}

      {/* Header for Detail Page */}
      {!isTabRoot && (
        <header
          className={`sticky top-0 left-0 right-0 z-20 flex items-center justify-between px-3 transition-all duration-200 bg-bg/95 backdrop-blur-md ${
            isScrolledDetail ? 'border-b border-line shadow-sm' : ''
          }`}
          style={{ paddingTop: 'calc(var(--sat) + 8px)', paddingBottom: '8px' }}
        >
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-10 h-10 rounded-full bg-surface-2 text-text flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={22} />
          </button>

          {title && (
            <h2
              className={`t-h3 text-center flex-1 px-4 truncate transition-opacity duration-200 ${
                isScrolledDetail ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {title}
            </h2>
          )}

          {headerActions ? (
            <div className="flex items-center gap-2">{headerActions}</div>
          ) : (
            <div className="w-10" />
          )}
        </header>
      )}

      {/* Centered Content Column */}
      <main className="w-full max-w-[480px] mx-auto min-h-full">
        {children}
      </main>
    </div>
  );
}
