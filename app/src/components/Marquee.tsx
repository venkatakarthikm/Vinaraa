import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function Marquee({ text, className = '' }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      if (textRef.current.offsetWidth > containerRef.current.offsetWidth) {
        setShouldAnimate(true);
      } else {
        setShouldAnimate(false);
      }
    }
  }, [text]);

  if (!shouldAnimate) {
    return (
      <div ref={containerRef} className={`overflow-hidden whitespace-nowrap line-clamp-1 ${className}`}>
        <span ref={textRef}>{text}</span>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`overflow-hidden whitespace-nowrap flex relative w-full ${className}`}
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
      }}
    >
      <motion.div
        className="flex min-w-max gap-8"
        animate={{ x: [0, -1 * (textRef.current?.offsetWidth || 200) - 32] }}
        transition={{ repeat: Infinity, ease: 'linear', duration: 8 }}
      >
        <span ref={textRef} className="block">{text}</span>
        <span className="block">{text}</span>
      </motion.div>
    </div>
  );
}
