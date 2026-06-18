const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const uri = process.env.AUDIUM_MONGODB_URI;
    if (!uri) {
      logger.warn('No AUDIUM_MONGODB_URI defined. Skipping MongoDB connection.');
      return;
    }
    await mongoose.connect(uri);
    logger.info('MongoDB Connected successfully.');
  } catch (error) {
    logger.error({ err: error }, 'MongoDB connection failed');
    process.exit(1);
  }
};

module.exports = connectDB;
