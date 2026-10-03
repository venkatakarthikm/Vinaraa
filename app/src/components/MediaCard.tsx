import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Disc3, Mic2, ListMusic } from 'lucide-react';

interface MediaCardProps {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  type?: 'song' | 'album' | 'artist' | 'playlist';
  width?: number | string;
  matchPercent?: number;
  onClick?: () => void;
  onPlayClick?: () => void;
  className?: string;
}

export function MediaCard({
  id,
  title,
  subtitle,
  image,
  type = 'album',
  width = 132,
  matchPercent,
  onClick,
  onPlayClick,
  className = '',
}: MediaCardProps) {
  const [imgError, setImgError] = useState(false);
  const showPlayFab = type === 'song' || type === 'album' || type === 'playlist';

  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`flex flex-col flex-shrink-0 cursor-pointer group ${className}`}
      style={{ width: typeof width === 'number' ? `${width}px` : width }}
    >
      <div className="relative w-full aspect-square rounded-[20px] overflow-hidden bg-surface-2 shadow-sm flex items-center justify-center">
        {image && !imgError ? (
          <motion.img
            layoutId={`art-${type}-${id}`}
            src={image}
            alt={title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted bg-gradient-to-br from-surface-2 to-surface-3">
            {type === 'artist' ? <Mic2 size={36} /> : type === 'playlist' ? <ListMusic size={36} /> : <Disc3 size={36} />}
          </div>
        )}

        {matchPercent && (
          <div className="absolute top-2 left-2 bg-black/55 backdrop-blur-sm text-white px-2 py-0.5 rounded-full t-micro text-[11px] font-semibold">
            {matchPercent}% match
          </div>
        )}

        {type && type !== 'song' && !matchPercent && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white">
            {type === 'album' && <Disc3 size={14} />}
            {type === 'artist' && <Mic2 size={14} />}
            {type === 'playlist' && <ListMusic size={14} />}
          </div>
        )}

        {showPlayFab && onPlayClick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayClick();
            }}
            className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md active:scale-95 transition-transform"
            aria-label="Play"
          >
            <Play size={18} fill="currentColor" className="ml-0.5" />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-col">
        <h3 className="t-h3 text-[14px] font-semibold text-text truncate leading-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="t-cap text-[12px] text-muted truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );
}

interface ArtistCircleProps {
  id: string;
  name: string;
  image?: string;
  size?: 88 | 96;
  onClick?: () => void;
  className?: string;
}

export function ArtistCircle({
  id,
  name,
  image,
  size = 88,
  onClick,
  className = '',
}: ArtistCircleProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={`flex flex-col items-center flex-shrink-0 cursor-pointer ${className}`}
      style={{ width: `${size}px` }}
    >
      <div
        className="rounded-full overflow-hidden bg-surface-2 shadow-sm border-2 border-transparent active:border-primary transition-colors flex items-center justify-center"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {image && !imgError ? (
          <motion.img
            layoutId={`art-artist-${id}`}
            src={image}
            alt={name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted bg-gradient-to-br from-surface-2 to-surface-3">
            <Mic2 size={32} />
          </div>
        )}
      </div>
      <span className="t-cap text-[13px] font-semibold text-text text-center mt-2 line-clamp-2 leading-snug w-full">
        {name}
      </span>
    </motion.div>
  );
}
