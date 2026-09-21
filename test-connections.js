/**
 * Local connectivity diagnostic (dev utility — NOT used by the server).
 *
 *   node test-connections.js
 *
 * - Reads .env (falls back to real environment variables, e.g. Render).
 * - Validates REDIS_URL before connecting, so a mistyped value is reported
 *   clearly instead of turning into an endless reconnect loop.
 * - Never prints credentials: only host/port/scheme are shown.
 */

const dns = require('dns').promises;
const net = require('net');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const REDIS_URL = (process.env.REDIS_URL || '').trim();
const MONGO_URI = (process.env.MONGO_URI || '').trim();
const VALID_REDIS_URL = /^(redis|rediss|unix):\/\//i.test(REDIS_URL);

/** Replace anything that looks like a secret with *** before logging. */
const redact = (value) =>
  String(value == null ? '' : value).replace(
    /([a-z][a-z0-9+.-]*:\/\/)([^@\s/]+)@/gi,
    '$1***@'
  );

const hostOf = (uri, fallbackScheme) => {
  if (!uri) return null;
  try {
    const parsed = new URL(uri);
    return {
      host: parsed.hostname,
      port: parsed.port || (parsed.protocol === fallbackScheme ? '' : 'default'),
      tls: parsed.protocol === 'rediss:',
      auth: Boolean(parsed.username || parsed.password),
    };
  } catch {
    return null;
  }
};

const dnsCheck = async (label, host) => {
  if (!host) {
    console.log(`⚠️  ${label}: no hostname to resolve`);
    return false;
  }
  if (net.isIP(host)) {
    console.log(`✅ ${label} target is an IP address: ${host} (no DNS lookup needed)`);
    return true;
  }
  try {
    const addresses = await dns.resolve4(host);
    console.log(`✅ ${label} DNS resolved: ${addresses.join(', ')}`);
    return true;
  } catch (err) {
    console.log(`❌ ${label} DNS lookup failed for "${host}": ${err.code || err.message}`);
    return false;
  }
};

const checkMongo = async () => {
  const target = hostOf(MONGO_URI, 'mongodb:');
  console.log(`\n=== MongoDB ===\nURI: ${redact(MONGO_URI) || '(not set)'}`);
  if (!MONGO_URI) {
    console.log('❌ MONGO_URI is not set (required)');
    return false;
  }
  await dnsCheck('MongoDB', target ? target.host : null);
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ MongoDB Connected Successfully');
    await mongoose.connection.close();
    return true;
  } catch (err) {
    console.log('❌ MongoDB Connection Failed:', redact(err.message));
    return false;
  }
};

const checkRedis = async () => {
  console.log('\n=== Redis (optional) ===');
  if (!REDIS_URL) {
    console.log('⚠️  REDIS_URL is not set — the API runs fine without Redis (caching off, Socket.IO single instance).');
    return true;
  }
  if (!VALID_REDIS_URL) {
    console.log('❌ REDIS_URL is not a valid connection URL — Redis will be disabled.');
    console.log('   Expected: rediss://default:<password>@<host>:<port>  (or redis://...)');
    console.log('   A bare password/token is treated by ioredis as a HOSTNAME, which cannot work.');
    return false;
  }

  const target = hostOf(REDIS_URL, 'redis:');
  console.log(`URL: ${redact(REDIS_URL)}`);
  console.log(`   host=${target.host} port=${target.port} tls=${target.tls} auth=${target.auth}`);
  await dnsCheck('Redis', target.host);

  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 8000,
    retryStrategy: () => null, // give up instead of looping while diagnosing
  });
  client.on('error', () => {}); // handled by the awaited calls below

  try {
    await new Promise((resolve, reject) => {
      client.once('ready', resolve);
      client.once('error', reject);
      setTimeout(() => reject(new Error('connection timeout after 8s')), 9000);
    });
    await client.setex('chatapp:diag', 30, 'ok');
    const value = await client.get('chatapp:diag');
    await client.del('chatapp:diag');
    console.log(`✅ Redis Connected: PING=${await client.ping()} roundtrip=${value}`);
    return true;
  } catch (err) {
    console.log('❌ Redis Connection Failed:', redact(err.message));
    console.log('   If the host does not resolve, the database no longer exists — recreate it');
    console.log('   (Redis Cloud / Upstash / Render Key Value) and update REDIS_URL.');
    console.log('   If it resolves but is refused, check the password/user and whether TLS (rediss://) is required.');
    return false;
  } finally {
    client.disconnect();
  }
};

(async () => {
  console.log('=== Connectivity diagnostics ===');
  const mongoOk = await checkMongo();
  const redisOk = await checkRedis();

  console.log('\n=== Summary ===');
  console.log(`${mongoOk ? '✅' : '❌'} MongoDB (required)`);
  console.log(`${redisOk ? '✅' : '⚠️ '} Redis (optional — the API keeps running when this fails)`);
  process.exit(mongoOk && redisOk ? 0 : 1);
})();
