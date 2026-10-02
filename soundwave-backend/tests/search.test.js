'use strict';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef0123456789';
process.env.ADMIN_API_KEY = 'test-admin-key-0123456789';
process.env.CACHE_MONGO_TIER = 'false';
process.env.UPSTREAM_URLS = process.env.UPSTREAM_URLS || 'https://jiosaavn-api.apicoolie.workers.dev';
process.env.UPSTREAM_PATH_PREFIX = process.env.UPSTREAM_PATH_PREFIX || '/api';

const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

let mongod;
let db;
let app;
let api;

describe('Premalu Search Discovery & Autocomplete Tests', () => {
  before(async () => {
    mongod = await MongoMemoryServer.create({ instance: { dbName: 'soundwave_search_test' } });
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;

    db = require('../src/config/db');
    const { createApp } = require('../src/app');
    const pool = require('../src/services/upstreamPool');

    await db.connect(uri);
    await db.ensureIndexes();
    await pool.seedFromEnv();

    app = createApp();
    api = request(app);
  });

  after(async () => {
    if (db) await db.disconnect();
    if (mongod) await mongod.stop();
  });

  test('Autocomplete for "Premalu" includes ID 53134856 and keeps 3 album editions distinct', async () => {
    const catalog = require('../src/services/catalog');
    const res = await catalog.autocomplete('Premalu');
    assert.ok(res);
    assert.ok(Array.isArray(res.albums));

    const albumIds = res.albums.map((a) => String(a.id));
    assert.ok(albumIds.includes('53134856'), 'Should contain 53134856 (Premalu Original Soundtrack)');
    assert.ok(albumIds.includes('52424905'), 'Should contain 52424905 (Premalu Malayalam)');
    assert.ok(albumIds.includes('52586060'), 'Should contain 52586060 (Premalu Tamil)');

    const soundtrackAlbum = res.albums.find((a) => String(a.id) === '53134856');
    const malayalamAlbum = res.albums.find((a) => String(a.id) === '52424905');
    const tamilAlbum = res.albums.find((a) => String(a.id) === '52586060');

    assert.ok(/Original Soundtrack/i.test(soundtrackAlbum.name));
    assert.ok(!/Original Soundtrack/i.test(malayalamAlbum.name));
    assert.ok(/Tamil/i.test(tamilAlbum.name));
  });

  test('GET /api/v1/music/search?q=Premalu&type=all contains album 53134856 and preserves worker results', async () => {
    const res = await api.get('/api/v1/music/search?q=Premalu&type=all');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data;
    assert.ok(data.albums);

    const ids = data.albums.map((a) => String(a.id));
    assert.ok(ids.includes('53134856'));
    assert.ok(ids.includes('52424905'));
  });

  test('GET /api/v1/music/search?q=Premalu&type=albums returns albums including ID 53134856', async () => {
    const res = await api.get('/api/v1/music/search?q=Premalu&type=albums&page=0&limit=20');
    assert.equal(res.status, 200);
    const items = Array.isArray(res.body.data) ? res.body.data : (res.body.data.items || res.body.data.results || []);
    const ids = items.map((a) => String(a.id));
    assert.ok(ids.includes('53134856'));
  });

  test('Hydrating album 53134856 returns all 22 tracks', async () => {
    const res = await api.get('/api/v1/music/albums/53134856');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const album = res.body.data;
    assert.equal(album.id, '53134856');
    assert.ok(/Original Soundtrack/i.test(album.name));
    assert.ok(Array.isArray(album.songs));
    assert.equal(album.songs.length, 22);
  });

  test('Artist page merges locally discovered albums with upstream albums without duplicates', async () => {
    const res = await api.get('/api/v1/music/artists/2040631');
    assert.equal(res.status, 200);
    const artist = res.body.data;
    assert.equal(artist.id, '2040631');
    assert.ok(Array.isArray(artist.albums));

    const albumIds = artist.albums.map((a) => String(a.id));
    const uniqueIds = new Set(albumIds);
    assert.equal(albumIds.length, uniqueIds.size);
    assert.ok(albumIds.includes('53134856'));
  });
});
