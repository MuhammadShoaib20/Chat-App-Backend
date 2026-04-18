const rateLimit = require('express-rate-limit');

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 attempts per 15 minutes
  skipSuccessfulRequests: true, // don't count successful requests
  message: { message: 'Too many login/register attempts, please try again later.' },
});

// Even stricter for message sending (prevent spam)
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: { message: 'Message limit exceeded, please slow down.' },
});

module.exports = { apiLimiter, authLimiter, messageLimiter };