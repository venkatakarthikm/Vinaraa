import { getSongImage } from './image';

export function getArtistsText(song: any) {
  if (song?.artistsText) return song.artistsText;
  const list = song?.singers || song?.primaryArtists || song?.artists;
  if (typeof list === 'string') return list;
  if (Array.isArray(list)) return list.map((a: any) => typeof a === 'string' ? a : a.name).filter(Boolean).join(', ');
  if (list && typeof list === 'object') {
    if (Array.isArray(list.primary)) return list.primary.map((a: any) => typeof a === 'string' ? a : a.name).filter(Boolean).join(', ');
    if (Array.isArray(list.all)) return list.all.map((a: any) => typeof a === 'string' ? a : a.name).filter(Boolean).join(', ');
  }
  return 'Unknown Artist';
}

export function formatPlayerSong(song: any) {
  const songId = song?.songId || song?.id || song?.saavnId || song?._id;
  const directUrl =
    song?.audio?.best ||
    (Array.isArray(song?.audio?.formats) && song.audio.formats[song.audio.formats.length - 1]?.url) ||
    (Array.isArray(song?.downloadUrl) && song.downloadUrl[song.downloadUrl.length - 1]?.url) ||
    '';

  return {
    id: songId,
    name: song?.name || song?.title || 'Unknown Song',
    artist: getArtistsText(song),
    image: getSongImage(song),
    durationMs: song?.durationMs || (song?.duration ? song.duration * 1000 : 0),
    album: song?.album?.name || song?.album,
    albumId: song?.album?.id || song?.albumId,
    language: song?.language,
    streamUrl: directUrl,
    formats: song?.audio?.formats || song?.downloadUrl || [],
    singers: song?.singers || [],
    musicDirectors: song?.musicDirectors || [],
    actors: song?.actors || [],
    lyricists: song?.lyricists || [],
  };
}
