const PLACEHOLDER_HINT = 'artist-default';

function pickUrl(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v.includes(PLACEHOLDER_HINT) ? '' : v;
  if (Array.isArray(v)) {
    for (let i = v.length - 1; i >= 0; i--) {
      const item = v[i];
      const u = typeof item === 'string' ? item : item?.url || item?.link || '';
      if (u && !u.includes(PLACEHOLDER_HINT)) return u;
    }
    return '';
  }
  if (typeof v === 'object') return pickUrl(v.large || v.medium || v.small);
  return '';
}

/** Works for songs, albums, artists and playlists alike. */
export function getMediaImage(item: any): string {
  if (!item) return '';
  return pickUrl(item.image) || pickUrl(item.images) || pickUrl(item.artwork) || pickUrl(item.coverImageUrl) || '';
}

export function getSongImage(song: any): string {
  return getMediaImage(song);
}
