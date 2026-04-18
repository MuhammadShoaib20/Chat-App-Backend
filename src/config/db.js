const mongoose = require("mongoose");

const RETRY_INTERVAL_MS = 5000;

const connectDB = async () => {
  const connect = async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("✅ MongoDB Connected Successfully");
      return true;
    } catch (error) {
      console.error("❌ MongoDB Connection Failed:", error.message);
      console.log(`   Retrying in ${RETRY_INTERVAL_MS / 1000}s... (Start MongoDB or set MONGO_URI in .env)`);
      return false;
    }
  };

  const connected = await connect();
  if (!connected) {
    const retry = setInterval(async () => {
      const ok = await connect();
      if (ok) clearInterval(retry);
    }, RETRY_INTERVAL_MS);
  }
};

module.exports = connectDB;
