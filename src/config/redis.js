const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const pubClient = new Redis(redisUrl);
const subClient = pubClient.duplicate();

pubClient.on('connect', () => console.log('🔄 Redis PubClient connecting...'));
pubClient.on('ready', () => console.log('✅ Redis PubClient ready'));
pubClient.on('error', (err) => console.error('❌ Redis PubClient error:', err.message));

subClient.on('connect', () => console.log('🔄 Redis SubClient connecting...'));
subClient.on('ready', () => console.log('✅ Redis SubClient ready'));
subClient.on('error', (err) => console.error('❌ Redis SubClient error:', err.message));

const redisClient = {
  get isReady() {
    return pubClient.status === 'ready';
  },

  async get(key) {
    if (!this.isReady) return null;
    try {
      return await pubClient.get(key);
    } catch (err) {
      console.error('Redis get error:', err.message);
      return null;
    }
  },

  async setEx(key, ttl, value) {
    if (!this.isReady) return;
    try {
      await pubClient.setex(key, ttl, value);
    } catch (err) {
      console.error('Redis setEx error:', err.message);
    }
  },

  async del(key) {
    if (!this.isReady) return;
    try {
      await pubClient.del(key);
    } catch (err) {
      console.error('Redis del error:', err.message);
    }
  },

  multi() {
    if (!this.isReady) return { del() { return this; }, exec: async () => [] };
    return pubClient.multi();
  },
};

module.exports = {
  redisClient,
  pubClient,
  subClient,
};