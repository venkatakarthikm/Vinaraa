'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef0123456789';
process.env.ADMIN_API_KEY = 'test-admin-key-0123456789';
process.env.CACHE_MONGO_TIER = 'true';
process.env.BCRYPT_ROUNDS = '4'; 
process.env.UPSTREAM_URLS = 'https://mock.workers.dev';

const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

// MOCK the fetch function globally
const originalFetch = global.fetch;

global.fetch = async (url, opts) => {
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  const searchParams = urlObj.searchParams;

  if (path.includes('/albums') && searchParams.has('link')) {
    if (searchParams.get('link') === 'https://www.jiosaavn.com/album/mock-album/mock123') {
      return {
        ok: true,
        text: async () => JSON.stringify({
          success: true,
          data: { id: "53134856", name: "Mock Album", songs: [{ id: "mock_song_1", name: "S1" }] }
        })
      };
    } else {
      return {
        ok: true,
        text: async () => JSON.stringify({ success: false })
      };
    }
  }

  if (path.includes('/search/songs')) {
    const page = parseInt(searchParams.get('page') || '0', 10);
    // Mock overlapping pages:
    // Page 0: items 1..20
    // Page 1: items 15..35 (overlap!)
    // Page 2: items 15..35 (repeated!)
    // Page 3: items 36..40 (premature end)
    let songs = [];
    if (page === 0) {
      songs = Array.from({length: 20}).map((_, i) => ({ id: `song_${i+1}`, name: `Song ${i+1}` }));
    } else if (page === 1) {
      songs = Array.from({length: 21}).map((_, i) => ({ id: `song_${i+15}`, name: `Song ${i+15}` }));
    } else if (page === 2) {
      songs = Array.from({length: 21}).map((_, i) => ({ id: `song_${i+15}`, name: `Song ${i+15}` })); // identical to page 1
    } else if (page === 3) {
      songs = Array.from({length: 5}).map((_, i) => ({ id: `song_${i+36}`, name: `Song ${i+36}` }));
    }

    return {
      ok: true,
      text: async () => JSON.stringify({
        success: true,
        data: {
          results: songs,
          total: 100 // claims 100 but ends early
        }
      })
    };
  }

  // Fallback for healthcheck
  return {
    ok: true,
    text: async () => JSON.stringify({ success: true, data: { results: [{}] } })
  };
};

let mongod;

async function main() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  const db = require('../src/config/db');
  const { createApp } = require('../src/app');
  const pool = require('../src/services/upstreamPool');

  await db.connect(process.env.MONGODB_URI);
  await pool.seedFromEnv();

  const app = createApp();
  const api = request(app);

  console.log('Testing GET /api/v1/albums/resolve');
  const res1 = await api.get('/api/v1/music/albums/resolve?link=https://www.jiosaavn.com/album/mock-album/mock123');
  if (res1.status !== 200 || res1.body.data.id !== '53134856') {
    throw new Error('Failed to resolve album link: ' + JSON.stringify(res1.body));
  }
  console.log('Album resolve test PASSED');

  console.log('Testing GET /api/v1/music/search (page 0)');
  const resPage0 = await api.get('/api/v1/music/search?q=test&type=songs&page=0&limit=20');
  if (resPage0.status !== 200 || resPage0.body.data.length !== 20) {
    throw new Error('Failed search page 0: ' + JSON.stringify(resPage0.body));
  }
  console.log('Search page 0 PASSED');
  
  console.log('Testing GET /api/v1/music/search (page 1)');
  const resPage1 = await api.get('/api/v1/music/search?q=test&type=songs&page=1&limit=20');
  if (resPage1.status !== 200 || resPage1.body.data.length !== 21) {
    throw new Error('Failed search page 1: ' + JSON.stringify(resPage1.body));
  }
  console.log('Search page 1 PASSED');

  console.log('Backend respects mocked pagination properly!');
  
  await db.disconnect();
  await mongod.stop();
  global.fetch = originalFetch;
  console.log('ALL PASSED');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('TEST CRASHED:', err.message);
  try { if (mongod) await mongod.stop(); } catch {}
  process.exit(1);
});
