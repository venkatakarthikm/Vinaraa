import { getSongImage } from './image';

export function getArtistsText(song: any) {
  if (song?.artistsText) return song.artistsText;
  const list = song?.singers || song?.primaryArtists || song?.artists;
  if (typeof list === 'string') return list;
  if (Array.isArray(list)) return list.map((a: any) => typeof a === 'string' ? a : a.name).filter(Boolean).join(', ');
  return 'Unknown Artist';
}

export function formatPlayerSong(song: any) {
  return {
    id: song?.id || song?.saavnId || song?._id,
    name: song?.name || 'Unknown Song',
    artist: getArtistsText(song),
    image: getSongImage(song),
    durationMs: song?.durationMs || 0,
  };
}
