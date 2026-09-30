export function getSongImage(song: any): string {
  if (!song) return '';
  if (typeof song.image === 'string') return song.image;
  if (Array.isArray(song.image) && song.image.length > 0) {
    const last = song.image[song.image.length - 1];
    return last?.url || last?.link || last || '';
  }
  if (Array.isArray(song.images) && song.images.length > 0) {
    const last = song.images[song.images.length - 1];
    return last?.url || last?.link || last || '';
  }
  return '';
}
