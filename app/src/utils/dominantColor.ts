import { useState, useEffect } from 'react';
import { openDB } from 'idb';

const DB_NAME = 'vinaraa-colors';
const STORE_NAME = 'dominant-colors';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function fallbackColorForId(id: string): string {
  const hue = stringHash(id || 'default') % 360;
  return `hsl(${hue}, 55%, 50%)`;
}

function adjustColor(r: number, g: number, b: number): string {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  s = Math.max(s, 0.45);
  l = Math.min(Math.max(l, 0.45), 0.6);

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

export function extractDominantColor(url: string, id: string): Promise<string> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(fallbackColorForId(id));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(fallbackColorForId(id));
          return;
        }
        ctx.drawImage(img, 0, 0, 16, 16);
        const imgData = ctx.getImageData(4, 4, 8, 8).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < imgData.length; i += 4) {
          r += imgData[i];
          g += imgData[i + 1];
          b += imgData[i + 2];
          count++;
        }
        if (count === 0) {
          resolve(fallbackColorForId(id));
          return;
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        const color = adjustColor(r, g, b);
        getDB().then(db => db.put(STORE_NAME, color, url)).catch(() => {});
        resolve(color);
      } catch (_e) {
        resolve(fallbackColorForId(id));
      }
    };
    img.onerror = () => {
      resolve(fallbackColorForId(id));
    };
    img.src = url;
  });
}

export function useDominantColor(url?: string, songId?: string): string {
  const [color, setColor] = useState<string>(() => fallbackColorForId(songId || ''));

  useEffect(() => {
    if (!url) {
      setColor(fallbackColorForId(songId || ''));
      return;
    }

    let isMounted = true;
    getDB().then(async (db) => {
      const cached = await db.get(STORE_NAME, url);
      if (cached && isMounted) {
        setColor(cached);
        return;
      }
      const extracted = await extractDominantColor(url, songId || '');
      if (isMounted) {
        setColor(extracted);
      }
    }).catch(async () => {
      const extracted = await extractDominantColor(url, songId || '');
      if (isMounted) setColor(extracted);
    });

    return () => {
      isMounted = false;
    };
  }, [url, songId]);

  return color;
}
