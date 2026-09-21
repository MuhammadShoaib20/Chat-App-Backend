const Redis = require('ioredis');

/**
 * Redis is OPTIONAL for this backend.
 *
 *  - It is only used for (a) response caching in controllers and
 *    (b) the Socket.IO Redis adapter (horizontal scaling).
 *  - Authentication, REST APIs and single-instance Socket.IO do NOT require it.
 *
 * Therefore a broken/unreachable Redis must NEVER take the API down:
 * caching degrades to "no cache" and Socket.IO falls back to the default
 * in-memory adapter (see src/config/socket.js).
 *
 * REDIS_URL must be a real connection URL:
 *    rediss://default:<password>@<host>:<port>   (TLS — required by most hosted Redis)
 *    redis://default:<password>@<host>:<port>    (no TLS)
 *
 * A bare password/token is NOT a URL: ioredis would treat it as a HOSTNAME,
 * which fails DNS resolution and (with the default maxRetriesPerRequest: 20)
 * ends in MaxRetriesPerRequestError. We detect and report that case explicitly.
 */

const RAW_REDIS_URL = (process.env.REDIS_URL || '').trim();
const VALID_REDIS_URL = /^(redis|rediss|unix):\/\//i.test(RAW_REDIS_URL);

const LOG_THROTTLE_MS = 60 * 1000;

const state = {
  status: 'disabled',
  lastError: null,
  lastErrorAt: null,
};

const lastLoggedAt = new Map();
let optionalHintShown = false;

/** Strip anything that could leak REDIS_URL credentials into the logs. */
const redact = (value) => {
  let text = String(value == null ? '' : value);
  if (RAW_REDIS_URL) {
    text = text.split(RAW_REDIS_URL).join('<REDIS_URL>');
  }
  return text.replace(/(rediss?:\/\/)([^@\s/]+)@/gi, '$1***@');
};

/** Non-secret description of the configured Redis target (for logs/health). */
const describeRedisTarget = () => {
  if (!VALID_REDIS_URL) return RAW_REDIS_URL ? 'invalid REDIS_URL' : null;
  try {
    const parsed = new URL(RAW_REDIS_URL);
    return `${parsed.hostname}:${parsed.port || 'default'} (tls=${parsed.protocol === 'rediss:'}, auth=${parsed.username || parsed.password ? 'yes' : 'no'})`;
  } catch {
    return 'unparseable REDIS_URL';
  }
};

const logRedisError = (scope, err) => {
  const message = redact(err && err.message ? err.message : err);

  state.status = 'error';
  state.lastError = message;
  state.lastErrorAt = new Date().toISOString();

  // Throttle identical repeats so Render logs stay readable (no crash, no spam).
  const key = `${scope}:${message}`;
  const now = Date.now();
  if (now - (lastLoggedAt.get(key) || 0) < LOG_THROTTLE_MS) return;
  lastLoggedAt.set(key, now);

  console.error(`❌ Redis ${scope}: ${message}`);

  if (!optionalHintShown) {
    optionalHintShown = true;
    console.error('   ℹ️  Redis is optional — caching is disabled and Socket.IO keeps using the in-memory adapter.');
    console.error('   ℹ️  Fix the REDIS_URL env var (rediss://default:<password>@<host>:<port>) to re-enable it.');
  }
};

const clientOptions = {
  // Bounded retries: commands fail fast instead of queueing for ~30s and
  // ending with a fatal MaxRetriesPerRequestError (ioredis default = 20).
  maxRetriesPerRequest: 3,
  // Never queue commands while offline → the API cannot hang on Redis.
  enableOfflineQueue: false,
  connectTimeout: 10000,
  // Keep reconnecting in the background (cheap) so a Redis blip self-heals.
  retryStrategy: (times) => Math.min(times * 500, 5000),
};

let pubClient = null;
let subClient = null;

const attachListeners = (client, scope) => {
  client.on('connect', () => {
    if (state.status !== 'ready') state.status = 'connecting';
    console.log(`🔄 Redis ${scope} connecting...`);
  });

  client.on('ready', () => {
    state.status = 'ready';
    console.log(`✅ Redis ${scope} ready`);
  });

  client.on('error', (err) => logRedisError(scope, err));

  client.on('end', () => {
    if (state.status !== 'error') state.status = 'closed';
  });
};

