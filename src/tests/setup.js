// Test setup file
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

// Mock environment variables if not present
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || 3001;
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gmail-monitor-test';
process.env.GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || 'test-client-id';
process.env.GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || 'test-client-secret';
process.env.GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';
process.env.GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN || 'test-refresh-token';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-api-key';
process.env.SUMMARY_SCHEDULE = process.env.SUMMARY_SCHEDULE || '0 0 * * *';
process.env.EMAILS_BATCH_SIZE = process.env.EMAILS_BATCH_SIZE || '10';
process.env.SUMMARY_RECIPIENT_EMAIL = process.env.SUMMARY_RECIPIENT_EMAIL || 'test@example.com';

// Mock logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

let mongoServer;

// Before all tests, connect to an in-memory MongoDB instance
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

// After all tests, disconnect and close MongoDB connection
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Clear all collections after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
}); 