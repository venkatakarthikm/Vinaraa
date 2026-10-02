import { music } from '@/api/endpoints';
import { formatPlayerSong } from '@/utils/song';
import type { Song } from '@/store/player';

/** Returns a Song guaranteed to have a non-empty streamUrl, or throws NO_STREAM_URL. */
export async function ensurePlayable(song: Song): Promise<Song> {
  if (song.localPath) return { ...song, streamUrl: song.localPath };
  if (song.streamUrl) return song;
  const full = await music.song(song.id);   // GET /music/songs/:id
  const f = formatPlayerSong(full?.song ?? full);
  if (!f.streamUrl) throw new Error('NO_STREAM_URL');
  return { ...song, ...f };
}
