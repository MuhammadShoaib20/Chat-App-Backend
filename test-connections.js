const dns = require('dns');
const mongoose = require('mongoose');
const Redis = require('ioredis');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log('=== DNS Resolution Tests ===\n');

// Test MongoDB DNS
dns.lookup('chat.rgukqca.mongodb.net', (err, address) => {
  if (err) {
    console.log('❌ MongoDB DNS lookup failed:', err.message);
  } else {
    console.log('✅ MongoDB DNS resolved:', address);
  }
});

// Test Redis DNS
dns.lookup('redis-18465.crce286.ap-south-1-1.ec2.cloud.redislabs.com', (err, address) => {
  if (err) {
    console.log('❌ Redis DNS lookup failed:', err.message);
  } else {
    console.log('✅ Redis DNS resolved:', address);
  }
});

console.log('\n=== Connection Tests ===\n');

// Test MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Connection Failed:', err.message));

// Test Redis Connection
const redis = new Redis(process.env.REDIS_URL);
redis.on('connect', () => console.log('✅ Redis Connected'));
redis.on('error', (err) => console.log('❌ Redis Connection Failed:', err.message));
