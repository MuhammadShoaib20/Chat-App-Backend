const path = require('path');

// ---------------------------------------------------------------------------
// 1) Load environment variables FIRST.
//    config modules (redis.js, cors.js) read process.env when they are
//    required, so dotenv must run before those imports.
// ---------------------------------------------------------------------------
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./src/config/db');
const setupSocket = require('./src/config/socket');
const { notFound, errorHandler } = require('./src/middleware/errorMiddleware');
const { apiLimiter, authLimiter, messageLimiter } = require('./src/middleware/rateLimiter');
const { corsOptions, allowedOrigins } = require('./src/config/cors');
const { redisStatus, closeRedis } = require('./src/config/redis');

// Verify .env loaded (never log secret values)
console.log('Environment check:');
console.log('- NODE_ENV :', process.env.NODE_ENV || 'development');
console.log('- PORT     :', process.env.PORT || 'not set (falling back to 5000)');
console.log('- MONGO_URI:', process.env.MONGO_URI ? '✅ Loaded' : '❌ Missing');
console.log('- REDIS_URL:', process.env.REDIS_URL ? '✅ Loaded (optional)' : '⚠️  Not set (optional)');
console.log('- CORS allowed origins:', allowedOrigins.join(', '));

connectDB();

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);

// Socket.io setup
const io = setupSocket(server);
app.set('io', io);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// CORS MUST stay before the rate limiters, the body parsers and every API
// route so preflight (OPTIONS) requests are answered with the CORS headers
// (and never hit the rate limiter / auth logic).
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serving static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/messages', messageLimiter);

app.use('/api/test', require('./src/routes/testRoutes'));
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/conversations', require('./src/routes/conversationRoutes'));
app.use('/api/messages', require('./src/routes/messageRoutes'));
app.use('/api/upload', require('./src/routes/uploadRoutes'));

// ✅ Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Chat API is running...',
    version: '1.0',
    status: 'OK'
  });
});

// ✅ API health check (HTTP 200 once MongoDB is connected).
// Redis is optional, so a Redis outage reports "degraded" but must NOT make
// the service unhealthy.
app.get('/api/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const redis = redisStatus();

  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'OK' : 'DEGRADED',
    message: dbConnected
      ? 'API is healthy'
      : 'API is up but MongoDB is not connected yet',
    mongodb: dbConnected ? 'connected' : 'disconnected',
    redis: redis.enabled
      ? { enabled: true, status: redis.status, target: redis.target, lastError: redis.lastError }
      : { enabled: false, status: 'disabled (optional)' },
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Startup
//   Render (and most PaaS) inject the port to listen on through process.env.PORT.
//   A hardcoded port makes the deploy fail its port check / leaves nothing
//   listening on the routed port, which shows up as a 502 Bad Gateway.
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.on('error', (err) => {
  console.error('❌ HTTP server error:', err.message);
  if (err.code === 'EADDRINUSE') process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`✅ Server running on port ${PORT} (host ${HOST})`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ---------------------------------------------------------------------------
// Resilience: third-party clients (e.g. @socket.io/redis-adapter, which does
// not await its subscribe() promises) can reject without a handler. Log it and
// keep the API alive instead of letting the process die and cause 502s.
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  const message = reason && reason.message ? reason.message : reason;
  console.error('🚨 Unhandled promise rejection (service kept alive):', message);
});

process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught exception (service kept alive):', err && err.message ? err.message : err);
});

// Graceful shutdown (Render sends SIGTERM before replacing an instance)
const shutdown = async (signal) => {
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(async () => {
    try {
      await mongoose.connection.close();
      await closeRedis();
    } catch (err) {
      console.error('Shutdown cleanup error:', err.message);
    }
    process.exit(0);
  });
  // Don't hang forever if something keeps the event loop busy
  setTimeout(() => process.exit(0), 10000).unref();
};

['SIGTERM', 'SIGINT'].forEach((signal) => process.on(signal, () => shutdown(signal)));
