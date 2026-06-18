const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.AUDIUM_MONGODB_URI;
  if (!uri) {
    console.error(JSON.stringify({
      service: "audium-db",
      level: "FATAL",
      message: "AUDIUM_MONGODB_URI is not set. Cannot start Audium."
    }));
    process.exit(1);     // fail fast — do not start without DB
  }

  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        bufferCommands: false  // disable Mongoose buffering — fail fast
      });
      console.log(JSON.stringify({
        service: "audium-db",
        level: "INFO",
        message: "Audium MongoDB connected."
      }));
      return;
    } catch (err) {
      retries--;
      console.error(JSON.stringify({
        service: "audium-db",
        level: "ERROR",
        message: err.message,
        retriesLeft: retries
      }));
      if (retries === 0) process.exit(1);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
};

module.exports = connectDB;
