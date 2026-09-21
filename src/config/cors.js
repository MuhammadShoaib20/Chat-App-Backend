/**
 * Central CORS configuration, shared by the Express app (server.js) and the
 * Socket.IO server (src/config/socket.js) so REST + WebSocket traffic use
 * exactly the same origin allow-list.
 *
 * IMPORTANT
 *  - `credentials: true` is used → the wildcard "*" must NEVER be an allowed
 *    origin. Origins are echoed back explicitly by the `cors` package.
 *  - Allowed origins = CLIENT_URL env var (comma separated) + the production
 *    frontend origin below (always allowed) + localhost (non-production only).
 */

const PRODUCTION_ORIGINS = [
  'https://chat-app-frontend-gules-one.vercel.app',
];

const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

const isProduction = process.env.NODE_ENV === 'production';

const normalizeOrigin = (origin) => String(origin).trim().replace(/\/+$/, '');

const parseOrigins = (value) =>
  String(value || '')
    .split(',')
    .map(normalizeOrigin)
    // "*" is intentionally dropped: it cannot be combined with credentials.
    .filter((origin) => origin.length > 0 && origin !== '*');

const allowedOrigins = Array.from(
  new Set([
    ...parseOrigins(process.env.CLIENT_URL),
    ...PRODUCTION_ORIGINS,
    ...(isProduction ? [] : LOCAL_ORIGINS),
  ])
);

const isLocalhostOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);

/**
 * `origin` is undefined for same-origin requests, curl and native/mobile
 * clients — those are always allowed (they are not subject to browser CORS).
 */
const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.includes(normalized)) return true;
  if (!isProduction && isLocalhostOrigin(normalized)) return true;
  return false;
};

const warnedOrigins = new Set();

const corsOriginCallback = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    return callback(null, true);
  }

  if (!warnedOrigins.has(origin)) {
    warnedOrigins.add(origin);
    console.warn(`⚠️  CORS: blocked origin "${origin}"`);
    console.warn(`   Allowed origins: ${allowedOrigins.join(', ')}`);
    console.warn('   → Add the origin to the CLIENT_URL env var to allow it.');
  }

  // Answer without CORS headers (the browser blocks it) instead of throwing.
  return callback(null, false);
};

const corsOptions = {
  origin: corsOriginCallback,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  optionsSuccessStatus: 204, // preflight responds 204 No Content
  maxAge: 86400, // let browsers cache the preflight for 24h
};

// Socket.IO uses the same `cors` package internally, so the same callback works.
// Passing the raw CLIENT_URL string here was a bug: a comma separated list
// ("http://localhost:5173,https://...vercel.app") matches no origin at all.
const socketCorsOptions = {
  origin: corsOriginCallback,
  credentials: true,
  methods: ['GET', 'POST'],
};

module.exports = {
  PRODUCTION_ORIGINS,
  allowedOrigins,
  isOriginAllowed,
  corsOptions,
  socketCorsOptions,
};
