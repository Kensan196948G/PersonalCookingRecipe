// Test setup configuration
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = './data/test-recipes.db';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.PORT = 0; // Use random available port

const fs = require('fs');
const path = require('path');
const { closeConnections } = require('../src/config/database');

// Clean test database before each test run
const testDbPath = path.join(__dirname, '../data/test-recipes.db');
const testDbWalPath = testDbPath + '-wal';
const testDbShmPath = testDbPath + '-shm';

// Helper function to clean test database files
const cleanTestDatabase = () => {
  const filesToRemove = [testDbPath, testDbWalPath, testDbShmPath];
  filesToRemove.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (err) {
        console.warn(`Could not remove test database file: ${file}`, err.message);
      }
    }
  });
};

// Clean database before tests start
beforeAll(() => {
  cleanTestDatabase();
});

// Clean up after each test
afterEach(async () => {
  // Close any open database connections
  try {
    await closeConnections();
  } catch (err) {
    console.warn('Error closing database connections:', err.message);
  }
});

// Final cleanup
afterAll(async () => {
  // Close database connections
  try {
    await closeConnections();
  } catch (err) {
    console.warn('Error closing database connections in afterAll:', err.message);
  }
  
  // Clean up test database files
  setTimeout(() => {
    cleanTestDatabase();
  }, 100);
  
  // Restore original console
  global.console = originalConsole;
});

// Mock console during tests to reduce noise
const originalConsole = console;
global.console = {
  ...console,
  log: jest.fn(),
  error: originalConsole.error,
  warn: originalConsole.warn,
  info: jest.fn(),
  debug: jest.fn(),
};

// Global test utilities
global.testUtils = {
  cleanTestDatabase,
  generateUniqueEmail: () => `test${Date.now()}${Math.random().toString(36).substr(2, 9)}@example.com`,
  generateUniqueUsername: () => `user${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
  
  // Database connection retry helper
  retryAsync: async (fn, maxRetries = 3, delay = 100) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        if (error.code === 'SQLITE_BUSY') {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
          continue;
        }
        throw error;
      }
    }
  }
};