// Test setup configuration - PostgreSQL対応
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgresql';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5433'; // テスト用ポート
process.env.DB_NAME = 'recipe_test_db';
process.env.DB_USER = 'recipe_test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.PORT = 0; // Use random available port

const fs = require('fs');
const path = require('path');

// PostgreSQL テスト用設定 - SQLite削除済み
const { close } = require('../src/config/database-postgresql');

// Helper function for PostgreSQL test cleanup
const cleanTestDatabase = async () => {
  // PostgreSQL テスト環境のクリーンアップはDBレベルで実行
  console.log('PostgreSQL test environment - no file cleanup needed');
};

// Clean database before tests start
beforeAll(async () => {
  await cleanTestDatabase();
});

// Clean up after each test
afterEach(async () => {
  // Close any open PostgreSQL connections
  try {
    if (close) await close();
  } catch (err) {
    console.warn('Error closing database connections:', err.message);
  }
});

// Final cleanup
afterAll(async () => {
  // Close database connections
  try {
    if (close) await close();
  } catch (err) {
    console.warn('Error closing database connections in afterAll:', err.message);
  }
  
  // Clean up test database
  setTimeout(async () => {
    await cleanTestDatabase();
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