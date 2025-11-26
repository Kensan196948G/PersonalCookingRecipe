// Jest test setup for PersonalCookingRecipe
const path = require('path');
const fs = require('fs');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.DATABASE_PATH = path.join(__dirname, '../../data/test-recipes.db');

// Mock external services for testing
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    info: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  }));
});

// Mock nodemailer for email testing
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id'
    })
  })
}));

// Global test utilities
global.testUtils = {
  // Create test user data
  createTestUser: () => ({
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'password123'
  }),

  // Create test recipe data
  createTestRecipe: (userId = 1) => ({
    user_id: userId,
    title: `Test Recipe ${Date.now()}`,
    description: 'A test recipe for unit testing',
    prep_time: 15,
    cook_time: 30,
    servings: 4,
    difficulty: 'easy',
    instructions: 'Test instructions for the recipe',
    ingredients: [
      { name: 'Test Ingredient 1', amount: '1 cup', unit: 'cup' },
      { name: 'Test Ingredient 2', amount: '2 tbsp', unit: 'tbsp' }
    ]
  }),

  // Generate JWT token for testing
  generateTestToken: (payload = { userId: 1 }) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, process.env.JWT_SECRET);
  },

  // Clean test database
  cleanTestDatabase: async () => {
    const testDbPath = process.env.DATABASE_PATH;
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  },

  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Global setup
beforeAll(async () => {
  // Ensure test data directory exists
  const testDataDir = path.dirname(process.env.DATABASE_PATH);
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }
});

// Global cleanup
afterAll(async () => {
  await global.testUtils.cleanTestDatabase();
});

// Suppress console.log during tests (except for errors)
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  if (process.env.VERBOSE_TESTS === 'true') {
    originalConsoleLog(...args);
  }
};

console.warn = (...args) => {
  if (process.env.VERBOSE_TESTS === 'true') {
    originalConsoleWarn(...args);
  }
};

// Extend Jest matchers for better testing
expect.extend({
  toBeValidJWT(received) {
    const jwt = require('jsonwebtoken');
    try {
      jwt.verify(received, process.env.JWT_SECRET);
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false
      };
    }
  },

  toBeWithinPerformanceTarget(received, target) {
    const pass = received <= target;
    return {
      message: () => 
        pass 
          ? `expected ${received}ms not to be within target ${target}ms`
          : `expected ${received}ms to be within target ${target}ms`,
      pass
    };
  }
});

module.exports = {
  testUtils: global.testUtils
};