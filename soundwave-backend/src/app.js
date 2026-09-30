'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const morgan = require('morgan');

const env = require('./config/env');
const logger = require('./utils/logger');
const { requestContext } = require('./middleware/requestContext');
const { globalLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errors');
const routes = require('./routes');
const healthRoutes = require('./routes/health.routes');

function createApp() {
  const app = express();

  // Render/Cloudflare terminate TLS in front of us — needed for correct req.ip.
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.set('etag', 'strong');

  app.use(requestContext);

  app.use(
    helmet({
      contentSecurityPolicy: false, // pure JSON API
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    })
  );

  // The Android app sends no Origin header; browsers hitting the docs do.
  const origins = env.CORS_ORIGINS.includes('*') ? true : env.CORS_ORIGINS;
  app.use(
    cors({
      origin: origins,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-request-id', 'Range'],
      exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'X-Request-Id', 'X-Audio-Quality'],
      credentials: true,
      maxAge: 86400,
    })
  );

  app.use(compression());
  app.use(cookieParser());

  // Health must answer before rate limiting and body parsing.
  app.use('/health', healthRoutes);
  app.get('/', (_req, res) =>
    res.json({
      success: true,
      data: {
        name: 'SoundWave API',
        docs: '/api/v1',
        health: '/health',
        note: 'JioSaavn proxy with a hot-swappable upstream pool. Add or rotate worker URLs at /api/v1/admin/upstreams.',
      },
    })
  );

  app.use(globalLimiter);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(hpp()); // parameter-pollution guard

  if (!env.isProd) app.use(morgan('dev', { skip: (req) => req.path === '/health' }));

  app.use('/api/v1', routes);
  // v1 alias kept so a client built against /api also works.
  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  logger.info('express app configured', { env: env.NODE_ENV, cors: env.CORS_ORIGINS });
  return app;
}

module.exports = { createApp };
