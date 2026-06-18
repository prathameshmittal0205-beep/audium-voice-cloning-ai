const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
});

// Mock Redis client so we don't try to connect to a real Redis server
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    sendCommand: jest.fn()
  }))
}));

// Mock Google Cloud Storage
jest.mock('@google-cloud/storage', () => {
  return {
    Storage: jest.fn().mockImplementation(() => {
      return {
        bucket: jest.fn().mockReturnValue({
          file: jest.fn().mockReturnValue({
            save: jest.fn().mockResolvedValue(true),
            getSignedUrl: jest.fn().mockResolvedValue(['https://mock-signed-url.com']),
          })
        })
      };
    })
  };
});

// Mock Google Auth Library
jest.mock('google-auth-library', () => {
  return {
    GoogleAuth: jest.fn().mockImplementation(() => {
      return {
        getIdTokenClient: jest.fn().mockResolvedValue({
          request: jest.fn().mockResolvedValue({ data: {} })
        })
      };
    })
  };
});