if (VALID_REDIS_URL) {
  try {
    pubClient = new Redis(RAW_REDIS_URL, clientOptions);
    // Pub/Sub needs its own dedicated connection: never share one ioredis
    // client for publishing and subscribing.
    subClient = pubClient.duplicate();
    attachListeners(pubClient, 'PubClient');
    attachListeners(subClient, 'SubClient');
    console.log(`🔄 Redis enabled → ${describeRedisTarget()}`);
  } catch (err) {
    pubClient = null;
    subClient = null;
    logRedisError('initialization', err);
  }
} else if (RAW_REDIS_URL) {
  // Most common misconfiguration: only the password/token was pasted.
  state.status = 'disabled';
  console.error('❌ Redis disabled: REDIS_URL is not a valid connection URL.');
  console.error('   Expected format: rediss://default:<password>@<host>:<port> (or redis://...)');
  console.error('   A bare password/token is interpreted by ioredis as a hostname, so DNS would fail.');
} else {
  state.status = 'disabled';
  console.warn('⚠️  REDIS_URL not set — Redis caching and the Socket.IO Redis adapter are disabled (optional, single-instance mode).');
}

const isRedisEnabled = () => Boolean(pubClient);
const isRedisReady = () => Boolean(pubClient) && pubClient.status === 'ready';
const isPubSubReady = () =>
  isRedisReady() && (!subClient || subClient.status === 'ready');

/** Resolve `true` as soon as the pub client is usable, `false` on timeout. */
const waitForRedisReady = (timeoutMs = 8000) =>
  new Promise((resolve) => {
    if (!pubClient) return resolve(false);
    if (pubClient.status === 'ready') return resolve(true);

    let settled = false;
    const finish = (ready) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pubClient.removeListener('ready', onReady);
      resolve(ready);
    };
    const onReady = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);

    pubClient.once('ready', onReady);
  });

/**
 * Cache facade used by the controllers. Every method is a no-op when Redis is
 * disabled or not ready, so callers never have to care.
 */
const redisClient = {
  get isReady() {
    return isRedisReady();
  },

  async get(key) {
    if (!this.isReady) return null;
    try {
      return await pubClient.get(key);
    } catch (err) {
      logRedisError('get', err);
      return null;
    }
  },

  async setEx(key, ttl, value) {
    if (!this.isReady) return;
    try {
      await pubClient.setex(key, ttl, value);
    } catch (err) {
      logRedisError('setEx', err);
    }
  },

  async del(key) {
    if (!this.isReady) return;
    try {
      await pubClient.del(key);
    } catch (err) {
      logRedisError('del', err);
    }
  },

  multi() {
    if (!this.isReady) {
      return { del() { return this; }, exec: async () => [] };
    }
    return pubClient.multi();
  },
};

/** Safe status snapshot for /api/health — never contains credentials. */
const redisStatus = () => ({
  enabled: isRedisEnabled(),
  status: !isRedisEnabled()
    ? 'disabled'
    : isPubSubReady()
      ? 'ready'
      : state.status === 'disabled'
        ? 'connecting' // enabled but no event fired yet (first seconds after boot)
        : state.status,
  target: describeRedisTarget(),
  lastError: state.lastError,
  lastErrorAt: state.lastErrorAt,
});

/** Close both connections on shutdown (SIGTERM from Render, local Ctrl+C). */
const closeRedis = async () => {
  const clients = [pubClient, subClient].filter(Boolean);
  await Promise.all(
    clients.map(async (client) => {
      try {
        await client.quit();
      } catch {
        try {
          client.disconnect();
        } catch {
          /* already closed */
        }
      }
    })
  );
};

module.exports = {
  redisClient,
  pubClient,
  subClient,
  isRedisEnabled,
  isRedisReady,
  waitForRedisReady,
  redisStatus,
  describeRedisTarget,
  closeRedis,
};
